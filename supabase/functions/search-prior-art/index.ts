import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Prior art search function started');
    console.log('Request method:', req.method);
    
    const requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody));
    
    const { session_id } = requestBody;
    
    if (!session_id) {
      console.error('Missing session_id in request');
      return new Response(
        JSON.stringify({ error: 'session_id is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lensApiKey = Deno.env.get('LENS_API_KEY');

    console.log('Environment check:');
    console.log('SUPABASE_URL:', supabaseUrl ? 'Present' : 'Missing');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Present' : 'Missing');
    console.log('LENS_API_KEY:', lensApiKey ? 'Present' : 'Missing');

    if (!lensApiKey) {
      console.error('Missing Lens.org API key');
      return new Response(
        JSON.stringify({ error: 'Lens.org API key not configured' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch patent session details and AI questions
    console.log('Fetching patent session and questions:', session_id);
    const { data: session, error: sessionError } = await supabase
      .from('patent_sessions')
      .select('idea_prompt')
      .eq('id', session_id)
      .maybeSingle();

    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session not found' }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch AI Q&A results
    const { data: questions, error: qError } = await supabase
      .from('ai_questions')
      .select('question, answer')
      .eq('session_id', session_id)
      .not('answer', 'is', null);

    if (qError) {
      console.error('Error fetching questions:', qError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch questions' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create search query from answers
    const searchTerms = [session.idea_prompt];
    if (questions && questions.length > 0) {
      searchTerms.push(...questions.map(q => q.answer).filter(Boolean));
    }
    
    const searchQuery = searchTerms.join(' ').substring(0, 200); // Limit query length
    console.log('Generated search query:', searchQuery);

    // Search Lens.org via REST API (correct format)
    const searchRequest = {
      query: {
        bool: {
          must: [
            {
              match: {
                title: searchQuery
              }
            }
          ]
        }
      },
      size: 5,
      include: ["biblio", "doc_key"]
    };

    console.log('Calling Lens.org API for prior art search');
    console.log('Search request:', JSON.stringify(searchRequest));
    
    const lensResponse = await fetch('https://api.lens.org/patent/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lensApiKey}`,
      },
      body: JSON.stringify(searchRequest)
    });

    console.log('Lens.org response status:', lensResponse.status);

    if (!lensResponse.ok) {
      const errorText = await lensResponse.text();
      console.error('Lens.org API error status:', lensResponse.status);
      console.error('Lens.org API error body:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to search prior art', 
          details: `Status: ${lensResponse.status}, Body: ${errorText}` 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const lensData = await lensResponse.json();
    console.log('Lens.org response received:', JSON.stringify(lensData, null, 2));

    if (!lensData.data || !Array.isArray(lensData.data) || lensData.data.length === 0) {
      console.warn('No results returned from Lens.org API');
      return new Response(
        JSON.stringify({ success: true, results_found: 0 }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Process and store top 5 results (REST API format)
    const results = lensData.data.slice(0, 5);
    
    // Use Ollama to analyze overlaps and differences for each result
    const priorArtResults = [];
    for (const result of results) {
      const title = result.title || result.biblio?.title || 'Untitled Patent';
      const summary = result.abstract || result.biblio?.abstract || 'No abstract available';
      
      // Generate overlap and difference analysis using Ollama
      const analysisPrompt = `Analyze this prior art patent against the invention idea "${session.idea_prompt}".

Prior Art Patent: ${title}
Abstract: ${summary}

Provide analysis in this exact JSON format:
{
  "overlaps": ["specific overlapping claim or feature 1", "specific overlapping claim or feature 2"],
  "differences": ["key difference 1", "key difference 2", "key difference 3"]
}`;

      let overlapClaims = [];
      let differenceClaims = [];
      
      try {
        console.log('Calling XALON AI for overlap analysis');
        const analysisResponse = await fetch('https://llm.xalon.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer PatentBotAI',
          },
          body: JSON.stringify({
            model: 'ollama:llama3.1:8b',
            messages: [
              {
                role: 'user',
                content: analysisPrompt
              }
            ],
            temperature: 0.3
          })
        });

        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          const analysisContent = analysisData.choices[0]?.message?.content || '{}';
          
          try {
            const parsed = JSON.parse(analysisContent);
            overlapClaims = parsed.overlaps || [];
            differenceClaims = parsed.differences || [];
          } catch (parseError) {
            console.warn('Failed to parse overlap analysis JSON:', parseError);
          }
        }
      } catch (error) {
        console.warn('Failed to analyze overlaps for result:', error);
      }
      
      priorArtResults.push({
        session_id,
        title,
        publication_number: result.publication_number || 
                           result.biblio?.publication_number || 
                           result.doc_key?.publication_number || 
                           'Unknown',
        similarity_score: result.score || 0,
        summary,
        url: result.external_ids?.patent_office_url || null,
        overlap_claims: overlapClaims,
        difference_claims: differenceClaims
      });
    }

    console.log(`Storing ${priorArtResults.length} prior art results`);

    // Clear existing results for this session and insert new ones
    const { error: deleteError } = await supabase
      .from('prior_art_results')
      .delete()
      .eq('session_id', session_id);

    if (deleteError) {
      console.warn('Error clearing existing prior art results:', deleteError);
    }

    // Insert new results
    const { error: insertError } = await supabase
      .from('prior_art_results')
      .insert(priorArtResults);

    if (insertError) {
      console.error('Error inserting prior art results:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save prior art results' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Prior art search completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        results_found: priorArtResults.length 
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error in search-prior-art function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});