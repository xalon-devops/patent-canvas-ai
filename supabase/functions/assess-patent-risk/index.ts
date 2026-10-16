import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface InputResult {
  id?: string;
  publication_number?: string;
  title?: string;
  url?: string;
  summary?: string;
}

interface PatentRecord {
  key: string;
  publication_number: string;
  google_url: string | null;
  found: boolean;
  owner: string | null;
  original_owner: string | null;
  priority_date: string | null;
  filing_date: string | null;
  publication_date: string | null;
  grant_date: string | null;
  expiration_date: string | null;
  legal_status: string | null;
  status_label: "Active" | "Pending" | "Expired" | "Abandoned" | "Unknown";
  jurisdiction: string | null;
  is_granted: boolean;
  first_claim: string | null;
}

const normalizePub = (raw: string) => raw.toUpperCase().replace(/[\s\/,.-]/g, "");

const strip = (s: string) =>
  s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

function pick(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? strip(m[1]) || null : null;
}

function eventDate(html: string, title: RegExp): string | null {
  const re = /<time itemprop="date" datetime="([\d-]+)">[\s\S]{0,120}?<span itemprop="title">([^<]+)<\/span>/g;
  let m: RegExpExecArray | null;
  let found: string | null = null;
  while ((m = re.exec(html))) if (title.test(m[2])) found = m[1];
  return found;
}

async function fetchPatent(r: InputResult): Promise<PatentRecord> {
  const pub = normalizePub(r.publication_number || "");
  const base: PatentRecord = {
    key: r.id || pub, publication_number: r.publication_number || "", google_url: null, found: false,
    owner: null, original_owner: null, priority_date: null, filing_date: null, publication_date: null,
    grant_date: null, expiration_date: null, legal_status: null, status_label: "Unknown",
    jurisdiction: pub.slice(0, 2) || null, is_granted: false, first_claim: null,
  };
  const candidates: string[] = [];
  if (r.url && r.url.includes("patents.google.com/patent/")) candidates.push(r.url.split("?")[0]);
  if (pub) {
    candidates.push(`https://patents.google.com/patent/${pub}/en`);
    const noKind = pub.replace(/[A-Z]\d?$/, "");
    if (noKind !== pub) candidates.push(`https://patents.google.com/patent/${noKind}/en`);
    if (pub.startsWith("WO") && !/[A-Z]\d?$/.test(pub)) candidates.push(`https://patents.google.com/patent/${pub}A1/en`);
  }
  for (const url of [...new Set(candidates)]) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 PatentBotAI" }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) { await res.text(); continue; }
      const html = await res.text();
      if (!html.includes('itemprop="publicationNumber"') && !html.includes('itemprop="filingDate"')) continue;
      const claimMatch = html.match(/<div[^>]*class="claim"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
      const ifi = pick(html, /itemprop="ifiStatus">([^<]+)</);
      const status = pick(html, /itemprop="legalStatusIfi"[\s\S]{0,200}?itemprop="status">([^<]+)</) || pick(html, /itemprop="status">([^<]+)</);
      const legal = ifi || status;
      const expiration = eventDate(html, /expiration/i) ;
      const grant = eventDate(html, /application granted|publication of grant/i);
      const pubNum = pick(html, /itemprop="publicationNumber">([^<]+)</) || pub;
      const kind = pubNum.match(/([A-Z]\d?)$/)?.[1] || "";
      const isGranted = !!grant || (/^US/.test(pubNum) && /^B/.test(kind)) || (/^EP/.test(pubNum) && /^B/.test(kind));
      let label: PatentRecord["status_label"] = "Unknown";
      const l = (legal || "").toLowerCase();
      if (/expired|lapsed|ceased/.test(l)) label = "Expired";
      else if (/abandon|withdrawn|revoked|rejected/.test(l)) label = "Abandoned";
      else if (/pending/.test(l)) label = "Pending";
      else if (/active|granted|in force/.test(l)) label = isGranted ? "Active" : "Pending";
      const isWO = /^WO/.test(pubNum);
      if (!isWO && expiration && new Date(expiration) < new Date()) label = "Expired";
      if (isWO) label = "Pending";
      return {
        ...base, google_url: url, found: true,
        publication_number: pubNum,
        owner: pick(html, /itemprop="assigneeCurrent"[^>]*>([\s\S]*?)<\/dd>/),
        original_owner: pick(html, /itemprop="assigneeOriginal"[^>]*>([\s\S]*?)<\/dd>/),
        priority_date: pick(html, /itemprop="priorityDate" datetime="([\d-]+)"/),
        filing_date: pick(html, /itemprop="filingDate" datetime="([\d-]+)"/),
        publication_date: pick(html, /itemprop="publicationDate" datetime="([\d-]+)"/),
        grant_date: grant, expiration_date: isWO ? null : expiration, legal_status: legal, status_label: label,
        jurisdiction: pick(html, /itemprop="countryCode">([^<]+)</) || base.jurisdiction,
        is_granted: isGranted,
        first_claim: claimMatch ? strip(claimMatch[1]).slice(0, 2500) : null,
      };
    } catch (_e) { /* try next */ }
  }
  return base;
}

