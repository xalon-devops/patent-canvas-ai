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

    // Search Lens.org via GraphQL API
    const lensQuery = `
      query SearchPatents($query: String!, $size: Int!) {
        patentSearch(query: $query, size: $size) {
          results {
            patent {
              title
              publicationNumber
              abstract
              url
              applicationReference {
                documentId
              }
              publicationReference {
                documentId
              }
            }
            relevanceScore
          }
        }
      }
    `;

    console.log('Calling Lens.org API for prior art search');
    
    const lensResponse = await fetch('https://api.lens.org/patent-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lensApiKey}`,
      },
      body: JSON.stringify({
        query: lensQuery,
        variables: {
          query: searchQuery,
          size: 10
        }
      })
    });

    if (!lensResponse.ok) {
      const errorText = await lensResponse.text();
      console.error('Lens.org API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to search prior art' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const lensData = await lensResponse.json();
    console.log('Lens.org response received');

    if (!lensData.data?.patentSearch?.results) {
      console.warn('No results returned from Lens.org API');
      return new Response(
        JSON.stringify({ success: true, results_found: 0 }), 
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Process and store top 5 results
    const results = lensData.data.patentSearch.results.slice(0, 5);
    const priorArtResults = results.map((result: any) => ({
      session_id,
      title: result.patent.title || 'Untitled Patent',
      publication_number: result.patent.publicationNumber || 
                         result.patent.publicationReference?.documentId || 
                         result.patent.applicationReference?.documentId || 
                         'Unknown',
      similarity_score: result.relevanceScore || 0,
      summary: result.patent.abstract || 'No abstract available',
      url: result.patent.url || null
    }));

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