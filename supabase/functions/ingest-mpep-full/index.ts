// Full MPEP corpus ingestion — top-shelf edge function.
//
// Pipeline:
//   1. For each configured MPEP chapter, use Firecrawl `map` to enumerate section URLs.
//   2. Use Firecrawl `scrape` (markdown) to fetch section content.
//   3. Chunk markdown at paragraph boundaries into ~800-1200 char chunks.
//   4. Batch-embed via Gemini embedding-001 (100 inputs per request).
//   5. Upsert into public.mpep_chunks; live progress written to public.ingest_jobs.
//
// Body params:
//   { job_id?: string, resume?: boolean, chapters?: string[], include_cases?: boolean }
// Chapters default to the full high-value set.
//
// Admin only. Called from the /admin MPEP card.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";
import { LANDMARK_CASES } from "./landmark-cases.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const EMBED_MODEL = "google/gemini-embedding-001";
const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";

// Chapters we ingest. Keys are chapter labels; values are Firecrawl `map` roots.
const DEFAULT_CHAPTERS: Record<string, string> = {
  "600": "https://www.uspto.gov/web/offices/pac/mpep/s600.html",
  "700": "https://www.uspto.gov/web/offices/pac/mpep/s700.html",
  "1200": "https://www.uspto.gov/web/offices/pac/mpep/s1200.html",
  "2100": "https://www.uspto.gov/web/offices/pac/mpep/s2100.html",
  "2600": "https://www.uspto.gov/web/offices/pac/mpep/s2600.html",
};

// Fallback direct URLs when `map` returns nothing (USPTO's older HTML mirror is flat).
// For chapter 2100 we always seed key sections directly, since they matter most.
const PRIORITY_URLS: Record<string, string[]> = {
  "2100": [
    "https://www.uspto.gov/web/offices/pac/mpep/s2106.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2107.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2111.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2112.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2113.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2131.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2132.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2141.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2142.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2143.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2144.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2145.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2161.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2163.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2164.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2172.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2173.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2181.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s2183.html",
  ],
  "600": [
    "https://www.uspto.gov/web/offices/pac/mpep/s601.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s605.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s608.html",
  ],
  "700": [
    "https://www.uspto.gov/web/offices/pac/mpep/s706.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s707.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s714.html",
  ],
  "1200": [
    "https://www.uspto.gov/web/offices/pac/mpep/s1204.html",
    "https://www.uspto.gov/web/offices/pac/mpep/s1207.html",
  ],
  "2600": [
    "https://www.uspto.gov/web/offices/pac/mpep/s2609.html",
  ],
};

interface Chunk {
  section_number: string;
  section_title: string;
  chunk_index: number;
  chunk_text: string;
  source_url: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!lovableApiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);
    if (!firecrawlKey) return json({ error: "FIRECRAWL_API_KEY not configured" }, 500);

    // Verify admin
    const supabaseAuth = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseAuth.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub;

    const supabase = createClient(supabaseUrl, supabaseService);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ error: "Admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const chapters: string[] = Array.isArray(body?.chapters) && body.chapters.length > 0
      ? body.chapters
      : Object.keys(DEFAULT_CHAPTERS);
    const includeCases = body?.include_cases !== false;

    // Create job row
    const { data: job, error: jobErr } = await supabase
      .from("ingest_jobs")
      .insert({
        job_type: "mpep_full",
        status: "running",
        current_stage: "mapping",
        started_by: userId,
        metadata: { chapters, include_cases: includeCases },
      })
      .select("id")
      .single();
    if (jobErr) return json({ error: `Failed to create job: ${jobErr.message}` }, 500);
    const jobId = job.id as string;

    // Kick off async work; return job id immediately.
    runIngestion({
      supabase,
      jobId,
      chapters,
      includeCases,
      lovableApiKey,
      firecrawlKey,
    }).catch(async (err) => {
      console.error("Ingestion crashed:", err);
      await supabase
        .from("ingest_jobs")
        .update({
          status: "failed",
          current_stage: "crashed",
          error_log: [{ message: err instanceof Error ? err.message : String(err), at: new Date().toISOString() }],
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    });

    return json({ success: true, job_id: jobId });
  } catch (err) {
    console.error("Handler error:", err);
    return json({ error: err instanceof Error ? err.message : "Failed" }, 500);
  }
});

