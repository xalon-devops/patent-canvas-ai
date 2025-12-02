import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PRIOR-ART-MONITORING] ${step}${detailsStr}`);
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
    logStep("Starting prior art monitoring run");

    const { ideaId, sessionId, searchQuery, userId } = await req.json();
    
    if (!searchQuery) {
      throw new Error("Search query is required");
    }
    
    logStep("Received monitoring request", { ideaId, sessionId, searchQuery });

    // Call the existing search-prior-art function
    const searchResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/search-prior-art-enhanced`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          query: searchQuery,
          sessionId: sessionId,
          maxResults: 10,
        }),
      }
    );

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      logStep("Search API error", { status: searchResponse.status, error: errorText });
      throw new Error(`Search failed: ${errorText}`);
    }

    const searchResults = await searchResponse.json();
    logStep("Search completed", { resultsCount: searchResults.results?.length || 0 });

    // Calculate highest similarity
    const results = searchResults.results || [];
    const highestSimilarity = results.length > 0 
      ? Math.max(...results.map((r: any) => r.similarity_score || 0))
      : null;

    // Update or create monitoring record
    const monitoringData = {
      patent_idea_id: ideaId || null,
      patent_session_id: sessionId || null,
      search_query: searchQuery,
      results_found: results.length,
      new_results_count: results.length, // All new on first run
      highest_similarity_score: highestSimilarity,
      last_search_at: new Date().toISOString(),
      next_search_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week
      is_active: true,
      monitoring_data: {
        last_results: results.slice(0, 5).map((r: any) => ({
          title: r.title,
          publication_number: r.publication_number,
          similarity_score: r.similarity_score,
        })),
      },
    };

    const { data: existingMonitoring } = await supabaseClient
      .from("prior_art_monitoring")
      .select("id")
      .or(`patent_idea_id.eq.${ideaId},patent_session_id.eq.${sessionId}`)
      .single();

    if (existingMonitoring) {
      await supabaseClient
        .from("prior_art_monitoring")
        .update(monitoringData)
        .eq("id", existingMonitoring.id);
      logStep("Updated existing monitoring record");
    } else {
      await supabaseClient
        .from("prior_art_monitoring")
        .insert(monitoringData);
      logStep("Created new monitoring record");
    }

    // Update the patent_ideas table if ideaId provided
    if (ideaId) {
      await supabaseClient
        .from("patent_ideas")
        .update({
          last_monitored_at: new Date().toISOString(),
          prior_art_monitoring: true,
        })
        .eq("id", ideaId);
    }

    // Create infringement alert if high similarity found
    if (highestSimilarity && highestSimilarity > 0.7) {
      const highSimilarityResult = results.find((r: any) => r.similarity_score === highestSimilarity);
      
      await supabaseClient
        .from("infringement_alerts")
        .insert({
          patent_idea_id: ideaId || null,
          patent_session_id: sessionId || null,
          alert_type: "high_similarity",
          severity: highestSimilarity > 0.85 ? "critical" : "high",
          title: `High similarity detected: ${highSimilarityResult?.title || 'Unknown patent'}`,
          description: `Found patent with ${Math.round(highestSimilarity * 100)}% similarity to your invention. Review recommended before filing.`,
          confidence_score: highestSimilarity,
          source_url: highSimilarityResult?.url || null,
          is_read: false,
          metadata: {
            publication_number: highSimilarityResult?.publication_number,
            detected_at: new Date().toISOString(),
          },
        });
      logStep("Created infringement alert for high similarity");
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
