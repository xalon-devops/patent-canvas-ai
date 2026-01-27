import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { section_type, content } = await req.json();

    if (!section_type || !content) {
      return new Response(
        JSON.stringify({ error: 'section_type and content are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI analysis failed');
    }

    const aiData = await response.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No analysis generated');
    }

    // Extract JSON from the response
    let analysis;
    try {
      // Try to extract JSON from markdown code blocks or raw JSON
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/) || 
                        aiContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiContent;
      analysis = JSON.parse(jsonStr.trim());
    } catch (parseError) {
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

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing section quality:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
