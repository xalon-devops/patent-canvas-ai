// Temporary diagnostic: probe USPTO trademark SEARCH endpoints with the API Manager key.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const KEY = Deno.env.get("USPTO_TRADEMARK_API_KEY") ?? "";
const H = { "USPTO-API-KEY": KEY, "Content-Type": "application/json" };

const targets: Array<{ name: string; url: string; method?: string; body?: string; headers?: Record<string, string> }> = [
  { name: "api.uspto.gov-tm-search-get", url: "https://api.uspto.gov/api/v1/trademarks/search?q=candy&limit=3" },
  {
    name: "api.uspto.gov-tm-search-post",
    url: "https://api.uspto.gov/api/v1/trademarks/search",
    method: "POST",
    body: JSON.stringify({ q: "candy", pagination: { offset: 0, limit: 3 } }),
  },
  { name: "tsdrapi-search", url: "https://tsdrapi.uspto.gov/ts/cd/tsdrsearch/search?q=candy" },
  {
    name: "ds-api-trademark",
    url: "https://developer.uspto.gov/ds-api/trademarks/v3/records",
    method: "POST",
    headers: { "USPTO-API-KEY": KEY, "Content-Type": "application/x-www-form-urlencoded" },
    body: "criteria=markDescription:candy&start=0&rows=3",
  },
  { name: "assignment-api", url: "https://assignment-api.uspto.gov/trademark/basicSearch?query=candy&fields=ownerName&rows=3" },
  { name: "odp-openapi-list", url: "https://api.uspto.gov/api/v1/openapi.json" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const results: unknown[] = [];
  for (const t of targets) {
    try {
      const res = await fetch(t.url, { method: t.method ?? "GET", headers: t.headers ?? H, body: t.body });
      const text = await res.text();
      results.push({ name: t.name, status: res.status, snippet: text.slice(0, 400) });
    } catch (e) {
      results.push({ name: t.name, error: String(e).slice(0, 200) });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
