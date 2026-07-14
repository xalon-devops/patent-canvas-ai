// Shared MPEP retrieval helper for the drafting pipeline agents.
// Embeds a query via Lovable AI Gateway and returns top-k MPEP passages.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const EMBED_MODEL = "google/gemini-embedding-001";

export interface MpepChunk {
  section_number: string;
  section_title: string;
  chunk_text: string;
  source_url: string | null;
  similarity: number;
}

export async function embedQuery(apiKey: string, text: string): Promise<number[]> {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding failed ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.data?.[0]?.embedding ?? [];
}

export async function retrieveMpep(
  apiKey: string,
  supabase: ReturnType<typeof createClient>,
  query: string,
  opts: { k?: number; sectionFilter?: string } = {},
): Promise<MpepChunk[]> {
  try {
    const embedding = await embedQuery(apiKey, query);
    if (embedding.length === 0) return [];
    const { data, error } = await supabase.rpc("match_mpep_chunks", {
      query_embedding: embedding,
      match_count: opts.k ?? 4,
      section_filter: opts.sectionFilter ?? null,
    });
    if (error) {
      console.error("MPEP retrieval error:", error);
      return [];
    }
    return (data ?? []) as MpepChunk[];
  } catch (err) {
    console.error("MPEP retrieval exception:", err);
    return []; // Fail open — pipeline still runs without RAG grounding
  }
}

export function formatMpepContext(chunks: MpepChunk[]): string {
  if (chunks.length === 0) return "";
  return chunks
    .map(
      (c, i) =>
        `[MPEP §${c.section_number} — ${c.section_title}]\n${c.chunk_text.trim()}`,
    )
    .join("\n\n---\n\n");
}
