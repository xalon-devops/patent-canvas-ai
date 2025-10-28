import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, prior_art_id } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[CLAIM CHART] Generating element-by-element comparison...');

    // Fetch claims section
    const { data: claimsSection } = await supabaseClient
      .from('patent_sections')
      .select('content')
      .eq('session_id', session_id)
      .eq('section_type', 'claims')
      .single();

    if (!claimsSection) {
      throw new Error('Claims not found. Generate patent draft first.');
    }

    // Fetch prior art
    const { data: priorArt } = await supabaseClient
      .from('prior_art_results')
      .select('*')
      .eq('id', prior_art_id)
      .single();

    if (!priorArt) {
      throw new Error('Prior art not found');
    }

    // Use Lovable AI to generate claim chart
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `Create a detailed claim chart comparing patent claims to prior art.

YOUR CLAIMS:
${claimsSection.content}

PRIOR ART:
Title: ${priorArt.title}
Publication Number: ${priorArt.publication_number}
Summary: ${priorArt.summary}

Create a table with these columns:
1. Claim Element - Each element of your claim
2. Present in Prior Art? - Yes/No/Partially
3. Prior Art Disclosure - Where/how prior art discloses this element
4. Differences - Key differences between your invention and prior art

Format as a structured table. Focus on independent claim 1 first, then dependent claims.

Also provide:
- Overall Assessment: Does prior art anticipate your claims?
- Differentiation Strategy: How to strengthen claims to avoid this prior art
- Recommendation: File as-is, amend claims, or abandon?`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a patent attorney creating claim charts. Be thorough and objective in comparing claims to prior art.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 3000
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate claim chart');
    }

    const data = await response.json();
    const claimChart = data.choices[0].message.content;

    // Store claim chart
    await supabaseClient
      .from('prior_art_results')
      .update({
        overlap_claims: extractOverlapClaims(claimChart),
        difference_claims: extractDifferenceClaims(claimChart)
      })
      .eq('id', prior_art_id);

    console.log('[CLAIM CHART] Generated successfully');

    return new Response(JSON.stringify({
      success: true,
      claim_chart: claimChart,
      prior_art_id: prior_art_id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[CLAIM CHART] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function extractOverlapClaims(chart: string): string[] {
  // Extract elements marked as "Yes" or "Partially" in prior art
  const overlaps: string[] = [];
  const lines = chart.split('\n');
  
  for (const line of lines) {
    if (line.includes('Yes') || line.includes('Partially')) {
      // Extract claim element (rough parsing)
      const match = line.match(/\d+\.\s*(.+?)\s*\|/);
      if (match) {
        overlaps.push(match[1].trim());
      }
    }
  }
  
  return overlaps.slice(0, 10); // Top 10
}

function extractDifferenceClaims(chart: string): string[] {
  // Extract elements marked as "No" in prior art
  const differences: string[] = [];
  const lines = chart.split('\n');
  
  for (const line of lines) {
    if (line.includes('| No |') || line.includes('not disclosed')) {
      const match = line.match(/\d+\.\s*(.+?)\s*\|/);
      if (match) {
        differences.push(match[1].trim());
      }
    }
  }
  
  return differences.slice(0, 10); // Top 10
}