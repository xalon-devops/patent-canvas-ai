import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Paid AI call: only signed-in users (or server-to-server with the service key)
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!token) {
      return new Response(JSON.stringify({ error: 'Please sign in to continue.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (token !== serviceKey) {
      const authClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey, { auth: { persistSession: false } });
      const { data: userData, error: userError } = await authClient.auth.getUser(token);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: 'Your session has expired. Please sign in again.' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const scraped_content: string = typeof body?.scraped_content === 'string' ? body.scraped_content.slice(0, 50000) : '';
    const url: string = typeof body?.url === 'string' ? body.url.slice(0, 500) : '';

    if (!scraped_content.trim()) {
      return new Response(JSON.stringify({ error: 'No content provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      // Fallback: return truncated raw content
      return new Response(JSON.stringify({
        success: true,
        brand_name: '',
        description: scraped_content.substring(0, 500),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const truncatedContent = scraped_content.substring(0, 4000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a trademark attorney assistant. Analyze website content and extract brand/product information for a trademark clearance search.

Return ONLY valid JSON:
{
  "brand_name": "The primary brand or product name found on the site",
  "description": "A concise 2-3 sentence description of what the brand does, what goods/services it offers, and the industry it operates in. Write this as if describing goods/services for a USPTO trademark application.",
  "suggested_nice_classes": ["009", "042"]
}

For suggested_nice_classes, use standard Nice Classification codes. Common ones:
- 009: Software, apps, electronics
- 025: Clothing, footwear
- 035: Advertising, business management, retail
- 036: Financial services, insurance
- 041: Education, entertainment, training
- 042: Technology services, SaaS, cloud computing
- 043: Food services, restaurants
- 044: Medical, health services

Be specific and accurate. Focus on what the company actually sells or provides.`
          },
          {
            role: 'user',
            content: `Analyze this website content from ${url || 'unknown URL'} and extract brand/trademark information:\n\n${truncatedContent}`
          }
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.error('[BRAND ANALYZE] OpenAI error:', response.status);
      return new Response(JSON.stringify({
        success: true,
        brand_name: '',
        description: truncatedContent.substring(0, 500),
        suggested_nice_classes: [],
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await response.json();
    const text = aiData.choices?.[0]?.message?.content || '{}';

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify({
          success: true,
          brand_name: parsed.brand_name || '',
          description: parsed.description || '',
          suggested_nice_classes: Array.isArray(parsed.suggested_nice_classes)
            ? parsed.suggested_nice_classes
                .map((c: unknown) => String(c ?? '').replace(/\D/g, '').padStart(3, '0'))
                .filter((c: string) => /^0(0[1-9]|[1-3]\d|4[0-5])$/.test(c))
            : [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch (e) {
      console.error('[BRAND ANALYZE] Parse error:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      brand_name: '',
      description: truncatedContent.substring(0, 500),
      suggested_nice_classes: [],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[BRAND ANALYZE] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error)?.message || 'Analysis failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
