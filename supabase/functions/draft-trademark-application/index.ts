import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

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

    const { action, application_id, data } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: classify_goods
    if (action === 'classify_goods') {
      const { mark_name, mark_description, business_description } = data;

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
        .single();

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
          content: `Review this trademark application:\n\nMark: "${app.mark_name}"\nType: ${app.mark_type}\nDescription: ${app.mark_description || 'None'}\nFiling Basis: ${app.filing_basis}\nFirst Use Date: ${app.first_use_date || 'N/A'}\nFirst Use in Commerce: ${app.first_use_commerce_date || 'N/A'}\nNice Classes: ${(app.nice_classes || []).join(', ') || 'None'}\nGoods/Services: ${JSON.stringify(app.goods_services)}\nOwner: ${app.owner_name || 'Not specified'} (${app.owner_type})\nSpecimen: ${app.specimen_description || 'Not provided'}`
        }
      ]);

      // Save AI analysis to the application
      await supabaseClient
        .from('trademark_applications')
        .update({
          ai_analysis: aiResponse,
          status: aiResponse?.readiness === 'ready' ? 'ready' : 'ai_review',
        })
        .eq('id', application_id);

      return new Response(JSON.stringify({ success: true, review: aiResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: specimen_guidance
    if (action === 'specimen_guidance') {
      const { mark_name, mark_type, nice_classes, filing_basis } = data;

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
    return new Response(JSON.stringify({ error: error.message }), {
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

  return { error: 'Failed to parse AI response' };
}
