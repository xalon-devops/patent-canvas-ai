import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1'

import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson,
  requireSessionAccess, requireApplicationEntitlement, HttpError, sectionContentForExport,
} from '../_shared/http.ts';

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    console.log('File patent function started');

    const caller = await authenticate(req);
    const supabase = caller.admin;
    const { session_id: rawSessionId } = await readJson<{ session_id?: string }>(req, 64_000);

    // Ownership (owner or admin), then paid entitlement for this application
    const session = await requireSessionAccess(caller, rawSessionId, 'id, user_id, status, title, idea_prompt');
    const session_id: string = session.id;
    await requireApplicationEntitlement(caller, session_id);

    // Fetch patent sections
    console.log('Fetching patent sections for session:', session_id);
    const { data: rawSections, error: sectionsError } = await supabase
      .from('patent_sections')
      .select('section_type, content, created_at')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (sectionsError) {
      console.error('Error fetching sections:', sectionsError);
      throw new HttpError(500, 'Failed to fetch patent sections');
    }

    // Keep only the newest non-empty row per section type (no UNIQUE constraint on section_type)
    const latestByType = new Map<string, any>();
    for (const sec of rawSections ?? []) {
      if (sec.content && String(sec.content).trim()) latestByType.set(sec.section_type, sec);
    }
    const sections = Array.from(latestByType.values());

    if (sections.length === 0) {
      throw new HttpError(409, 'No patent sections found. Generate your draft before filing.');
    }
    if (!latestByType.has('claims')) {
      throw new HttpError(409, 'Your application needs a Claims section before it can be filed.');
    }

    // Combine sections into full patent text with markdown headers
    const sectionOrder = ['abstract', 'field', 'background', 'summary', 'claims', 'drawings', 'description'];
    let fullPatentText = '';

    sectionOrder.forEach(sectionType => {
      const section = sections.find(s => s.section_type === sectionType);
      if (section) {
        const headerLevel = sectionType === 'abstract' ? '## ' : '### ';
        const title = sectionType.charAt(0).toUpperCase() + sectionType.slice(1).replace('_', ' ');
        fullPatentText += `${headerLevel}${title}\n\n${toPlainText(sectionContentForExport(section.section_type, section.content))}\n\n`;
      }
    });

    // Add any remaining sections not in the standard order
    sections.forEach(section => {
      if (!sectionOrder.includes(section.section_type)) {
        const title = section.section_type.charAt(0).toUpperCase() + section.section_type.slice(1).replace('_', ' ');
        fullPatentText += `### ${title}\n\n${toPlainText(sectionContentForExport(section.section_type, section.content))}\n\n`;
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
            <p><strong>Title:</strong> ${escapeHtml(String(session.title || session.idea_prompt || 'Untitled Invention').slice(0, 300))}</p>
            <p><strong>Session ID:</strong> ${session_id}</p>
            <p><strong>Filed:</strong> ${new Date().toISOString().split('T')[0]}</p>
          </div>
          ${escapeHtml(fullPatentText).replace(/\n/g, '<br>').replace(/### (.*?)<br>/g, '<h3>$1</h3>').replace(/## (.*?)<br>/g, '<h2>$1</h2>')}
        </body>
      </html>
    `;

    // Convert HTML to PDF using a simple PDF generation approach
    // For a more robust solution, you might want to use a dedicated PDF library
    const pdfBytes = new TextEncoder().encode(htmlContent);
    const fileName = `patent-${session_id}-${Date.now()}.html`;

    // Upload to new patent-docs bucket with filing bundle
    console.log('Creating patent filing bundle');
    // patent-docs paths must start with the owner's uid so the owner can read them via RLS
    const baseDir = `${session.user_id}/${session_id}/filing-bundle`;
    
    // Generate USPTO forms
    const sb16Form = generateSB16Form(session_id);
    const adsForm = generateADSForm(session_id);
    const claimsMap = generateClaimsMap(sections);
    
    // Upload bundle files
    const uploads = await Promise.all([
      // Main application
      supabase.storage.from('patent-docs').upload(
        `${baseDir}/patent-application.html`, 
        pdfBytes, 
        { contentType: 'text/html', upsert: true }
      ),
      // USPTO forms
      supabase.storage.from('patent-docs').upload(
        `${baseDir}/sb16-form.txt`, 
        new TextEncoder().encode(sb16Form), 
        { contentType: 'text/plain', upsert: true }
      ),
      supabase.storage.from('patent-docs').upload(
        `${baseDir}/ads-form.txt`, 
        new TextEncoder().encode(adsForm), 
        { contentType: 'text/plain', upsert: true }
      ),
      supabase.storage.from('patent-docs').upload(
        `${baseDir}/claims-map.txt`, 
        new TextEncoder().encode(claimsMap), 
        { contentType: 'text/plain', upsert: true }
      )
    ]);

    // Check for upload errors
    const uploadErrors = uploads.filter(u => u.error);
    if (uploadErrors.length > 0) {
      console.error('Upload errors:', uploadErrors.map(u => u.error?.message));
      throw new HttpError(500, 'Failed to upload patent filing bundle');
    }

    // patent-docs is a private bucket, so a public URL would 400. Issue a signed URL instead.
    const { data: urlData, error: signError } = await supabase.storage
      .from('patent-docs')
      .createSignedUrl(`${baseDir}/patent-application.html`, 60 * 60 * 24 * 365);

    if (signError || !urlData?.signedUrl) {
      console.error('Failed to sign download URL:', signError);
      throw new HttpError(500, 'Failed to create download link');
    }

    const downloadUrl = urlData.signedUrl;

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
      console.error('Error updating session status:', updateError);
      throw new HttpError(500, 'Your filing bundle was created but the application status could not be updated. Please try again.');
    }

    console.log('Patent filing completed successfully');

    return jsonResponse({
      success: true,
      status: 'filed',
      download_url: downloadUrl,
      file_name: fileName
    });

  } catch (error) {
    return errorResponse(error, 'Failed to file patent', 'file-patent');
  }
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toPlainText(html: string | null | undefined): string {
  return String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|h[1-6]|li|tr)\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function generateSB16Form(sessionId: string): string {
  return `USPTO FORM SB/16 - APPLICATION DATA SHEET

Application Number: [To be assigned by USPTO]
Filing Date: ${new Date().toLocaleDateString()}
Attorney Docket Number: ${sessionId.substring(0, 8).toUpperCase()}

APPLICANT INFORMATION:
[To be completed by inventor]
Name: 
Address: 
Phone: 
Email: 

CORRESPONDENCE ADDRESS:
[To be completed by inventor or attorney]

APPLICATION TYPE: Provisional Patent Application

DECLARATION: 
I hereby declare that all statements made herein of my own knowledge are true and that all statements made on information and belief are believed to be true.

Generated by AI Patent Assistant
Date: ${new Date().toISOString()}
`;
}

function generateADSForm(sessionId: string): string {
  return `USPTO FORM ADS - APPLICATION DATA SHEET

I. APPLICATION INFORMATION
Attorney Docket Number: ${sessionId.substring(0, 8).toUpperCase()}
Application Type: Provisional Patent Application

II. APPLICANT INFORMATION
☐ Inventor
☐ Legal Representative of Deceased Inventor
☐ Assignee

[To be completed by inventor]
Given Name: 
Family Name: 
Residence City: 
Residence State: 
Residence Country: 
Mailing Address: 

III. CORRESPONDENCE INFORMATION
☐ Customer Number
☐ Firm or Individual Name
☐ Address

IV. APPLICATION ELEMENTS
☑ Specification (Number of pages: [Auto-generated])
☑ Claims (Number of claims: [Auto-generated])
☐ Drawings (Number of sheets: [If applicable])
☑ Abstract

V. FILING INFORMATION
Filing Date: ${new Date().toLocaleDateString()}
Generated by: AI Patent Assistant
System ID: ${sessionId}

Generated on: ${new Date().toISOString()}
`;
}

function generateClaimsMap(sections: any[]): string {
  const claimsSection = sections.find(s => s.section_type === 'claims');
  
  let claimsMap = `CLAIMS MAP AND STRUCTURAL ANALYSIS

Generated: ${new Date().toISOString()}

PURPOSE: This document provides a structural analysis of the patent claims 
to assist in understanding claim dependencies and relationships.

CLAIM STRUCTURE ANALYSIS:
`;

  if (claimsSection) {
    const lines = toPlainText(claimsSection.content).split('\n').filter((line: string) => line.trim());
    let independentClaims = 0;
    let dependentClaims = 0;
    const claimAnalysis: string[] = [];

    lines.forEach((line: string) => {
      const trimmedLine = line.trim();
      const match = trimmedLine.match(/^(\d+)\.\s+(.+)/);
      
      if (match) {
        const number = match[1];
        const content = match[2];
        
        // Analyze if claim is dependent
        if (content.toLowerCase().includes('claim') && 
            (content.toLowerCase().includes('wherein') || 
             content.toLowerCase().includes('of claim'))) {
          dependentClaims++;
          claimAnalysis.push(`Claim ${number}: DEPENDENT CLAIM`);
          
          // Try to find what it depends on
          const dependsMatch = content.match(/claim\s+(\d+)/i);
          if (dependsMatch) {
            claimAnalysis.push(`  └─ Depends on Claim ${dependsMatch[1]}`);
          }
        } else {
          independentClaims++;
          claimAnalysis.push(`Claim ${number}: INDEPENDENT CLAIM`);
        }
        
        claimAnalysis.push(`  └─ Content preview: ${content.substring(0, 80)}...`);
        claimAnalysis.push('');
      }
    });

    claimsMap += claimAnalysis.join('\n');
    claimsMap += `\nCLAIM STATISTICS:
- Total Claims: ${independentClaims + dependentClaims}
- Independent Claims: ${independentClaims}
- Dependent Claims: ${dependentClaims}
- Claim Scope: ${independentClaims > 1 ? 'Multiple invention aspects' : 'Single invention focus'}

FULL CLAIMS TEXT:
${'-'.repeat(50)}
${claimsSection.content}
${'-'.repeat(50)}
`;
  } else {
    claimsMap += '\n❌ ERROR: No claims section found in patent application.\n';
    claimsMap += 'Claims are required for a valid patent application.\n';
  }

  claimsMap += `\nFILE INFORMATION:
- Generated by: AI Patent Assistant
- Export Date: ${new Date().toLocaleDateString()}
- Export Time: ${new Date().toLocaleTimeString()}
- Document Type: Claims Analysis Map
`;

  return claimsMap;
}