async function assessRisk(product: string, records: (PatentRecord & { title?: string; summary?: string })[]) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  const live = records.filter((r) => (r.status_label === "Active" || r.status_label === "Pending" || r.status_label === "Unknown") && (r.jurisdiction || "").toUpperCase() !== "WO");
  if (!key || live.length === 0 || !product) return {} as Record<string, any>;
  const items = live.map((r, i) => ({
    i, number: r.publication_number, status: r.status_label, title: r.title,
    claim: r.first_claim || `(claim text unavailable) ${r.summary || ""}`.slice(0, 1500),
  }));
  const prompt = `You are a U.S. patent analyst producing a preliminary freedom-to-operate screen (not a legal opinion).
PRODUCT DESCRIPTION:
${product.slice(0, 4000)}

For each patent below, compare its first independent claim element by element against the product. Infringement requires the product to practice EVERY element of a claim. Pending applications cannot be enforced until granted, and claims often narrow; rate them on current claims but note that.
Return JSON: {"assessments":[{"i":number,"risk":"Low"|"Medium"|"High","elements_met":number,"elements_total":number,"missing_elements":[string],"reason":string (1-2 plain-English sentences),"design_around":string (1 sentence)}]}

PATENTS:
${JSON.stringify(items)}`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) { console.error("AI error", res.status, await res.text()); return {}; }
    const data = await res.json();
    const txt = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(txt.replace(/^```json\s*|```$/g, ""));
    const out: Record<string, any> = {};
    for (const a of parsed.assessments || []) if (live[a.i]) out[live[a.i].key] = a;
    return out;
  } catch (e) {
    console.error("AI assess failed", e);
    return {};
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = token ? await sb.auth.getUser(token) : { data: { user: null } };
    if (!user) return json({ error: "Your session has expired. Please sign in again." }, 401);

    const { results, product_description } = await req.json();
    if (!Array.isArray(results) || results.length === 0) return json({ error: "results are required" }, 400);
    const list: InputResult[] = results.slice(0, 15);

    const records = await Promise.all(list.map(async (r) => ({ ...(await fetchPatent(r)), title: r.title, summary: r.summary })));
    const risks = await assessRisk(String(product_description || ""), records);

    const assessed = records.map((r) => {
      const a = risks[r.key];
      let risk: string, reason: string, design_around: string | null = null;
      if (r.status_label === "Expired" || r.status_label === "Abandoned") {
        risk = "None";
        reason = `This ${r.status_label === "Expired" ? "patent has expired" : "application is abandoned"}, so it cannot be enforced. It remains prior art against new patent filings.`;
      } else if ((r.jurisdiction || "").toUpperCase() === "WO") {
        risk = "None";
        reason = "This is an international (PCT) application. It is not enforceable on its own; only patents later granted in specific countries can be enforced, so check its national family members.";
      } else if (a) {
        risk = a.risk; reason = a.reason; design_around = a.design_around || null;
      } else {
        risk = "Unknown"; reason = "Official claim and status details could not be retrieved for this record. Review it manually.";
      }
      const { first_claim, title: _t, summary: _s, ...rest } = r;
      return {
        ...rest, risk, reason, design_around,
        elements_met: a?.elements_met ?? null, elements_total: a?.elements_total ?? null,
        missing_elements: a?.missing_elements ?? [],
        first_claim_excerpt: first_claim ? first_claim.slice(0, 600) : null,
      };
    });

    const order = { High: 0, Medium: 1, Unknown: 2, Low: 3, None: 4 } as Record<string, number>;
    const top = assessed.reduce((m, r) => (order[r.risk] < order[m] ? r.risk : m), "None");
    return json({
      overall_risk: top,
      assessments: assessed,
      disclaimer: "Preliminary automated screen based on public patent records. It is not a legal opinion; consult a registered patent attorney before relying on it.",
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