async function runIngestion(params: {
  supabase: SupabaseClient;
  jobId: string;
  chapters: string[];
  includeCases: boolean;
  lovableApiKey: string;
  firecrawlKey: string;
}) {
  const { supabase, jobId, chapters, includeCases, lovableApiKey, firecrawlKey } = params;
  const errors: Array<{ message: string; at: string }> = [];
  const pushErr = (msg: string) => errors.push({ message: msg.slice(0, 500), at: new Date().toISOString() });

  // Step 1: enumerate URLs per chapter (Firecrawl map + curated priority list).
  await updateJob(supabase, jobId, { current_stage: "mapping" });
  const urlsByChapter: Record<string, string[]> = {};
  let totalUrls = 0;
  for (const chapter of chapters) {
    const seedRoot = DEFAULT_CHAPTERS[chapter];
    const urls = new Set<string>(PRIORITY_URLS[chapter] ?? []);
    if (seedRoot) {
      try {
        const mapped = await firecrawlMap(firecrawlKey, seedRoot, `s${chapter}`);
        for (const u of mapped) urls.add(u);
      } catch (err) {
        pushErr(`map ${chapter}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    // Filter to same chapter numbers and dedupe.
    const list = [...urls].filter((u) => /\/s\d+\.html/.test(u)).slice(0, 60);
    urlsByChapter[chapter] = list;
    totalUrls += list.length;
  }
  await updateJob(supabase, jobId, { total_urls: totalUrls, current_stage: "scraping" });

  // Step 2: scrape all URLs, build chunks.
  const allChunks: Chunk[] = [];
  let scraped = 0;
  for (const chapter of chapters) {
    await updateJob(supabase, jobId, { current_chapter: `Chapter ${chapter}` });
    for (const url of urlsByChapter[chapter] ?? []) {
      try {
        const { title, markdown } = await firecrawlScrape(firecrawlKey, url);
        const sectionNumber = extractSectionNumber(url);
        const sectionTitle = title || `MPEP § ${sectionNumber}`;
        const chunks = chunkMarkdown(markdown, sectionNumber, sectionTitle, url);
        allChunks.push(...chunks);
      } catch (err) {
        pushErr(`scrape ${url}: ${err instanceof Error ? err.message : String(err)}`);
      }
      scraped++;
      if (scraped % 3 === 0) {
        await updateJob(supabase, jobId, { scraped_urls: scraped });
      }
    }
  }
  await updateJob(supabase, jobId, { scraped_urls: scraped });

  // Step 3: append landmark cases as pseudo-chunks.
  if (includeCases) {
    for (const c of LANDMARK_CASES) {
      const text = `CASE LAW: ${c.case_name}, ${c.citation} (${c.statutory_hook})\n\nHolding: ${c.holding}\n\nReasoning: ${c.reasoning}`;
      allChunks.push({
        section_number: c.case_id,
        section_title: `${c.case_name} (${c.statutory_hook})`,
        chunk_index: 0,
        chunk_text: text,
        source_url: c.source_url,
      });
    }
  }

  await updateJob(supabase, jobId, {
    total_chunks: allChunks.length,
    current_stage: "embedding",
    error_log: errors,
  });

  // Step 4: batch-embed + upsert.
  const BATCH_SIZE = 50; // Gemini caps at 100; 50 keeps request bodies compact.
  let completed = 0;
  let failed = 0;
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    try {
      const embeddings = await embedBatch(lovableApiKey, batch.map((c) => c.chunk_text));
      const rows = batch.map((c, idx) => ({
        section_number: c.section_number,
        section_title: c.section_title,
        chunk_index: c.chunk_index,
        chunk_text: c.chunk_text,
        source_url: c.source_url,
        token_count: Math.ceil(c.chunk_text.length / 4),
        embedding: embeddings[idx] as unknown as string,
      }));
      const { error } = await supabase
        .from("mpep_chunks")
        .upsert(rows, { onConflict: "section_number,chunk_index" });
      if (error) {
        failed += batch.length;
        pushErr(`upsert batch ${i}: ${error.message}`);
      } else {
        completed += batch.length;
      }
    } catch (err) {
      failed += batch.length;
      pushErr(`embed batch ${i}: ${err instanceof Error ? err.message : String(err)}`);
    }
    await updateJob(supabase, jobId, {
      completed_chunks: completed,
      failed_chunks: failed,
      error_log: errors.slice(-20),
    });
    // Gentle pacing between batches to respect rate limits.
    await new Promise((r) => setTimeout(r, 300));
  }

  await updateJob(supabase, jobId, {
    status: failed === 0 ? "completed" : (completed > 0 ? "completed_with_errors" : "failed"),
    current_stage: "done",
    completed_at: new Date().toISOString(),
    error_log: errors,
  });
}

// ============ Firecrawl helpers ============
async function firecrawlMap(apiKey: string, url: string, searchHint: string): Promise<string[]> {
  const res = await fetch(`${FIRECRAWL_BASE}/map`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, search: searchHint, limit: 100, includeSubdomains: false }),
  });
  if (!res.ok) throw new Error(`Firecrawl map ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return Array.isArray(data.links) ? data.links : [];
}

async function firecrawlScrape(apiKey: string, url: string): Promise<{ title: string; markdown: string }> {
  const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl scrape ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const md = data.data?.markdown ?? data.markdown ?? "";
  const title = data.data?.metadata?.title ?? data.metadata?.title ?? "";
  return { title, markdown: md };
}

// ============ Chunking ============
function extractSectionNumber(url: string): string {
  const m = url.match(/\/s(\d+(?:\.\d+)?)\.html/i);
  return m ? m[1] : url.split("/").pop() ?? "unknown";
}

function chunkMarkdown(markdown: string, sectionNumber: string, sectionTitle: string, sourceUrl: string): Chunk[] {
  if (!markdown || markdown.length < 200) return [];
  // Strip nav / boilerplate lines.
  const cleaned = markdown
    .replace(/\[.*?\]\(#.*?\)/g, "")
    .replace(/^\s*\|.*\|\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const paras = cleaned.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 40);
  const chunks: Chunk[] = [];
  const MIN = 600;
  const MAX = 1400;
  const header = `MPEP § ${sectionNumber} — ${sectionTitle}\n\n`;
  let buf = "";
  let idx = 0;
  const flush = () => {
    if (buf.trim().length >= 200) {
      chunks.push({
        section_number: sectionNumber,
        section_title: sectionTitle,
        chunk_index: idx++,
        chunk_text: header + buf.trim(),
        source_url: sourceUrl,
      });
    }
    buf = "";
  };
  for (const p of paras) {
    if (buf.length + p.length + 2 > MAX && buf.length >= MIN) {
      flush();
    }
    buf += (buf ? "\n\n" : "") + p;
    if (buf.length >= MAX) flush();
  }
  flush();
  return chunks;
}

// ============ Embeddings ============
async function embedBatch(apiKey: string, texts: string[]): Promise<number[][]> {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`Embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const items = (data.data ?? []) as Array<{ index: number; embedding: number[] }>;
  const out: number[][] = new Array(texts.length);
  for (const it of items) out[it.index] = it.embedding;
  return out;
}

// ============ Job status ============
async function updateJob(supabase: SupabaseClient, jobId: string, patch: Record<string, unknown>) {
  await supabase.from("ingest_jobs").update(patch).eq("id", jobId);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
