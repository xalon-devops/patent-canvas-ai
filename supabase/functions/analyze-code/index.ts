import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson, HttpError,
  requireSessionAccess, fetchWithTimeout, aiGatewayError, parseModelJson,
} from '../_shared/http.ts';

// Calls OpenAI if configured, otherwise the Lovable AI gateway (used by every other function).
async function chat(system: string, user: string, maxTokens: number, temperature: number): Promise<string> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!openAIApiKey && !lovableKey) throw new HttpError(500, 'AI service is not configured.');
  const url = openAIApiKey ? 'https://api.openai.com/v1/chat/completions' : 'https://ai.gateway.lovable.dev/v1/chat/completions';
  const model = openAIApiKey ? 'gpt-4o-mini' : 'google/gemini-2.5-flash';
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openAIApiKey || lovableKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: maxTokens,
      temperature,
    }),
  }, 60_000);
  if (!res.ok) throw await aiGatewayError(res, 'analyze-code');
  const data = await res.json().catch(() => null);
  return String(data?.choices?.[0]?.message?.content ?? '');
}

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const caller = await authenticate(req);
    const { source, repo_url, session_id } = await readJson<{ source?: string; repo_url?: string; session_id?: string }>(req, 16_000);

    console.log('Analyzing code repository:', { source, repo_url, session_id });

    if (typeof repo_url !== 'string' || !repo_url.trim() || !session_id) {
      throw new HttpError(400, 'Missing required parameters: repo_url and session_id');
    }

    // Ownership check before any service-role writes
    await requireSessionAccess(caller, session_id, 'id, user_id');
    const supabase = caller.admin;

    // Extract owner and repo from GitHub URL - handle various URL formats
    // Remove trailing slash and any parameters
    const cleanUrl = repo_url.replace(/\/$/, '').split('?')[0];
    const githubUrlMatch = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/\?]+)/);
    if (!githubUrlMatch) {
      throw new HttpError(400, 'Invalid GitHub URL format');
    }

    let [, owner, repo] = githubUrlMatch;
    
    // Remove .git extension if present
    if (repo.endsWith('.git')) {
      repo = repo.slice(0, -4);
    }
    
    // Remove any remaining query parameters or fragments
    repo = repo.split('?')[0].split('#')[0];
    
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
      throw new HttpError(400, 'Invalid GitHub URL format');
    }
    console.log('Extracted GitHub info:', { owner, repo });

    const githubHeaders: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PatentBot-AI',
    };
    const githubToken = Deno.env.get('GITHUB_TOKEN');
    if (githubToken) githubHeaders['Authorization'] = `Bearer ${githubToken}`;

    // Fetch repository contents from GitHub API
    const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents`;
    
    const repoResponse = await fetchWithTimeout(githubApiUrl, { headers: githubHeaders }, 15_000);

    console.log('GitHub API response status:', repoResponse.status);
    console.log('GitHub API URL called:', githubApiUrl);

    if (!repoResponse.ok) {
      if (repoResponse.status === 404) {
        throw new HttpError(404, `GitHub repository not found or private: ${owner}/${repo}. Please ensure the repository exists and is public.`);
      } else if (repoResponse.status === 403 || repoResponse.status === 429) {
        throw new HttpError(429, 'GitHub API rate limit exceeded. Please try again later.');
      } else {
        throw new HttpError(502, `GitHub API error: ${repoResponse.status}`);
      }
    }

    const repoContents = await repoResponse.json();
    if (!Array.isArray(repoContents)) throw new HttpError(422, 'That GitHub URL does not point to a repository root.');
    console.log('Repository contents fetched:', repoContents.length, 'items');

    // Recursively fetch code files
    const codeFiles: { path: string; content: string; language: string }[] = [];
    const targetExtensions = ['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.sql', '.json', '.md'];

    // Bounded crawl: caps on files, directories, depth and total time so the function
    // stays well inside the edge runtime wall-clock limit.
    const MAX_FILES = 60;
    const MAX_DIRS = 25;
    const MAX_DEPTH = 4;
    const deadline = Date.now() + 40_000;
    const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', '.next', 'coverage', '__pycache__']);
    let dirsVisited = 0;

    async function fetchFileContents(items: any[], basePath = '', depth = 0) {
      for (const item of items) {
        if (codeFiles.length >= MAX_FILES || Date.now() > deadline) return;
        if (item.type === 'file') {
          const extension = item.name.includes('.') ? item.name.substring(item.name.lastIndexOf('.')) : '';
          if (targetExtensions.includes(extension) && item.download_url && (item.size ?? 0) < 50000) {
            try {
              const fileResponse = await fetchWithTimeout(item.download_url, {}, 10_000);
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
        } else if (item.type === 'dir' && depth < MAX_DEPTH && dirsVisited < MAX_DIRS && !skipDirs.has(item.name)) {
          dirsVisited++;
          try {
            const dirResponse = await fetchWithTimeout(item.url, { headers: githubHeaders }, 10_000);
            if (dirResponse.ok) {
              const dirContents = await dirResponse.json();
              if (Array.isArray(dirContents)) await fetchFileContents(dirContents, basePath + item.name + '/', depth + 1);
            }
          } catch (error) {
            console.warn(`Failed to fetch directory ${item.name}:`, error);
          }
        }
      }
    }

    await fetchFileContents(repoContents);
    console.log('Code files collected:', codeFiles.length);
    if (codeFiles.length === 0) {
      throw new HttpError(422, 'No analyzable source files were found in that repository.');
    }

    // Create a summary of the codebase for patent analysis
    const codeAnalysis = codeFiles.slice(0, 40).map(file => 
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

    const technicalAnalysis = await chat(
      'You are a technical patent analyst. Focus on identifying novel, non-obvious technical innovations that could be patentable. Be specific about technical details and implementation approaches.',
      analysisPrompt,
      2000,
      0.3,
    );
    if (!technicalAnalysis.trim()) throw new HttpError(502, 'Code analysis returned no result. Please try again.');

    console.log('Technical analysis completed');

    // Update the patent session with the GitHub analysis
    const { error: updateError } = await supabase
      .from('patent_sessions')
      .update({ 
        idea_prompt: `GitHub Repository Analysis: ${repo_url}\n\nTechnical Innovation Summary:\n${technicalAnalysis}`
      })
      .eq('id', session_id);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new HttpError(500, 'Failed to save the repository analysis.');
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

    const questionsRaw = await chat(
      'You are a patent attorney assistant. Generate specific, technical questions that will help complete a patent application. Return only a valid JSON array of question strings.',
      followupPrompt,
      1000,
      0.2,
    );
    const parsedQuestions = parseModelJson(questionsRaw);
    const rawList = Array.isArray(parsedQuestions) ? parsedQuestions : (Array.isArray(parsedQuestions?.questions) ? parsedQuestions.questions : []);
    let questions: string[] = rawList
      .filter((q: unknown) => typeof q === 'string' && q.trim().length > 5)
      .map((q: string) => q.trim().slice(0, 1000))
      .slice(0, 10);

    if (questions.length === 0) {
      console.error('Failed to parse questions response:', questionsRaw.slice(0, 500));
      // Generic (repository-agnostic) fallback questions
      questions = [
        "What specific technical problem does this software solve, and why do existing solutions fall short?",
        "Which algorithm, data flow or processing step in the code do you consider most novel, and how does it work step by step?",
        "What measurable improvements (speed, accuracy, resource use, security) does your implementation achieve over conventional approaches?",
        "Which components or modules must work together for the invention to function, and how do they interact?",
        "What alternative implementations or variations of the core technique would you want the patent to cover?"
      ];
      console.log('Using generic fallback questions');
    }

    // Replace previously generated, still-unanswered questions to avoid duplicates on re-analysis
    const { error: clearErr } = await supabase
      .from('ai_questions')
      .delete()
      .eq('session_id', session_id)
      .is('answer', null);
    if (clearErr) console.warn('Could not clear old unanswered questions:', clearErr.message);

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
      throw new HttpError(500, 'Failed to save follow-up questions.');
    }

    // Save the technical analysis to the patent_sessions table
    const { error: analysisError } = await supabase
      .from('patent_sessions')
      .update({ technical_analysis: technicalAnalysis })
      .eq('id', session_id);

    if (analysisError) {
      console.error('Error saving technical analysis:', analysisError);
      throw new HttpError(500, 'Failed to save the technical analysis.');
    }

    console.log('GitHub analysis completed successfully');

    return jsonResponse({
      success: true,
      files_analyzed: codeFiles.length,
      questions_generated: questions.length,
      technical_analysis: technicalAnalysis.substring(0, 500) + '...'
    });

  } catch (error) {
    return errorResponse(error, 'Repository analysis failed', 'analyze-code');
  }
});