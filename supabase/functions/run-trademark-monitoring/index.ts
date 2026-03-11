import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[TRADEMARK-MONITORING] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Starting trademark monitoring run");

    const { monitorId, markName, searchQuery, niceClasses, userId } = await req.json();

    if (!searchQuery || !markName) {
      throw new Error("Search query and mark name are required");
    }

    logStep("Received monitoring request", { monitorId, markName, searchQuery });

    // Call the existing search-trademarks function
    const searchResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/search-trademarks`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          mark_name: markName,
          mark_description: searchQuery,
          nice_classes: niceClasses || [],
          skip_credit_check: true,
        }),
      }
    );

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      logStep("Search API error", { status: searchResponse.status, error: errorText });
      throw new Error(`Search failed: ${errorText}`);
    }

    const searchData = await searchResponse.json();
    const results = searchData.results || [];
    logStep("Search completed", { resultsCount: results.length });

    // Calculate highest similarity
    const highestSimilarity = results.length > 0
      ? Math.max(...results.map((r: any) => r.similarity_score || 0))
      : null;

    // Update or create monitoring record
    const monitoringData = {
      mark_name: markName,
      search_query: searchQuery,
      nice_classes: niceClasses || [],
      results_found: results.length,
      new_results_count: results.length,
      highest_similarity_score: highestSimilarity,
      last_search_at: new Date().toISOString(),
      next_search_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
      monitoring_data: {
        last_results: results.slice(0, 5).map((r: any) => ({
          mark_name: r.mark_name,
          registration_number: r.registration_number,
          similarity_score: r.similarity_score,
          status: r.status,
          owner: r.owner,
        })),
      },
    };

    if (monitorId) {
      await supabaseClient
        .from("trademark_monitoring")
        .update(monitoringData)
        .eq("id", monitorId);
      logStep("Updated existing monitoring record");
    } else {
      await supabaseClient
        .from("trademark_monitoring")
        .insert({ ...monitoringData, user_id: userId });
      logStep("Created new monitoring record");
    }

    return new Response(
      JSON.stringify({
        success: true,
        resultsFound: results.length,
        highestSimilarity,
        nextSearchAt: monitoringData.next_search_at,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
