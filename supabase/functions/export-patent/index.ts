import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.52.1';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, UnderlineType } from 'npm:docx@8.5.0';

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
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const requestBody = await req.json();
    const { session_id } = requestBody;
    
    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'session_id is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin - admins bypass payment requirements
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .single();

    const adminEmail = 'nash@kronoscapital.us';
    const isAdminEmail = (userData.user.email || '').toLowerCase() === adminEmail;
    const isAdmin = !!adminRole || isAdminEmail;
    console.log('User admin status:', { userId: userData.user.id, email: userData.user.email, isAdmin, viaEmail: isAdminEmail });

    // Check payment status (bypass for admins)
    if (!isAdmin) {
      const { data: payment } = await supabase
        .from('application_payments')
        .select('status')
        .eq('application_id', session_id)
        .eq('user_id', userData.user.id)
        .single();

      if (!payment || payment.status !== 'completed') {
        return new Response(
          JSON.stringify({ 
            error: 'Payment required',
            message: 'Please complete the $1,000 payment to export your patent application'
          }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.log('Admin user - bypassing payment check');
    }

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

    // Generate DOCX content as a Uint8Array
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

    // Create a short-lived signed URL to ensure reliable binary download
    const { data: signed } = await supabase.storage
      .from('patent-docs')
      .createSignedUrl(fileName, 60, {
        download: 'Patent Application.docx'
      });

    if (!signed?.signedUrl) {
      console.error('Failed to create signed URL');
      return new Response(
        JSON.stringify({ error: 'Failed to prepare download link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Patent document generated and uploaded successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        download_url: signed.signedUrl,
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

  const docSections: Paragraph[] = [];

  // Title Page
  docSections.push(
    new Paragraph({
      text: "PATENT APPLICATION",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }),
    new Paragraph({
      text: `Title: ${session.idea_prompt}`,
      spacing: { after: 200 }
    }),
    new Paragraph({
      text: `Filing Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
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
    if (section) {
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

  // Add sections
  sectionOrder.forEach((sectionType) => {
    const section = sections.find(s => s.section_type === sectionType);
    if (section) {
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

      // Add separator
      docSections.push(
        new Paragraph({
          text: "=".repeat(60),
          spacing: { before: 200, after: 200 }
        })
      );
    }
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: docSections
    }]
  });

  // Generate using toBuffer; validate magic header; fallback to toBlob if needed
  let bufAny = await Packer.toBuffer(doc);
  let uint8 = bufAny instanceof Uint8Array ? new Uint8Array(bufAny) : new Uint8Array(bufAny);
  // Validate PK (zip) header
  if (uint8.length < 2 || uint8[0] !== 0x50 || uint8[1] !== 0x4B) {
    console.warn('DOCX buffer missing PK header, falling back to toBlob');
    const blob = await Packer.toBlob(doc);
    const ab = await blob.arrayBuffer();
    uint8 = new Uint8Array(ab);
  }
  return uint8;
}

function stripHtml(html: string): string {
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  // Remove multiple spaces
  text = text.replace(/\s+/g, ' ');
  return text.trim();
}