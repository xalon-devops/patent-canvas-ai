import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, context } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[PATENT DIAGRAMS] Generating patent diagrams with AI');

    // Generate 4-6 key patent diagrams
    const diagramPrompts = [
      `System architecture overview diagram for: ${context}. Show main components and their connections in a clear technical patent diagram style.`,
      `Detailed process flow diagram for: ${context}. Show the step-by-step workflow with decision points in patent diagram format.`,
      `Component interaction diagram for: ${context}. Show how different parts communicate and exchange data.`,
      `Data flow diagram for: ${context}. Show how information moves through the system.`
    ];

    const diagramPromises = diagramPrompts.map(async (prompt, index) => {
      console.log(`[PATENT DIAGRAMS] Generating diagram ${index + 1}...`);
      
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image-preview',
          messages: [
            {
              role: 'user',
              content: `Generate a professional patent-style technical diagram: ${prompt}. 
              
              Style requirements:
              - Clean, technical patent drawing style
              - Black and white or minimal color
              - Clear labels and reference numbers
              - Professional engineering diagram aesthetic
              - Show components, connections, and flow`
            }
          ],
          modalities: ['image', 'text']
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`AI image generation error: ${error}`);
      }

      const data = await response.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (!imageUrl) {
        throw new Error('No image generated');
      }

      return {
        figure_number: index + 1,
        description: prompt,
        image_data: imageUrl // base64 data URL
      };
    });

    const diagrams = await Promise.all(diagramPromises);

    // Store diagrams in patent_sections as structured data
    const diagramsContent = JSON.stringify(diagrams);

    const { data: existingSection } = await supabaseClient
      .from('patent_sections')
      .select('id')
      .eq('session_id', session_id)
      .eq('section_type', 'drawings')
      .maybeSingle();

    if (existingSection) {
      await supabaseClient
        .from('patent_sections')
        .update({
          content: diagramsContent,
          is_user_edited: false
        })
        .eq('id', existingSection.id);
    } else {
      await supabaseClient
        .from('patent_sections')
        .insert({
          session_id,
          section_type: 'drawings',
          content: diagramsContent,
          is_user_edited: false
        });
    }

    console.log(`[PATENT DIAGRAMS] Generated ${diagrams.length} diagrams`);

    return new Response(JSON.stringify({
      success: true,
      diagrams_count: diagrams.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[PATENT DIAGRAMS] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
