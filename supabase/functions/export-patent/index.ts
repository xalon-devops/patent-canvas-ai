import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, UnderlineType } from 'https://esm.sh/docx@8.5.0';

import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson,
  requireSessionAccess, requireApplicationEntitlement, HttpError, sectionContentForExport,
} from '../_shared/http.ts';

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    console.log('Export patent function started');

    const caller = await authenticate(req);
    const supabase = caller.admin;

    const body = await readJson<{ session_id?: string }>(req, 64_000);

    // Ownership (owner or admin) before anything else
    const session = await requireSessionAccess(caller, body.session_id);

    // Entitlement: admin, free_grant, or completed $1,000 payment for this application
    await requireApplicationEntitlement(caller, session.id);

    const { data: sections, error: sectionsError } = await supabase
      .from('patent_sections')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });

    if (sectionsError) {
      console.error('Error fetching sections:', sectionsError);
      throw new HttpError(500, 'Failed to fetch patent sections');
    }
    if (!sections || sections.length === 0) {
      throw new HttpError(409, 'This application has no drafted sections to export yet.');
    }

    // Generate DOCX content as a Uint8Array
    const docxContent = await generatePatentDOCX(session, sections);
    const session_id = session.id;
    
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
      throw new HttpError(500, 'Failed to upload document');
    }

    // Create a short-lived signed URL to ensure reliable binary download
    const { data: signed } = await supabase.storage
      .from('patent-docs')
      .createSignedUrl(fileName, 60 * 60, {
        download: 'Patent Application.docx'
      });

    if (!signed?.signedUrl) {
      console.error('Failed to create signed URL');
      throw new HttpError(500, 'Failed to prepare download link');
    }

    console.log('Patent document generated and uploaded successfully');

    return jsonResponse({
      success: true,
      download_url: signed.signedUrl,
      file_path: fileName,
      sections_exported: sections.length
    });

  } catch (error) {
    return errorResponse(error, 'Failed to export patent', 'export-patent');
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
      text: `Title: ${(session.title || session.idea_prompt || 'Untitled Invention').toString().slice(0, 300)}`,
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
    const section = latestSection(sections, sectionType);
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
    const section = latestSection(sections, sectionType);
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
      const content = stripHtml(sectionContentForExport(section.section_type, section.content));
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

function latestSection(sections: any[], sectionType: string): any | undefined {
  // Sections are ordered oldest-first; if duplicates exist, export the newest.
  const matches = sections.filter(s => s.section_type === sectionType && s.content);
  return matches[matches.length - 1];
}

function stripHtml(html: string | null | undefined): string {
  let text = (html || '')
    // Preserve paragraph / line structure before stripping tags
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|h[1-6]|li|tr)\s*>/gi, '\n\n');
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, '');
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&amp;/g, '&');
  // Collapse runs of spaces/tabs but keep newlines so paragraphs survive
  text = text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n');
  return text.trim();
}
