import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'https://esm.sh/docx@8.5.0';

import {
  handleCors, errorResponse, authenticate, readJson, corsHeaders,
  requireSessionAccess, requireApplicationEntitlement, HttpError, sectionContentForExport,
} from '../_shared/http.ts';

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    console.log('Download DOCX function started');

    const caller = await authenticate(req);
    const supabase = caller.admin;
    const { session_id } = await readJson<{ session_id?: string }>(req, 64_000);

    // Ownership (owner or admin), then paid entitlement for this application
    const session = await requireSessionAccess(caller, session_id, 'id, idea_prompt, title, user_id');
    await requireApplicationEntitlement(caller, session.id);

    const { data: sections, error: sectionsError } = await supabase
      .from('patent_sections')
      .select('section_type, content, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });

    if (sectionsError) {
      console.error('Error fetching sections:', sectionsError);
      throw new HttpError(500, 'Failed to fetch patent sections');
    }
    if (!sections || sections.length === 0) {
      throw new HttpError(409, 'No patent sections found');
    }

    const docxContent = await generatePatentDOCX(session, sections);
    console.log('Generated DOCX document successfully');

    // NOTE: application/octet-stream makes supabase-js `functions.invoke` return a Blob.
    // Any other non-JSON content type is read as text and corrupts the binary.
    return new Response(docxContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="Patent-Application-${String(session.id).substring(0, 8)}.docx"`,
        'Access-Control-Expose-Headers': 'Content-Disposition',
      },
    });

  } catch (error) {
    return errorResponse(error, 'Failed to generate document', 'download-docx');
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
        new TextRun({ text: String(session.title || session.idea_prompt || 'Untitled Patent Application').slice(0, 300) })
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
    const section = latestSection(sections, sectionType);
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
    const section = latestSection(sections, sectionType);
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
  
  // Preserve paragraph / line structure before stripping tags
  let text = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|h[1-6]|li|tr)\s*>/gi, '\n\n');
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, '');
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&mdash;/g, '—');
  text = text.replace(/&ndash;/g, '–');
  // Collapse runs of spaces/tabs but keep newlines so paragraphs survive
  text = text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n');
  // Convert multiple newlines to double newline for paragraph breaks
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function latestSection(sections: any[], sectionType: string): any | undefined {
  // Sections are ordered oldest-first; if duplicates exist, use the newest non-empty one.
  const matches = sections.filter(s => s.section_type === sectionType && s.content);
  return matches[matches.length - 1];
}
