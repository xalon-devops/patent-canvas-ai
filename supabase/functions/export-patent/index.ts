import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    console.log('Export patent function started');
    
    const requestBody = await req.json();
    const { session_id } = requestBody;
    
    if (!session_id) {
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

    // Fetch patent session and sections
    const { data: session, error: sessionError } = await supabase
      .from('patent_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session not found' }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { data: sections, error: sectionsError } = await supabase
      .from('patent_sections')
      .select('*')
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

    // Generate DOCX content
    const docxContent = await generatePatentDOCX(session, sections);
    
    // Upload to Supabase Storage
    const fileName = `${session.user_id}/${session_id}/patent-application.docx`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('patent-docs')
      .upload(fileName, docxContent, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload document' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('patent-docs')
      .getPublicUrl(fileName);

    console.log('Patent document generated and uploaded successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        download_url: urlData.publicUrl,
        file_path: fileName,
        sections_exported: sections.length
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error in export-patent function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function generatePatentDOCX(session: any, sections: any[]): Promise<Uint8Array> {
  // Create a basic DOCX structure with proper USPTO formatting
  const docContent = generateUSPTOFormattedDocument(session, sections);
  
  // For now, return a simple text-based document
  // In production, you'd use a proper DOCX library
  const encoder = new TextEncoder();
  return encoder.encode(docContent);
}

function generateUSPTOFormattedDocument(session: any, sections: any[]): string {
  const sectionOrder = ['field', 'background', 'summary', 'claims', 'drawings', 'description', 'abstract'];
  const sectionTitles: Record<string, string> = {
    'field': 'FIELD OF THE INVENTION',
    'background': 'BACKGROUND OF THE INVENTION',
    'summary': 'SUMMARY OF THE INVENTION',
    'claims': 'CLAIMS',
    'drawings': 'BRIEF DESCRIPTION OF THE DRAWINGS',
    'description': 'DETAILED DESCRIPTION OF THE INVENTION',
    'abstract': 'ABSTRACT'
  };

  let document = `PATENT APPLICATION

Title: ${session.idea_prompt}

Inventor: [Inventor Name]
Filing Date: ${new Date().toLocaleDateString()}

TABLE OF CONTENTS

`;

  // Add table of contents
  sectionOrder.forEach((sectionType, index) => {
    const section = sections.find(s => s.section_type === sectionType);
    if (section) {
      document += `${index + 1}. ${sectionTitles[sectionType]} ............................ Page ${index + 2}\n`;
    }
  });

  document += `\n${'='.repeat(60)}\n\n`;

  // Add sections
  sectionOrder.forEach((sectionType, index) => {
    const section = sections.find(s => s.section_type === sectionType);
    if (section) {
      document += `${index + 1}. ${sectionTitles[sectionType]}\n\n`;
      document += `${section.content}\n\n`;
      document += `${'='.repeat(60)}\n\n`;
    }
  });

  return document;
}