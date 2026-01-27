import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.52.1';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'npm:docx@8.5.0';

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

    // Fetch patent session
    const { data: session, error: sessionError } = await supabase
      .from('patent_sessions')
      .select('idea_prompt, user_id')
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

    // Generate proper DOCX using docx library
    const docxContent = await generatePatentDOCX(session, sections);

    console.log('Generated DOCX document successfully');
    
    // Return the DOCX file directly
    return new Response(docxContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Patent-Application-${session_id.substring(0, 8)}.docx"`,
      },
    });

  } catch (error) {
    console.error('Unexpected error in download-docx function:', error);
    const errMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errMessage }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function generatePatentDOCX(session: any, sections: any[]): Promise<Uint8Array> {
  const sectionOrder = ['abstract', 'field', 'background', 'summary', 'claims', 'drawings', 'description'];
  const sectionTitles: Record<string, string> = {
    'abstract': 'ABSTRACT',
    'field': 'FIELD OF THE INVENTION',
    'background': 'BACKGROUND OF THE INVENTION',
    'summary': 'SUMMARY OF THE INVENTION',
    'claims': 'CLAIMS',
    'drawings': 'BRIEF DESCRIPTION OF THE DRAWINGS',
    'description': 'DETAILED DESCRIPTION OF THE INVENTION'
  };

  const docSections: Paragraph[] = [];

  // Title Page
  docSections.push(
    new Paragraph({
      text: "UTILITY PATENT APPLICATION",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Title: ", bold: true }),
        new TextRun({ text: session.idea_prompt || 'Untitled Patent Application' })
      ],
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Filing Date: ", bold: true }),
        new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) })
      ],
      spacing: { after: 400 }
    }),
    new Paragraph({
      text: "",
      spacing: { after: 200 }
    })
  );

  // Table of Contents
  docSections.push(
    new Paragraph({
      text: "TABLE OF CONTENTS",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    })
  );

  let pageNum = 1;
  sectionOrder.forEach((sectionType) => {
    const section = sections.find(s => s.section_type === sectionType);
    if (section && sectionTitles[sectionType]) {
      docSections.push(
        new Paragraph({
          text: `${sectionTitles[sectionType]} ............................ Page ${pageNum}`,
          spacing: { after: 100 }
        })
      );
      pageNum++;
    }
  });

  docSections.push(
    new Paragraph({
      text: "",
      spacing: { after: 400 }
    })
  );

  // Add sections in order
  sectionOrder.forEach((sectionType) => {
    const section = sections.find(s => s.section_type === sectionType);
    if (section && sectionTitles[sectionType]) {
      // Section Heading
      docSections.push(
        new Paragraph({
          text: sectionTitles[sectionType],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        })
      );

      // Section Content - strip HTML and format properly
      const content = stripHtml(section.content);
      const paragraphs = content.split('\n\n').filter(p => p.trim());
      
      paragraphs.forEach(para => {
        docSections.push(
          new Paragraph({
            text: para.trim(),
            spacing: { after: 200 },
            alignment: AlignmentType.JUSTIFIED
          })
        );
      });

      // Add separator between sections
      docSections.push(
        new Paragraph({
          text: "",
          spacing: { before: 200, after: 200 }
        })
      );
    }
  });

  // Add any additional sections not in standard order
  sections.forEach(section => {
    if (!sectionOrder.includes(section.section_type)) {
      const title = section.section_type.toUpperCase().replace('_', ' ');
      
      docSections.push(
        new Paragraph({
          text: title,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        })
      );

      const content = stripHtml(section.content);
      const paragraphs = content.split('\n\n').filter(p => p.trim());
      
      paragraphs.forEach(para => {
        docSections.push(
          new Paragraph({
            text: para.trim(),
            spacing: { after: 200 },
            alignment: AlignmentType.JUSTIFIED
          })
        );
      });
    }
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: docSections
    }]
  });

  // Generate buffer with validation
  let bufAny = await Packer.toBuffer(doc);
  let uint8 = bufAny instanceof Uint8Array ? new Uint8Array(bufAny) : new Uint8Array(bufAny);
  
  // Validate PK (zip) header for valid DOCX
  if (uint8.length < 2 || uint8[0] !== 0x50 || uint8[1] !== 0x4B) {
    console.warn('DOCX buffer missing PK header, falling back to toBlob');
    const blob = await Packer.toBlob(doc);
    const ab = await blob.arrayBuffer();
    uint8 = new Uint8Array(ab);
  }
  
  return uint8;
}

function stripHtml(html: string): string {
  if (!html) return '';
  
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&mdash;/g, '—');
  text = text.replace(/&ndash;/g, '–');
  // Remove multiple spaces
  text = text.replace(/\s+/g, ' ');
  // Convert multiple newlines to double newline for paragraph breaks
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}
