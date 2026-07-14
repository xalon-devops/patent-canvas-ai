// MPEP corpus ingestion — embeds curated MPEP passages and stores them in
// public.mpep_chunks for retrieval by the drafting pipeline agents.
//
// Admin-only. Idempotent (upserts on section_number + chunk_index).
// Trigger once after migration; re-run to refresh or extend the corpus.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";
import { MPEP_SEED, type MpepSeedChunk } from "./seed.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const EMBED_MODEL = "google/gemini-embedding-001";

async function embed(apiKey: string, text: string): Promise<number[]> {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`Embedding ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.data?.[0]?.embedding ?? [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

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
    const customChunks: MpepSeedChunk[] = Array.isArray(body?.custom_chunks) ? body.custom_chunks : [];
    const corpus = customChunks.length > 0 ? customChunks : MPEP_SEED;

    let inserted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const section of corpus) {
      for (let i = 0; i < section.chunks.length; i++) {
        const chunkText = section.chunks[i];
        try {
          const embedding = await embed(lovableApiKey, chunkText);
          if (embedding.length === 0) {
            failed++;
            errors.push(`${section.section_number}[${i}]: empty embedding`);
            continue;
          }
          const { error } = await supabase.from("mpep_chunks").upsert(
            {
              section_number: section.section_number,
              section_title: section.section_title,
              chunk_index: i,
              chunk_text: chunkText,
              source_url: section.source_url,
              token_count: Math.ceil(chunkText.length / 4),
              embedding: embedding as unknown as string, // pgvector accepts array literal
            },
            { onConflict: "section_number,chunk_index" },
          );
          if (error) {
            failed++;
            errors.push(`${section.section_number}[${i}]: ${error.message}`);
          } else {
            inserted++;
          }
          // Gentle pacing to avoid gateway rate limits
          await new Promise((r) => setTimeout(r, 150));
        } catch (err) {
          failed++;
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${section.section_number}[${i}]: ${msg}`);
        }
      }
    }

    return json({
      success: true,
      inserted,
      failed,
      total: inserted + failed,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error("Ingest error:", err);
    return json({ error: err instanceof Error ? err.message : "Ingest failed" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
