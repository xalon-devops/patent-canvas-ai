// Temporary diagnostic: probe USPTO trademark endpoints with the API Manager key.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const KEY = Deno.env.get("USPTO_TRADEMARK_API_KEY") ?? "";

const targets: Array<{ name: string; url: string; headers: Record<string, string>; method?: string; body?: string }> = [
  {
    name: "tsdr-casestatus-sn-info",
    url: "https://tsdrapi.uspto.gov/ts/cd/casestatus/sn88888888/info.json",
    headers: { "USPTO-API-KEY": KEY },
  },
  {
    name: "tsdr-casedocs",
    url: "https://tsdrapi.uspto.gov/ts/cd/casestatus/sn88888888/content",
    headers: { "USPTO-API-KEY": KEY },
  },
  {
    name: "tmsearch-api",
    url: "https://tmsearch-api.uspto.gov/api/v1/trademarks/search",
    method: "POST",
    headers: { "USPTO-API-KEY": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "candy", rows: 5 }),
  },
  {
    name: "ibd-api",
    url: "https://developer.uspto.gov/ibd-api/v1/application/publications?searchText=candy&rows=2",
    headers: { "USPTO-API-KEY": KEY },
  },
  {
    name: "tsdr-x-api-key-header",
    url: "https://tsdrapi.uspto.gov/ts/cd/casestatus/sn88888888/info.json",
    headers: { "x-api-key": KEY },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const results: unknown[] = [];
  for (const t of targets) {
    try {
      const res = await fetch(t.url, { method: t.method ?? "GET", headers: t.headers, body: t.body });
      const text = await res.text();
      results.push({ name: t.name, status: res.status, snippet: text.slice(0, 300) });
    } catch (e) {
      results.push({ name: t.name, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ hasKey: KEY.length > 0, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
