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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === 'string' ? body.action : '';
    const application_id = typeof body?.application_id === 'string' ? body.application_id : null;
    const data = (body?.data && typeof body.data === 'object') ? body.data : {};
    // Bound user-supplied text before it goes into a prompt
    const clip = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: classify_goods
    if (action === 'classify_goods') {
      const mark_name = clip(data.mark_name, 120);
      const mark_description = clip(data.mark_description);
      const business_description = clip(data.business_description, 4000);
      if (!mark_name.trim() && !business_description.trim()) {
        return new Response(JSON.stringify({ error: 'Enter your mark and a business description first.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const aiResponse = await callAI(LOVABLE_API_KEY, [
        {
          role: 'system',
          content: `You are a USPTO trademark attorney assistant. Given a trademark and business description, suggest the most appropriate Nice Classification classes and draft precise goods/services descriptions that would be accepted by the USPTO.

Return ONLY valid JSON:
{
  "suggested_classes": [
    {
      "class_number": "009",
      "class_name": "Software & Electronics",
      "goods_services": "Computer software for [specific use]; downloadable mobile applications for [specific use]",
      "confidence": 0.95,
      "reasoning": "Why this class applies"
    }
  ],
  "filing_tips": ["Tip 1", "Tip 2"],
  "potential_issues": ["Issue 1"]
}`
        },
        {
          role: 'user',
          content: `Trademark: "${mark_name}"\nDescription: ${mark_description || 'Not provided'}\nBusiness: ${business_description || 'Not provided'}\n\nSuggest Nice Classification classes with precise USPTO-acceptable goods/services descriptions.`
        }
      ]);

      return new Response(JSON.stringify({ success: true, analysis: aiResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: review_application
    if (action === 'review_application') {
      if (!application_id) {
        return new Response(JSON.stringify({ error: 'application_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: app, error: appError } = await supabaseClient
        .from('trademark_applications')
        .select('*')
        .eq('id', application_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (appError || !app) {
        return new Response(JSON.stringify({ error: 'Application not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const aiResponse = await callAI(LOVABLE_API_KEY, [
        {
          role: 'system',
          content: `You are a USPTO trademark filing expert. Review this trademark application for completeness and potential issues. Return ONLY valid JSON:
{
  "overall_score": 85,
  "readiness": "ready",
  "sections": [
    {
      "name": "Mark Information",
      "status": "complete",
      "score": 90,
      "feedback": "Specific feedback",
      "suggestions": ["Suggestion 1"]
    }
  ],
  "filing_checklist": [
    {"item": "Filing requirement", "met": true, "note": "Details"}
  ],
  "estimated_office_action_risk": "low",
  "risk_factors": ["Risk 1"]
}`
        },
        {
          role: 'user',
          content: `Review this trademark application:\n\nMark: "${app.mark_name}"\nType: ${app.mark_type}\nDescription: ${app.mark_description || 'None'}\nFiling Basis: ${app.filing_basis}\nFirst Use Date: ${app.first_use_date || 'N/A'}\nFirst Use in Commerce: ${app.first_use_commerce_date || 'N/A'}\nNice Classes: ${(app.nice_classes || []).join(', ') || 'None'}\nGoods/Services: ${JSON.stringify(app.goods_services)}\nOwner: ${app.owner_name || 'Not specified'} (${app.owner_type})\nSpecimen: ${app.specimen_description || 'Not provided'}\nSpecimen file uploaded: ${app.specimen_file_path ? 'Yes' : 'No'}`
        }
      ]);

      // Save AI analysis to the application (never move a filed/paid application backwards)
      const update: Record<string, unknown> = { ai_analysis: aiResponse };
      if (!app.status || ['draft', 'ai_review', 'ready'].includes(app.status)) {
        update.status = aiResponse?.readiness === 'ready' ? 'ready' : 'ai_review';
      }
      const { error: saveError } = await supabaseClient
        .from('trademark_applications')
        .update(update)
        .eq('id', application_id)
        .eq('user_id', userId);
      if (saveError) console.error('[TRADEMARK DRAFT] Failed to save review:', saveError);

      return new Response(JSON.stringify({ success: true, review: aiResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: specimen_guidance
    if (action === 'specimen_guidance') {
      const mark_name = clip(data.mark_name, 120);
      const mark_type = clip(data.mark_type, 40);
      const filing_basis = clip(data.filing_basis, 40);
      const nice_classes = Array.isArray(data.nice_classes)
        ? data.nice_classes.filter((c: unknown) => typeof c === 'string').slice(0, 45).map((c: string) => c.slice(0, 5))
        : [];

      const aiResponse = await callAI(LOVABLE_API_KEY, [
        {
          role: 'system',
          content: `You are a USPTO trademark specimen expert. Provide specific guidance on what specimens are acceptable for this trademark filing. Return ONLY valid JSON:
{
  "specimen_types": [
    {
      "type": "Website screenshot",
      "description": "Show the mark on your website near a 'Buy Now' or 'Add to Cart' button",
      "acceptability": "high",
      "tips": ["Tip 1"]
    }
  ],
  "common_rejections": ["Reason 1"],
  "best_practices": ["Practice 1"]
}`
        },
        {
          role: 'user',
          content: `Trademark: "${mark_name}"\nMark Type: ${mark_type}\nNice Classes: ${(nice_classes || []).join(', ')}\nFiling Basis: ${filing_basis}\n\nWhat specimens should they submit?`
        }
      ]);

      return new Response(JSON.stringify({ success: true, guidance: aiResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: classify_goods, review_application, specimen_guidance' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TRADEMARK DRAFT] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error)?.message || 'Request failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function callAI(apiKey: string, messages: any[]): Promise<any> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages,
      temperature: 0.2,
      max_tokens: 4000,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error('Rate limit exceeded. Please try again in a moment.');
    if (response.status === 402) throw new Error('AI credits exhausted. Please add credits to continue.');
    const text = await response.text();
    console.error('AI gateway error:', response.status, text);
    throw new Error('AI service error');
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[TRADEMARK DRAFT] JSON parse error:', e);
  }

  // Surface as an error instead of handing the UI an empty "analysis"
  throw new Error('The AI returned an unreadable response. Please try again.');
}
