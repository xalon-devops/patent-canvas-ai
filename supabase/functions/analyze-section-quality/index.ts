import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson, HttpError,
  fetchWithTimeout, aiGatewayError, parseModelJson, sectionContentForExport,
} from '../_shared/http.ts';

const USPTO_GUIDELINES = {
  abstract: {
    maxWords: 150,
    requirements: [
      'Must summarize the invention in a single paragraph',
      'Should state the nature of the invention',
      'Must describe the principal use of the invention',
      'Should avoid legal phraseology like "comprises" or "said"',
      'Must not exceed 150 words'
    ]
  },
  claims: {
    requirements: [
      'Must include at least one independent claim',
      'Dependent claims must reference a prior claim',
      'Claims should use proper antecedent basis ("a" then "the")',
      'Must use transitional phrases (comprising, consisting of)',
      'Should define the invention with clarity and precision',
      'Must be supported by the description'
    ]
  },
  background: {
    requirements: [
      'Should describe the technical field',
      'Must identify problems in the prior art',
      'Should not admit prior art too broadly',
      'Must establish the need for the invention',
      'Should avoid disparaging prior art unnecessarily'
    ]
  },
  summary: {
    requirements: [
      'Must describe the invention as claimed',
      'Should state the objects and advantages',
      'Must be consistent with the claims',
      'Should be brief but comprehensive',
      'Must describe how the invention solves identified problems'
    ]
  },
  description: {
    requirements: [
      'Must enable a person skilled in the art to make and use the invention',
      'Should describe the best mode of carrying out the invention',
      'Must include reference numerals corresponding to drawings',
      'Should describe all claimed elements',
      'Must be clear and complete without ambiguity'
    ]
  },
  field: {
    requirements: [
      'Must identify the technical field of the invention',
      'Should be specific but not overly narrow',
      'Must align with the claims scope'
    ]
  },
  drawings: {
    requirements: [
      'Must include figure descriptions for each drawing',
      'Should reference all major components',
      'Descriptions should be brief but informative'
    ]
  }
};

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    // Signed-in user (or service role) required — the anon key alone is not accepted
    await authenticate(req);

    const body = await readJson<{ section_type?: unknown; content?: unknown }>(req, 600_000);
    const section_type = typeof body.section_type === 'string' ? body.section_type.slice(0, 50) : '';
    // Drawings are stored as JSON with base64 images; analyze only the figure descriptions
    const content = typeof body.content === 'string'
      ? sectionContentForExport(section_type, body.content).slice(0, 60_000)
      : '';

    if (!section_type || !content.trim()) {
      throw new HttpError(400, 'section_type and content are required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new HttpError(500, 'AI service is not configured.');
    }

    const guidelines = USPTO_GUIDELINES[section_type as keyof typeof USPTO_GUIDELINES];
    const requirementsList = guidelines?.requirements?.join('\n- ') || 'General patent quality standards apply';

    const systemPrompt = `You are a USPTO patent examiner expert. Analyze patent sections for quality and compliance with USPTO guidelines. Be constructive and specific in your feedback.`;

    const userPrompt = `Analyze this "${section_type}" section of a patent application for quality and USPTO compliance.

USPTO Requirements for ${section_type}:
- ${requirementsList}

Section Content:
${content}

Provide your analysis as a JSON object with this exact structure:
{
  "score": <number 0-100>,
  "grade": "<A/B/C/D/F>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "issues": [
    {"severity": "high|medium|low", "issue": "<description>", "suggestion": "<how to fix>"}
  ],
  "usptoCompliance": {
    "compliant": <boolean>,
    "missingElements": ["<element 1>"],
    "recommendations": ["<recommendation 1>"]
  }
}

Be specific and actionable. Score 80+ means publication-ready, 60-79 needs minor edits, below 60 needs significant work.`;

    const response = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    }, 60_000);

    if (!response.ok) throw await aiGatewayError(response, 'analyze-section-quality');

    const aiData = await response.json().catch(() => null);
    const aiContent = aiData?.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new HttpError(502, 'No analysis generated. Please try again.');
    }

    // Extract JSON from the response
    let analysis: any = parseModelJson(aiContent);
    if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
      console.error('Failed to parse AI response:', aiContent);
      // Return a fallback analysis
      analysis = {
        score: 70,
        grade: 'C',
        strengths: ['Content is present and structured'],
        issues: [{ severity: 'medium', issue: 'Could not fully analyze', suggestion: 'Review manually' }],
        usptoCompliance: {
          compliant: true,
          missingElements: [],
          recommendations: ['Manual review recommended']
        }
      };
    }

    if (!Array.isArray(analysis.strengths)) analysis.strengths = [];
    if (!Array.isArray(analysis.issues)) analysis.issues = [];
    if (!analysis.usptoCompliance || typeof analysis.usptoCompliance !== 'object') {
      analysis.usptoCompliance = { compliant: false, missingElements: [], recommendations: [] };
    }

    return jsonResponse({ success: true, analysis });

  } catch (error) {
    return errorResponse(error, 'Analysis failed', 'analyze-section-quality');
  }
});
