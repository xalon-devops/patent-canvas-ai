import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  handleCors, corsHeaders, authenticate, readJson, errorResponse, HttpError, assertPublicHttpUrl, parseModelJson,
} from '../_shared/http.ts';

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    // Signed-in users only (prevents anonymous use as an open proxy / AI-credit burner)
    await authenticate(req);
    const body = await readJson<{ url?: string }>(req, 16_000);

    // Validate URL format + SSRF guard (no localhost / private network targets)
    const url = assertPublicHttpUrl(body.url);
    const validUrl = new URL(url);
    console.log('URL crawl function started with URL:', url);

    console.log('Starting fetch for URL:', url);
    
    // Fetch the webpage content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PatentBot/1.0; Patent Analysis)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      // Set a reasonable timeout
      signal: AbortSignal.timeout(15000)
    });

    console.log('Fetch completed. Status:', response.status, 'StatusText:', response.statusText);

    if (!response.ok) {
      console.error('Failed to fetch URL:', response.status, response.statusText);
      
      // Try to read error body for more details
      let errorBody = '';
      try {
        errorBody = await response.text();
        console.error('Error response body:', errorBody.substring(0, 200));
      } catch (e) {
        console.error('Could not read error body:', (e as Error).message);
      }
      
      return new Response(
        JSON.stringify({ error: `Failed to fetch URL: ${response.status} ${response.statusText}` }), 
        { 
          status: 422, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const html = (await response.text()).slice(0, 3_000_000);
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

    // Many modern sites render their text with JavaScript, so a plain fetch sees almost nothing.
    // Fall back to Firecrawl (renders the page in a real browser), then to meta tags.
    if (textContent.length < 300) {
      const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
      if (firecrawlKey) {
        try {
          const fc = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: validUrl.href, formats: ['markdown'], onlyMainContent: true, waitFor: 2500 }),
            signal: AbortSignal.timeout(45000),
          });
          if (fc.ok) {
            const fcData = await fc.json();
            const md: string = fcData?.data?.markdown || '';
            const cleaned = md.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
            console.log('Firecrawl rendered content length:', cleaned.length);
            if (cleaned.length > textContent.length) textContent = cleaned.substring(0, 8000);
          } else {
            console.warn('Firecrawl scrape failed:', fc.status);
          }
        } catch (e) {
          console.warn('Firecrawl error:', (e as Error).message);
        }
      }
      if (textContent.length < 300) {
        const metas: string[] = [];
        const grab = (re: RegExp) => { const m = html.match(re); if (m?.[1]) metas.push(m[1].trim()); };
        grab(/<title[^>]*>([^<]+)<\/title>/i);
        grab(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
        grab(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
        const metaText = [...new Set(metas)].join('\n');
        if (metaText.length > 0) textContent = `${metaText}\n${textContent}`.trim();
      }
    }

    // Basic content validation
    if (textContent.length < 40) {
      console.warn('Very little content extracted from URL');
      return new Response(
        JSON.stringify({ 
          error: 'Unable to extract meaningful content from URL',
          content: textContent 
        }), 
        { 
          status: 422, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Turn marketing copy into a technical invention summary suitable for a prior art search
    let inventionTitle: string | null = null;
    let inventionDescription: string | null = null;
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (lovableKey) {
      try {
        const ai = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(40000),
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a patent analyst. From website text, ignore cookie banners, navigation, pricing, testimonials and calls to action. Describe the underlying technology as an invention for a prior art search. Return ONLY JSON: {"title": "short technical invention title", "description": "250-450 words: problem solved, system components (hardware/sensors/software), how it works step by step, and the specific features that appear novel. Technical, neutral language, no marketing."}' },
              { role: 'user', content: `URL: ${validUrl.href}\n\n${textContent.substring(0, 12000)}` },
            ],
          }),
        });
        if (ai.ok) {
          const aiData = await ai.json();
          const raw: string = aiData?.choices?.[0]?.message?.content || '';
          const parsed = parseModelJson(raw);
          if (parsed && typeof parsed === 'object') {
            inventionTitle = typeof parsed.title === 'string' ? parsed.title : null;
            inventionDescription = typeof parsed.description === 'string' ? parsed.description : null;
          }
        } else {
          console.warn('AI summary failed:', ai.status, await ai.text());
        }
      } catch (e) {
        console.warn('AI summary error:', (e as Error).message);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        url: url,
        invention_title: inventionTitle,
        invention_description: inventionDescription,
        content: textContent,
        content_length: textContent.length
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error);
    console.error('Unexpected error in crawl-url-content function:', error);

    // Handle timeout errors specifically
    if ((error as Error)?.name === 'TimeoutError' || (error as Error)?.name === 'AbortError') {
      return new Response(
        JSON.stringify({ error: 'Request timeout - URL took too long to respond' }), 
        {
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Internal server error while crawling URL' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});