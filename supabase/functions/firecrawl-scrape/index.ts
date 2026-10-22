import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson, HttpError,
  assertPublicHttpUrl, fetchWithTimeout,
} from '../_shared/http.ts';

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    // Signed-in users only (prevents anonymous use of the paid Firecrawl key)
    await authenticate(req);
    const { url, options } = await readJson<{ url?: string; options?: Record<string, unknown> }>(req, 16_000);

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      throw new HttpError(500, 'Website reading is not configured');
    }

    // Format URL + SSRF guard
    const formattedUrl = assertPublicHttpUrl(url);

    // Only pass through known-safe options
    const allowedFormats = ['markdown', 'html', 'rawHtml', 'links', 'screenshot'];
    const formats = Array.isArray(options?.formats)
      ? (options!.formats as unknown[]).filter((f): f is string => typeof f === 'string' && allowedFormats.includes(f))
      : [];
    const waitFor = typeof options?.waitFor === 'number' ? Math.max(0, Math.min(10_000, options.waitFor as number)) : undefined;

    console.log('Scraping URL with Firecrawl:', formattedUrl);

    const response = await fetchWithTimeout('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: formats.length ? formats : ['markdown'],
        onlyMainContent: typeof options?.onlyMainContent === 'boolean' ? options.onlyMainContent : true,
        waitFor,
        location: options?.location && typeof options.location === 'object' ? options.location : undefined,
      }),
    }, 60_000);

    const data = await response.json().catch(() => null);

    if (!response.ok || !data) {
      console.error('Firecrawl API error:', response.status, data);
      const status = response.status === 429 ? 429 : 502;
      throw new HttpError(status, (data && typeof data.error === 'string' ? data.error : null) || `Could not read that website (status ${response.status})`);
    }

    console.log('Firecrawl scrape successful');
    return jsonResponse(data);
  } catch (error) {
    return errorResponse(error, 'Failed to scrape', 'firecrawl-scrape');
  }
});
