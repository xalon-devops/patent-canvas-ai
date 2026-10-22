import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  handleCors, jsonResponse, errorResponse, authenticate, readJson, HttpError,
  fetchWithTimeout, aiGatewayError, parseModelJson,
} from "../_shared/http.ts";

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    // Signed-in user (or service role) required
    await authenticate(req);
    const body = await readJson<{ content?: unknown; sectionType?: unknown }>(req, 600_000);
    const content = typeof body.content === "string" ? body.content.slice(0, 80_000) : "";
    const sectionType = typeof body.sectionType === "string" ? body.sectionType.slice(0, 50) : "";

    if (!content.trim()) {
      throw new HttpError(400, "Content is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new HttpError(500, "AI service is not configured.");
    }

    const systemPrompt = `You are a patent terminology expert. Analyze the provided patent application text and:

1. Identify all technical terms, acronyms, and specialized vocabulary
2. Provide clear definitions for each term
3. Suggest standardized USPTO/EPO terminology alternatives where applicable
4. Flag any ambiguous or non-standard usage

Return a JSON response with this exact structure:
{
  "terms": [
    {
      "term": "the technical term",
      "definition": "clear definition of the term",
      "standardTerm": "USPTO/EPO standardized equivalent if different, or null",
      "category": "one of: acronym, technical, legal, scientific, industry-specific",
      "usage": "how the term is used in the context",
      "recommendation": "suggestion for improvement or null if term usage is appropriate"
    }
  ],
  "summary": {
    "totalTerms": number,
    "needsStandardization": number,
    "categories": { "category": count }
  }
}

Focus on terms that:
- Are technical or scientific in nature
- May have specific legal meanings in patent law
- Could benefit from standardization
- Are acronyms that need expansion
- Are industry-specific jargon`;

    const response = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Analyze this ${sectionType || 'patent'} section and extract all technical terms with definitions and standardization suggestions:\n\n${content}` 
          }
        ],
        temperature: 0.3,
      }),
    }, 90_000);

    if (!response.ok) throw await aiGatewayError(response, "extract-patent-glossary");

    const data = await response.json().catch(() => null);
    const analysisText = data?.choices?.[0]?.message?.content || "";

    let glossary: any = parseModelJson(analysisText);
    if (!glossary || typeof glossary !== "object" || Array.isArray(glossary)) {
      console.error("Failed to parse glossary response:", String(analysisText).slice(0, 300));
      glossary = {
        terms: [],
        summary: { totalTerms: 0, needsStandardization: 0, categories: {} },
        error: "Failed to parse AI response"
      };
    }
    if (!Array.isArray(glossary.terms)) glossary.terms = [];
    if (!glossary.summary || typeof glossary.summary !== "object") {
      glossary.summary = { totalTerms: glossary.terms.length, needsStandardization: 0, categories: {} };
    }

    return jsonResponse(glossary);

  } catch (error) {
    return errorResponse(error, "Glossary extraction failed", "extract-patent-glossary");
  }
});
