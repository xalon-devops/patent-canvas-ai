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
    console.log('File patent function started');
    
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

    // Combine sections into full patent text with markdown headers
    const sectionOrder = ['abstract', 'field', 'background', 'summary', 'claims', 'drawings', 'description'];
    let fullPatentText = '';

    sectionOrder.forEach(sectionType => {
      const section = sections.find(s => s.section_type === sectionType);
      if (section) {
        const headerLevel = sectionType === 'abstract' ? '## ' : '### ';
        const title = sectionType.charAt(0).toUpperCase() + sectionType.slice(1).replace('_', ' ');
        fullPatentText += `${headerLevel}${title}\n\n${section.content}\n\n`;
      }
    });

    // Add any remaining sections not in the standard order
    sections.forEach(section => {
      if (!sectionOrder.includes(section.section_type)) {
        const title = section.section_type.charAt(0).toUpperCase() + section.section_type.slice(1).replace('_', ' ');
        fullPatentText += `### ${title}\n\n${section.content}\n\n`;
      }
    });

    console.log('Generated full patent text, length:', fullPatentText.length);

    // Create HTML content for PDF conversion
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Patent Application</title>
          <style>
            body {
              font-family: 'Times New Roman', serif;
              font-size: 12pt;
              line-height: 1.6;
              margin: 1in;
              color: #000;
            }
            h1, h2 { 
              color: #000; 
              margin-top: 24pt;
              margin-bottom: 12pt;
            }
            h3 { 
              color: #000; 
              margin-top: 18pt; 
              margin-bottom: 6pt;
            }
            p { 
              margin-bottom: 12pt; 
              text-align: justify;
            }
            .header {
              text-align: center;
              margin-bottom: 36pt;
              border-bottom: 2px solid #000;
              padding-bottom: 12pt;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>UTILITY PATENT APPLICATION</h1>
            <p><strong>Session ID:</strong> ${session_id}</p>
            <p><strong>Filed:</strong> ${new Date().toISOString().split('T')[0]}</p>
          </div>
          ${fullPatentText.replace(/\n/g, '<br>').replace(/### (.*?)<br>/g, '<h3>$1</h3>').replace(/## (.*?)<br>/g, '<h2>$1</h2>')}
        </body>
      </html>
    `;

    // Convert HTML to PDF using a simple PDF generation approach
    // For a more robust solution, you might want to use a dedicated PDF library
    const pdfBytes = new TextEncoder().encode(htmlContent);
    const fileName = `patent-${session_id}-${Date.now()}.html`;

    // Upload to Supabase Storage
    console.log('Uploading patent file to storage');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('patents')
      .upload(fileName, pdfBytes, {
        contentType: 'text/html',
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Error uploading to storage:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload patent file' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('patents')
      .getPublicUrl(fileName);

    const downloadUrl = urlData.publicUrl;

    // Update patent session with download URL and status
    console.log('Updating patent session status');
    const { error: updateError } = await supabase
      .from('patent_sessions')
      .update({ 
        status: 'filed',
        download_url: downloadUrl
      })
      .eq('id', session_id);

    if (updateError) {
      console.warn('Error updating session status:', updateError);
    }

    console.log('Patent filing completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        download_url: downloadUrl,
        file_name: fileName
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error in file-patent function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});