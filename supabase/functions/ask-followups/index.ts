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
    console.log('Ask followups function started');
    
    const { session_id, idea_prompt } = await req.json();
    
    if (!session_id || !idea_prompt) {
      console.error('Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'session_id and idea_prompt are required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      console.error('Missing OpenAI API key');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Enhanced URL detection
    const trimmedPrompt = idea_prompt.trim().toLowerCase();
    const isUrl = trimmedPrompt.startsWith('http') || 
                  trimmedPrompt.startsWith('www.') || 
                  /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmedPrompt);
    
    let contextualInfo = '';
    let actualUrl = idea_prompt.trim();
    
    if (isUrl) {
      // Add https:// if no protocol specified
      if (!actualUrl.startsWith('http')) {
        actualUrl = 'https://' + actualUrl;
      }
      
      console.log('Detected URL input, crawling content:', actualUrl);
      
      try {
        // Crawl the URL directly instead of calling another function
        console.log('Starting direct crawl of URL:', actualUrl);
        
        const crawlResponse = await fetch(actualUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PatentBot/1.0; Patent Analysis)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
          signal: AbortSignal.timeout(15000)
        });

        console.log('Direct crawl response status:', crawlResponse.status);

        if (crawlResponse.ok) {
          const html = await crawlResponse.text();
          console.log('Fetched HTML, length:', html.length);

          // Extract text content from HTML
          let textContent = html
            // Remove script and style elements
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            // Remove HTML comments
            .replace(/<!--[\s\S]*?-->/g, '')
            // Remove HTML tags
            .replace(/<[^>]*>/g, ' ')
            // Decode HTML entities
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            // Clean up whitespace
            .replace(/\s+/g, ' ')
            .trim();

          // Limit content to approximately 2000 tokens (roughly 8000 characters)
          if (textContent.length > 8000) {
            textContent = textContent.substring(0, 8000) + '... [content truncated]';
          }

          // Remove empty lines and excessive whitespace
          textContent = textContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');

          console.log('Extracted text content, length:', textContent.length);
          console.log('First 500 chars of extracted content:', textContent.substring(0, 500));

          if (textContent.length > 100) {
            contextualInfo = textContent;
            console.log('Successfully extracted website content for context');
          } else {
            console.warn('Very little content extracted from URL. Content was:', textContent);
            // Use what we have anyway, even if minimal
            contextualInfo = textContent;
          }
        } else {
          console.warn('Failed to fetch URL:', crawlResponse.status, crawlResponse.statusText);
        }
      } catch (crawlError) {
        console.error('Error crawling URL:', crawlError);
        // Continue without crawled content
      }
    }

    console.log('About to call OpenAI with context length:', contextualInfo.length);

    console.log('Calling OpenAI API for follow-up questions');
    
    // Create the system prompt with optional contextual information
    let systemPrompt = `You are an expert patent attorney AI assistant. Your task is to generate 3-7 intelligent follow-up questions that will help fully describe and characterize an invention for patent filing purposes.

IMPORTANT: Return your response as a valid JSON array of strings, where each string is a follow-up question. The response should be ONLY the JSON array, no additional text or formatting.

Based on the initial invention idea provided, generate questions that cover:
- Technical details and mechanisms
- Novel aspects and improvements over existing solutions  
- Use cases and applications
- Materials, components, or processes involved
- Variations or alternative embodiments
- Advantages and benefits
- Implementation details

Example format: ["Question 1?", "Question 2?", "Question 3?"]`;

    // Add contextual information if we crawled a URL
    if (contextualInfo) {
      systemPrompt += `\n\nAdditional context from the provided URL:\n${contextualInfo}`;
    }

    systemPrompt += `\n\nInitial invention idea: ${idea_prompt}`;

    // Call OpenAI API to generate follow-up questions
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate follow-up questions' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices[0].message.content;

    console.log('OpenAI response received, parsing questions');

    let questions;
    try {
      questions = JSON.parse(generatedContent);
      if (!Array.isArray(questions)) {
        throw new Error('Response is not an array');
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON array:', parseError);
      console.error('OpenAI response:', generatedContent);
      return new Response(
        JSON.stringify({ error: 'Failed to parse generated questions' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Prepare questions for database insertion
    const questionRecords = questions.map((question: string) => ({
      session_id,
      question: question.trim(),
      answer: null
    }));

    console.log(`Inserting ${questionRecords.length} questions into database`);

    // Clear existing questions for this session and insert new ones
    const { error: deleteError } = await supabase
      .from('ai_questions')
      .delete()
      .eq('session_id', session_id);

    if (deleteError) {
      console.warn('Error clearing existing questions:', deleteError);
    }

    // Insert new questions
    const { error: insertError } = await supabase
      .from('ai_questions')
      .insert(questionRecords);

    if (insertError) {
      console.error('Error inserting questions:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save questions' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Follow-up questions generated and saved successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        questions_generated: questionRecords.length,
        url_crawled: isUrl,
        context_length: contextualInfo.length
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error in ask-followups function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});