import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, sectionType } = await req.json();

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.choices?.[0]?.message?.content || "";

    // Extract JSON from the response
    let glossary;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        glossary = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse glossary response:", parseError);
      glossary = {
        terms: [],
        summary: { totalTerms: 0, needsStandardization: 0, categories: {} },
        error: "Failed to parse AI response"
      };
    }

    return new Response(
      JSON.stringify(glossary),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Glossary extraction error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
