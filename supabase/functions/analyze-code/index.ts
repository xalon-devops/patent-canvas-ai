import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { source, repo_url, session_id } = await req.json();
    
    console.log('Analyzing code repository:', { source, repo_url, session_id });

    if (!repo_url || !session_id) {
      throw new Error('Missing required parameters: repo_url and session_id');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract owner and repo from GitHub URL
    const githubUrlMatch = repo_url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!githubUrlMatch) {
      throw new Error('Invalid GitHub URL format');
    }

    let [, owner, repo] = githubUrlMatch;
    
    // Remove .git extension if present
    if (repo.endsWith('.git')) {
      repo = repo.slice(0, -4);
    }
    
    console.log('Extracted GitHub info:', { owner, repo });

    // Fetch repository contents from GitHub API
    const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents`;
    
    const repoResponse = await fetch(githubApiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'XALON-Patent-AI'
      }
    });

    if (!repoResponse.ok) {
      throw new Error(`GitHub API error: ${repoResponse.status} - ${repoResponse.statusText}`);
    }

    const repoContents = await repoResponse.json();
    console.log('Repository contents fetched:', repoContents.length, 'items');

    // Recursively fetch code files
    const codeFiles: { path: string; content: string; language: string }[] = [];
    const targetExtensions = ['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.sql', '.json', '.md'];

    async function fetchFileContents(items: any[], basePath = '') {
      for (const item of items) {
        if (item.type === 'file') {
          const extension = item.name.substring(item.name.lastIndexOf('.'));
          if (targetExtensions.includes(extension)) {
            try {
              const fileResponse = await fetch(item.download_url);
              if (fileResponse.ok) {
                const content = await fileResponse.text();
                // Limit file size to prevent overwhelming the AI
                if (content.length < 50000) {
                  codeFiles.push({
                    path: basePath + item.name,
                    content: content,
                    language: extension.substring(1)
                  });
                }
              }
            } catch (error) {
              console.warn(`Failed to fetch file ${item.name}:`, error);
            }
          }
        } else if (item.type === 'dir' && codeFiles.length < 100) {
          // Recursively fetch directory contents (limit depth to avoid overwhelming)
          try {
            const dirResponse = await fetch(item.url);
            if (dirResponse.ok) {
              const dirContents = await dirResponse.json();
              await fetchFileContents(dirContents, basePath + item.name + '/');
            }
          } catch (error) {
            console.warn(`Failed to fetch directory ${item.name}:`, error);
          }
        }
      }
    }

    await fetchFileContents(repoContents);
    console.log('Code files collected:', codeFiles.length);

    // Analyze the code to extract technical concepts
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Create a summary of the codebase for patent analysis
    const codeAnalysis = codeFiles.map(file => 
      `File: ${file.path} (${file.language})\n${file.content.substring(0, 2000)}${file.content.length > 2000 ? '...' : ''}`
    ).join('\n\n---\n\n');

    const analysisPrompt = `Analyze this codebase for patent-worthy technical innovations:

${codeAnalysis}

Please identify:
1. Key technical innovations and novel approaches
2. Algorithms or methods that could be patentable
3. System architecture innovations
4. Novel data structures or processing methods
5. Integration patterns that solve technical problems

Provide a concise technical summary focusing on patentable subject matter.`;

    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a technical patent analyst. Focus on identifying novel, non-obvious technical innovations that could be patentable. Be specific about technical details and implementation approaches.' 
          },
          { role: 'user', content: analysisPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.3
      }),
    });

    if (!analysisResponse.ok) {
      throw new Error(`OpenAI API error: ${analysisResponse.status}`);
    }

    const analysisData = await analysisResponse.json();
    const technicalAnalysis = analysisData.choices[0].message.content;
    
    console.log('Technical analysis completed');

    // Update the patent session with the GitHub analysis
    const { error: updateError } = await supabase
      .from('patent_sessions')
      .update({ 
        idea_prompt: `GitHub Repository Analysis: ${repo_url}\n\nTechnical Innovation Summary:\n${technicalAnalysis}`
      })
      .eq('id', session_id);

    if (updateError) {
      throw new Error(`Database update error: ${updateError.message}`);
    }

    // Generate initial AI questions based on the code analysis
    const followupPrompt = `Based on this technical analysis of a software repository, generate 5-7 specific follow-up questions to help create a comprehensive patent application:

${technicalAnalysis}

Focus on:
- Technical implementation details that aren't clear from the code
- Business problem being solved
- Advantages over existing solutions
- Specific use cases and applications
- Integration challenges solved
- Performance or efficiency improvements

Generate questions as a JSON array of strings.`;

    const questionsResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a patent attorney assistant. Generate specific, technical questions that will help complete a patent application. Return only a valid JSON array of question strings.' 
          },
          { role: 'user', content: followupPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.2
      }),
    });

    if (!questionsResponse.ok) {
      throw new Error(`OpenAI questions API error: ${questionsResponse.status}`);
    }

    const questionsData = await questionsResponse.json();
    let questions: string[];
    
    try {
      questions = JSON.parse(questionsData.choices[0].message.content);
    } catch (parseError) {
      // Fallback to default questions if JSON parsing fails
      questions = [
        "What specific technical problem does your software solution address?",
        "How does your implementation differ from existing solutions in the market?",
        "What are the key performance advantages of your approach?",
        "What specific algorithms or data structures make your solution unique?",
        "How does your system handle integration with other software components?"
      ];
    }

    // Insert the generated questions into the database
    const questionsToInsert = questions.map(question => ({
      session_id,
      question,
      answer: null
    }));

    const { error: questionsError } = await supabase
      .from('ai_questions')
      .insert(questionsToInsert);

    if (questionsError) {
      console.error('Error inserting questions:', questionsError);
      throw new Error(`Questions insert error: ${questionsError.message}`);
    }

    console.log('GitHub analysis completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        files_analyzed: codeFiles.length,
        questions_generated: questions.length,
        technical_analysis: technicalAnalysis.substring(0, 500) + '...'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-code function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'An unexpected error occurred' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});