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

    // Generate 4 key patent diagrams with clean visuals
    const diagramSpecs = [
      {
        title: 'System Architecture Overview',
        prompt: 'A clean technical diagram showing the system architecture. Use simple geometric shapes (rectangles, circles, arrows) with numbered elements (10, 20, 30, etc.). Minimal or no text labels. Patent drawing style with clear lines, black and white.'
      },
      {
        title: 'Process Flow Diagram',
        prompt: 'A flowchart diagram showing the process workflow. Use simple shapes like rectangles for processes, diamonds for decisions, and arrows for flow. Number each element (100, 110, 120, etc.). Avoid text labels, use numbers only. Clean patent drawing style.'
      },
      {
        title: 'Component Interaction Diagram',
        prompt: 'A technical diagram showing component interactions. Use boxes for components connected by arrows. Number each component (200, 210, 220, etc.). No text labels, numbers only. Professional patent diagram aesthetic with clear lines.'
      },
      {
        title: 'Data Flow Architecture',
        prompt: 'A data flow diagram with simple geometric shapes. Show data movement with directional arrows between numbered elements (300, 310, 320, etc.). Avoid text, use reference numbers only. Clean black and white patent drawing style.'
      }
    ];

    const generateDiagramWithRetry = async (spec: typeof diagramSpecs[0], index: number, maxRetries = 2) => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[PATENT DIAGRAMS] Generating ${spec.title}... (attempt ${attempt + 1})`);
          
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
                  content: `Create a professional patent-style technical diagram based on this invention: ${context.substring(0, 500)}

${spec.prompt}

CRITICAL REQUIREMENTS:
- Use ONLY numbered reference markers (10, 20, 30, 100, 110, etc.) - NO TEXT LABELS
- Simple geometric shapes (rectangles, circles, diamonds, arrows)
- Clean black lines on white background
- Professional engineering/patent drawing aesthetic
- Clear visual hierarchy and spacing
- NO textual annotations except numbers`
                }
              ],
              modalities: ['image', 'text']
            }),
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`AI image generation error (${response.status}): ${error}`);
          }

          const data = await response.json();
          const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (!imageUrl) {
            throw new Error('No image generated in response');
          }

          // Generate proper HTML description
          const description = `<p><strong>Figure ${index + 1} - ${spec.title}:</strong> This figure illustrates the ${spec.title.toLowerCase()} of the invention described herein. The diagram shows key components and their relationships using numbered reference elements as detailed in the specification.</p>`;

          return {
            figure_number: index + 1,
            description: description,
            image_data: imageUrl
          };
        } catch (error) {
          console.error(`[PATENT DIAGRAMS] Attempt ${attempt + 1} failed for ${spec.title}:`, error);
          if (attempt === maxRetries) {
            // Return a placeholder on final failure instead of crashing
            console.warn(`[PATENT DIAGRAMS] All retries exhausted for ${spec.title}, using placeholder`);
            return {
              figure_number: index + 1,
              description: `<p><strong>Figure ${index + 1} - ${spec.title}:</strong> [Diagram generation pending - please regenerate this section]</p>`,
              image_data: null
            };
          }
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    };

    const diagramPromises = diagramSpecs.map((spec, index) => generateDiagramWithRetry(spec, index));
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
