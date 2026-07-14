
## Goal
Replace the 27-chunk seed with a real, examiner-grade knowledge base: full text of the MPEP chapters that patent agents actually cite, plus landmark Federal Circuit case headnotes. Target: **~3,000–5,000 chunks**.

## What gets ingested

**MPEP chapters (from mpep.uspto.gov via Firecrawl):**
- Chapter 600 — Parts, Form, and Content of Application (spec/claims/drawings)
- Chapter 700 — Examination of Applications (rejections, responses)
- Chapter 1200 — Appeal
- Chapter 2100 — Patentability (§101/102/103/112) ← most cited
- Chapter 2600 — Optional Inter Partes Reexam
- Appendix R — Patent Rules (37 CFR)

**Landmark case headnotes (curated file, ~40 cases):**
- §101: Alice, Mayo, Bilski, Diamond v. Diehr, Enfish, McRO
- §103: KSR, Graham v. Deere, In re Kubin
- §112: Nautilus (definiteness), Ariad (written description), Wands (enablement)
- Claim construction: Phillips v. AWH, Markman
- Recent CAFC (2020–2025): representative decisions on eligibility & obviousness

## Architecture

```text
Admin clicks "Build Full MPEP Corpus"
         │
         ▼
ingest-mpep-full edge function (async, resumable)
         │
         ├─ 1. Firecrawl map(mpep.uspto.gov/chapter-X) → URL list
         ├─ 2. Firecrawl batch scrape → markdown per section
         ├─ 3. Parse into paragraph chunks (500–1500 chars, ~200 char overlap)
         ├─ 4. Batch embed (Gemini embedding-001, 100/request)
         └─ 5. Upsert into mpep_chunks (idempotent on section+chunk_index)
         │
         ▼
ingest_jobs table tracks progress → UI polls & shows live counter
```

## New pieces

**Prereq (user action):**
- Connect **Firecrawl** connector (one click). ~$3–8 in Firecrawl credits for the full scrape.

**Database:**
- New `ingest_jobs` table (job_id, status, total, completed, failed, current_step, error_log, timestamps) for resumable progress + realtime UI updates.

**Edge functions:**
- `ingest-mpep-full` — orchestrator: maps chapters, queues scrape batches, chunks, batch-embeds, inserts. Chunked into stages so it never hits wall-clock limits; each invocation processes one stage and updates the job row. Retriable per-chunk.
- `landmark-cases-seed` file (~40 curated case headnotes with holdings + statutory hook) ingested alongside.

**Frontend (admin only):**
- Upgrade `MpepKnowledgeBaseCard` on `/admin`:
  - "Build Full MPEP Corpus" button
  - Live progress bar (subscribed via Supabase Realtime to `ingest_jobs`)
  - Per-chapter breakdown (Chapter 2100: 892/892 ✓)
  - Retry-failed-chunks button
  - Current corpus stats (total chunks, chapters covered, last refreshed)

**Chunking strategy:**
- Split on paragraph boundaries first
- Merge adjacent paragraphs until 800–1200 chars
- Prepend section header (e.g. "MPEP § 2106.04(a) — Abstract Ideas") to every chunk so retrieved snippets are self-labeling
- Store `section_number`, `section_title`, `chunk_index`, `source_url`

**Embedding batching:**
- Gemini `embedding-001` accepts up to 100 inputs per request → ~30–50 batch requests total for the full corpus instead of thousands of one-off calls
- Preserves order via `data[].index`
- Failed batches retried with exponential backoff

**Retrieval upgrade (already wired, no change needed):**
- `_shared/mpep-rag.ts` already queries `mpep_chunks` — will automatically get better hits once corpus grows

## Cost / time
- Firecrawl scraping: ~$3–8 (one-time)
- Gemini embeddings: ~$1–3 in Lovable credits (one-time)
- Wall time: ~10–20 min end-to-end (async, user can close tab)
- Storage: ~50 MB in Supabase (well under free tier)

## Out of scope
- PTAB decisions and full CAFC docket (overkill; landmark headnotes cover 95% of what agents cite)
- Auto-refresh cron (MPEP updates ~yearly; manual refresh button is enough)

## User action required before I build
1. Approve this plan
2. Connect Firecrawl when I prompt (I'll trigger the connector flow)
