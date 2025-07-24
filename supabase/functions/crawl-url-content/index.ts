import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { url } = await req.json();
    console.log('URL crawl function started with URL:', url);
    if (!url) {
      console.error('Missing URL in request');
      return new Response(
        JSON.stringify({ error: 'url is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Validating URL format:', url);

    // Validate URL format
    let validUrl;
    try {
      validUrl = new URL(url);
      console.log('URL parsed successfully:', validUrl.href);
      
      if (!['http:', 'https:'].includes(validUrl.protocol)) {
        console.error('Invalid protocol:', validUrl.protocol);
        throw new Error('Invalid protocol');
      }
    } catch (error) {
      console.error('Invalid URL format:', url, 'Error:', error.message);
      return new Response(
        JSON.stringify({ error: `Invalid URL format: ${error.message}` }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

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
        console.error('Could not read error body:', e.message);
      }
      
      return new Response(
        JSON.stringify({ error: `Failed to fetch URL: ${response.status} ${response.statusText}` }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const html = await response.text();
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

    // Basic content validation
    if (textContent.length < 100) {
      console.warn('Very little content extracted from URL');
      return new Response(
        JSON.stringify({ 
          error: 'Unable to extract meaningful content from URL',
          content: textContent 
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        url: url,
        content: textContent,
        content_length: textContent.length
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error in crawl-url-content function:', error);
    
    // Handle timeout errors specifically
    if (error.name === 'TimeoutError') {
      return new Response(
        JSON.stringify({ error: 'Request timeout - URL took too long to respond' }), 
        {
          status: 408,
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