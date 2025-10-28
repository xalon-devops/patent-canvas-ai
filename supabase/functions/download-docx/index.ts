import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.52.1'

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
    console.log('Download DOCX function started');
    
    const { session_id } = await req.json();
    
    if (!session_id) {
      console.error('Missing session_id in request');
      return new Response(
        JSON.stringify({ error: 'session_id is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch patent sections
    console.log('Fetching patent sections for session:', session_id);
    const { data: sections, error: sectionsError } = await supabase
      .from('patent_sections')
      .select('section_type, content')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (sectionsError) {
      console.error('Error fetching sections:', sectionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch patent sections' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!sections || sections.length === 0) {
      console.error('No patent sections found for session:', session_id);
      return new Response(
        JSON.stringify({ error: 'No patent sections found' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Combine sections into full patent text
    const sectionOrder = ['abstract', 'field', 'background', 'summary', 'claims', 'drawings', 'description'];
    let fullPatentText = `UTILITY PATENT APPLICATION\n\nSession ID: ${session_id}\nGenerated: ${new Date().toISOString().split('T')[0]}\n\n`;

    sectionOrder.forEach(sectionType => {
      const section = sections.find(s => s.section_type === sectionType);
      if (section) {
        const title = sectionType.charAt(0).toUpperCase() + sectionType.slice(1).replace('_', ' ');
        fullPatentText += `${title.toUpperCase()}\n\n${section.content}\n\n`;
      }
    });

    // Add any remaining sections not in the standard order
    sections.forEach(section => {
      if (!sectionOrder.includes(section.section_type)) {
        const title = section.section_type.charAt(0).toUpperCase() + section.section_type.slice(1).replace('_', ' ');
        fullPatentText += `${title.toUpperCase()}\n\n${section.content}\n\n`;
      }
    });

    console.log('Generated full patent text for DOCX');

    // Create a simple RTF document (which can be opened as DOCX)
    // This is a simplified approach - for production, consider using a proper DOCX library
    const rtfContent = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}
\\f0\\fs24 
\\par\\pard\\qc\\b UTILITY PATENT APPLICATION\\b0\\par
\\par Session ID: ${session_id}\\par
\\par Generated: ${new Date().toISOString().split('T')[0]}\\par
\\par\\pard\\ql 
${fullPatentText.replace(/\n/g, '\\par ')}}`;

    // Convert to bytes
    const docxBytes = new TextEncoder().encode(rtfContent);
    
    // Return the DOCX file directly
    return new Response(docxBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="patent-${session_id}.rtf"`,
      },
    });

  } catch (error) {
    console.error('Unexpected error in download-docx function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});