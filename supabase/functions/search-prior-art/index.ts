import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'

import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson, HttpError,
  requireSessionAccess, requireSearchAccess, consumeSearchCredit, toPgDate,
  fetchWithTimeout, aiGatewayError, parseModelJson,
} from '../_shared/http.ts';

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    console.log('Prior art search function started');

    const caller = await authenticate(req);
    const requestBody = await readJson<{ session_id?: string; search_query?: string; patent_type?: string }>(req, 200_000);
    const { session_id } = requestBody;

    if (!session_id) {
      throw new HttpError(400, 'session_id is required');
    }

    // Ownership before any service-role access, then the search credit/subscription gate
    const sessionData = await requireSessionAccess(caller, session_id);
    const access = await requireSearchAccess(caller);
    const supabase = caller.admin;



    // Get AI questions and answers for context
    const { data: questionsData, error: questionsError } = await supabase
      .from('ai_questions')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
    }

    console.log('Questions data retrieved:', questionsData?.length || 0, 'questions');

    // Extract backend analysis for smarter search
    const backendData = sessionData.data_source?.supabase_backend || null;
    const backendSummary = backendData?.ai_summary || '';
    const backendStats = backendData?.statistics || {};
    
    console.log('Backend data:', {
      hasSummary: !!backendSummary,
      tables: backendStats.tables_found || 0,
      functions: backendStats.functions_found || 0
    });


    // Build context from request or session + Q&A + backend analysis
    const clientQuery: string | undefined = typeof requestBody?.search_query === 'string' ? requestBody.search_query : undefined;
    const patentType: string | undefined = typeof requestBody?.patent_type === 'string' ? requestBody.patent_type : undefined;

    const questionsText = questionsData?.map((q) => `${q.question}: ${q.answer || ''}`).join('\n') || '';
    
    // Build rich context including backend analysis
    const contextParts = [
      sessionData.idea_prompt || '',
      typeof sessionData.technical_analysis === 'string' ? sessionData.technical_analysis : '',
      questionsText,
      backendSummary ? `Backend: ${backendSummary}` : '',
      patentType || sessionData.patent_type || ''
    ].filter(p => p.length > 0);
    
    const contextText = (clientQuery && clientQuery.trim().length > 0
      ? clientQuery
      : contextParts.join('\n')
    ).slice(0, 10000);
    
    console.log('Search context length:', contextText.length, 'chars');
    console.log('Context includes backend:', !!backendSummary);

    // Simple keyword extraction
    const stopwords = new Set([
      'the','and','for','with','that','this','from','into','over','under','between','of','a','to','in','on','is','are','be','as','by','or','an','at','it','its','their','your','our','you','we','can','will','may','could','should','would'
    ]);
    const tokenize = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopwords.has(w));

    const termFreq = new Map<string, number>();
    for (const w of tokenize(contextText)) {
      termFreq.set(w, (termFreq.get(w) || 0) + 1);
    }
    const keywords = Array.from(termFreq.entries())
      .sort((a,b) => b[1]-a[1])
      .slice(0, 20)
      .map(([w]) => w)
      .join(' ');

    console.log('Derived keywords for search:', keywords);

    // Query patent databases via Lovable AI (better results)
    let apiResults: any[] = [];
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      throw new HttpError(500, 'Patent search AI not configured. Please contact support.');
    }
    
    try {
      console.log('Querying patent databases via Lovable AI...');
      
      const searchPrompt = `Search for real US patents that are similar to this invention idea:

${contextText.substring(0, 2000)}

Find 8-12 REAL existing US patents from major companies and inventors. Search patent databases for:
- Software/technology patents if this is a tech product
- Method/process patents if this describes a method
- System patents if this is a system architecture

For EACH patent, provide:
1. Patent number (format: US followed by 7-11 digits, like US10123456 or US20210123456A1)
2. Official title from the patent
3. Brief abstract (50-100 words)
4. Publication/filing date (YYYY-MM-DD format)
5. Assignee company or inventor name

Return ONLY a valid JSON array with NO additional text:
[{"patent_number":"US...","title":"...","abstract":"...","date":"YYYY-MM-DD","assignee":"..."}]`;
      
      const lovableResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
              content: 'You are a patent search expert with access to USPTO, Google Patents, and EPO databases. Always return factual patent data as a valid JSON array. Be thorough and find relevant prior art patents.'
            },
            {
              role: 'user',
              content: searchPrompt
            }
          ],
          temperature: 0.3,
        }),
      }, 60_000);

      if (!lovableResponse.ok) {
        throw await aiGatewayError(lovableResponse, 'search-prior-art');
      } else {
        const lovableData = await lovableResponse.json();
        const responseText = lovableData.choices?.[0]?.message?.content || '';
        console.log('Lovable AI response length:', responseText.length);
        
        const parsedResults = parseModelJson(responseText);
        if (Array.isArray(parsedResults)) {
          apiResults = parsedResults.filter((p: any) => p && typeof p === 'object').slice(0, 15).map((p: any) => ({
            patent_number: String(p.patent_number || p.patentNumber || ''),
            patent_title: String(p.title || ''),
            patent_abstract: String(p.abstract || p.summary || ''),
            patent_date: p.date || p.filing_date || p.publication_date || null,
            assignee_organization: [String(p.assignee || p.inventor || 'Unknown')]
          }));
          console.log('Lovable AI found patents:', apiResults.length);
        } else {
          console.error('Failed to parse Lovable AI JSON:', responseText.substring(0, 500));
        }
      }
    } catch (apiErr) {
      if (apiErr instanceof HttpError && (apiErr.status === 429 || apiErr.status === 503)) throw apiErr;
      console.error('Lovable AI error:', apiErr instanceof Error ? apiErr.message : String(apiErr));
      apiResults = [];
    }

    // Generate semantic embedding using OpenAI for smarter search (not Lovable AI)
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    let queryEmbedding: number[] | null = null;

    if (OPENAI_API_KEY) {
      try {
        console.log('Generating semantic embedding with OpenAI...');
        const embeddingResponse = await fetchWithTimeout('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: contextText.substring(0, 8000),
          }),
        }, 15_000);

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          queryEmbedding = embeddingData.data?.[0]?.embedding;
          console.log('✓ Query embedding generated');
        } else {
          const errorText = await embeddingResponse.text();
          console.error(`Embedding API error ${embeddingResponse.status}:`, errorText);
        }
      } catch (err) {
        console.error('Error generating embedding:', err instanceof Error ? err.message : String(err));
      }
    } else {
      console.log('OpenAI API key not available, using keyword-only search');
    }

    // Compute similarity scores: semantic (AI) + keyword (Jaccard)
    const contextTokens = new Set(tokenize(contextText));
    const jaccard = (a: Set<string>, b: Set<string>) => {
      const inter = new Set([...a].filter(x => b.has(x)));
      const uni = new Set([...a, ...b]);
      return uni.size === 0 ? 0 : inter.size / uni.size;
    };

    const cosineSimilarity = (a: number[], b: number[]): number => {
      let dotProduct = 0, normA = 0, normB = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      return normA > 0 && normB > 0 ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
    };

    let priorArtResults = [];
    
    for (const p of apiResults) {
      const abstract: string = p.patent_abstract || '';
      const title: string = p.patent_title || '';
      const assignee: string = p.assignee_organization?.[0] || 'Independent Inventor';
      const combinedText = `${title} ${abstract}`;
      const absTokens = new Set(tokenize(combinedText));
      
      // Keyword score (Jaccard)
      const keywordScore = jaccard(contextTokens, absTokens);
      
      // Semantic score (AI embeddings via OpenAI)
      let semanticScore = 0;
      if (queryEmbedding && OPENAI_API_KEY) {
        try {
          const patentEmbResponse = await fetchWithTimeout('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: combinedText.substring(0, 8000),
            }),
          }, 15_000);

          if (patentEmbResponse.ok) {
            const patentEmbData = await patentEmbResponse.json();
            const patentEmbedding = patentEmbData.data?.[0]?.embedding;
            if (patentEmbedding) {
              semanticScore = cosineSimilarity(queryEmbedding, patentEmbedding);
            }
          } else {
            const errorText = await patentEmbResponse.text();
            console.error(`Patent embedding error ${patentEmbResponse.status}:`, errorText);
          }
        } catch (err) {
          console.error('Error generating patent embedding:', err instanceof Error ? err.message : String(err));
        }
      }
      
      // Combined score: semantic 70%, keyword 30% (if embeddings available, otherwise pure keyword)
      const finalScore = queryEmbedding 
        ? (semanticScore * 0.7 + keywordScore * 0.3)
        : keywordScore;
      
      // Extract overlapping and unique concepts
      const overlap = [...absTokens].filter(t => contextTokens.has(t));
      const missing = [...contextTokens].filter(t => !absTokens.has(t));
      
      // Create smarter overlap and difference claims
      const overlapClaims = overlap.slice(0, 5).map(w => {
        const templates = [
          `Uses "${w}" technology`,
          `Implements ${w}-based approach`,
          `Incorporates ${w} functionality`,
          `Features ${w} capabilities`
        ];
        return templates[Math.floor(Math.random() * templates.length)];
      });
      
      const differenceClaims = missing.slice(0, 5).map(w => {
        const templates = [
          `Your novel ${w} implementation`,
          `Unique ${w} integration`,
          `Proprietary ${w} approach`,
          `Advanced ${w} features`
        ];
        return templates[Math.floor(Math.random() * templates.length)];
      });
      
      // Add backend-specific differentiators
      if (backendStats.tables_found > 0) {
        differenceClaims.push(`Custom database with ${backendStats.tables_found} specialized tables`);
      }
      if (backendStats.functions_found > 0) {
        differenceClaims.push(`${backendStats.functions_found} proprietary serverless functions`);
      }
      
      const rawNum = String(p.patent_number || '').replace(/\s+/g, '').toUpperCase();
      const pubNum = rawNum ? (rawNum.startsWith('US') ? rawNum : `US${rawNum}`) : '';
      priorArtResults.push({
        title: title || 'Untitled Patent',
        publication_number: pubNum,
        summary: abstract.slice(0, 500) || 'No abstract available',
        similarity_score: Math.min(0.95, Number(finalScore.toFixed(3))),
        semantic_score: Number(semanticScore.toFixed(3)),
        keyword_score: Number(keywordScore.toFixed(3)),
        assignee: assignee,
        url: pubNum ? `https://patents.google.com/patent/${pubNum}` : 'https://patents.google.com',
        overlap_claims: overlapClaims.length > 0 ? overlapClaims.slice(0, 5) : ['General technological approach'],
        difference_claims: differenceClaims.length > 0 ? differenceClaims.slice(0, 5) : ['Specific implementation details'],
        patent_date: toPgDate(p.patent_date)
      });
    }
    
    // Sort by combined similarity score
    priorArtResults.sort((a, b) => b.similarity_score - a.similarity_score);
    
    console.log(`Processed ${priorArtResults.length} results with ${queryEmbedding ? 'semantic + keyword' : 'keyword-only'} scoring`);

    // If no results found, that's actually good news for patentability!
    if (priorArtResults.length === 0) {
      console.log('No prior art found - strong novelty indicator');
      const remaining = await consumeSearchCredit(caller, access);
      return jsonResponse({
        success: true,
        results_found: 0,
        search_credits_remaining: remaining,
        message: 'No similar patents found - this indicates strong novelty for your invention!'
      });
    }

    // Sort by similarity desc
    priorArtResults.sort((a,b) => b.similarity_score - a.similarity_score);

    console.log('Prepared prior art results:', priorArtResults.length);

    // Insert the prior art results into the database with all scores
    const priorArtInserts = priorArtResults.map(result => ({
      session_id: session_id,
      title: result.title,
      publication_number: result.publication_number,
      summary: result.summary,
      similarity_score: result.similarity_score,
      semantic_score: result.semantic_score || 0,
      keyword_score: result.keyword_score || 0,
      assignee: result.assignee || 'Unknown',
      url: result.url,
      overlap_claims: result.overlap_claims,
      difference_claims: result.difference_claims,
      patent_date: result.patent_date,
      source: 'patentsview'
    }));

    // Replace previous results only now that the new search succeeded
    const { error: deleteError } = await supabase
      .from('prior_art_results')
      .delete()
      .eq('session_id', session_id);
    if (deleteError) {
      console.error('Error clearing existing prior art:', deleteError);
    }

    const { data: insertedResults, error: insertError } = await supabase
      .from('prior_art_results')
      .insert(priorArtInserts)
      .select();

    if (insertError) {
      console.error('Error inserting prior art results:', insertError);
      throw new HttpError(500, 'Failed to save prior art results');
    }

    const remaining = await consumeSearchCredit(caller, access);

    console.log('Successfully inserted prior art results:', insertedResults?.length);

    return jsonResponse({
      success: true,
      results_found: priorArtResults.length,
      search_credits_remaining: remaining,
      message: 'Prior art search completed successfully'
    });

  } catch (error) {
    return errorResponse(error, 'Failed to complete prior art search', 'search-prior-art');
  }
});
