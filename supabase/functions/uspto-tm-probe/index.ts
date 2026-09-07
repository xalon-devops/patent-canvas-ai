// Temporary diagnostic: probe USPTO TMSearch backend endpoints.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const KEY = Deno.env.get("USPTO_TRADEMARK_API_KEY") ?? "";
const H = { "USPTO-API-KEY": KEY, "Content-Type": "application/json", Accept: "application/json" };

const solrBody = JSON.stringify({
  query: "candy",
  filters: [],
  from: 0,
  size: 3,
});

const targets: Array<{ name: string; url: string; method?: string; body?: string }> = [
  { name: "tmsearch-api-v1-select", url: "https://tmsearch.uspto.gov/api-v1-0-0/tmsearch/select?q=candy&rows=3", method: "GET" },
  { name: "tmsearch-api-v1-post", url: "https://tmsearch.uspto.gov/api-v1-0-0/tmsearch", method: "POST", body: solrBody },
  { name: "tmsearch-api-v2-post", url: "https://tmsearch.uspto.gov/api/v1/tmsearch/select", method: "POST", body: solrBody },
  { name: "tmsearch-root", url: "https://tmsearch.uspto.gov/search/search-information", method: "GET" },
  { name: "tsdr-multi-status", url: "https://tsdrapi.uspto.gov/ts/cd/casestatus/sn79000000/info.json", method: "GET" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const results: unknown[] = [];
  for (const t of targets) {
    try {
      const res = await fetch(t.url, { method: t.method ?? "GET", headers: H, body: t.body });
      const text = await res.text();
      results.push({ name: t.name, status: res.status, snippet: text.slice(0, 350) });
    } catch (e) {
      results.push({ name: t.name, error: String(e).slice(0, 160) });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
