import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PRIOR-ART-MONITORING] ${step}${detailsStr}`);
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RETRY_MS = 6 * 60 * 60 * 1000; // retry failed runs after 6h
const TIME_BUDGET_MS = 100_000;      // stop starting new searches after ~100s (edge limit ~150s)

type MonitorRow = {
  id: string;
  patent_idea_id: string | null;
  patent_session_id: string | null;
  search_query: string;
  monitoring_data: any;
  next_search_at: string | null;
};

const MONITOR_COLS = "id, patent_idea_id, patent_session_id, search_query, monitoring_data, next_search_at";

/** Resolve the owning user of a monitoring target (idea or session). */
async function resolveOwner(db: SupabaseClient, ideaId: string | null, sessionId: string | null): Promise<string | null> {
  if (ideaId) {
    const { data } = await db.from("patent_ideas").select("user_id").eq("id", ideaId).maybeSingle();
    return data?.user_id ?? null;
  }
  if (sessionId) {
    const { data } = await db.from("patent_sessions").select("user_id").eq("id", sessionId).maybeSingle();
    return data?.user_id ?? null;
  }
  return null;
}

async function hasPaidMonitoring(db: SupabaseClient, userId: string): Promise<boolean> {
  const [{ data: sub }, { data: admin }] = await Promise.all([
    db.from("subscriptions").select("id").eq("user_id", userId).eq("status", "active").maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
  ]);
  return !!sub || !!admin;
}

/**
 * Run one monitoring search and persist results.
 * `authHeader` is forwarded to search-prior-art-enhanced: the user's own JWT for
 * interactive calls, or the service-role key (+ acting_user_id) for scheduled runs.
 */
async function runMonitor(
  db: SupabaseClient,
  opts: {
    ownerId: string;
    ideaId: string | null;
    sessionId: string | null;
    searchQuery: string;
    existing: MonitorRow | null;
    authHeader: string;
    scheduled: boolean;
  },
) {
  const { ownerId, ideaId, sessionId, searchQuery, existing, authHeader, scheduled } = opts;

  const searchResponse = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/search-prior-art-enhanced`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
      body: JSON.stringify({
        search_query: searchQuery,
        session_id: sessionId,
        // Only honoured by search-prior-art-enhanced for service-role callers
        acting_user_id: scheduled ? ownerId : undefined,
        monitoring_run: true,
      }),
    },
  );

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    logStep("Search API error", { status: searchResponse.status, error: errorText.slice(0, 500) });
    let message = `Search failed (${searchResponse.status})`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed?.error) message = parsed.error;
    } catch { /* non-JSON body */ }
    const err = new Error(message) as Error & { status?: number };
    err.status = searchResponse.status;
    throw err;
  }

  const searchResults = await searchResponse.json();
  const results: any[] = Array.isArray(searchResults?.results) ? searchResults.results : [];
  logStep("Search completed", { resultsCount: results.length });

  // similarity_score is 0..0.99 from search-prior-art-enhanced; clamp for DECIMAL(3,2)
  const scoreOf = (r: any) => Math.max(0, Math.min(Number(r?.similarity_score) || 0, 0.99));
  const highestSimilarity = results.length > 0 ? Math.max(...results.map(scoreOf)) : null;

  const previousNumbers = new Set<string>(
    ((existing?.monitoring_data?.last_results ?? []) as any[]).map((r) => r?.publication_number).filter(Boolean),
  );
  const newResults = existing
    ? results.filter((r) => r?.publication_number && !previousNumbers.has(r.publication_number))
    : results;

  const now = new Date();
  const monitoringData = {
    patent_idea_id: ideaId,
    patent_session_id: sessionId,
    search_query: searchQuery,
    results_found: results.length,
    new_results_count: newResults.length,
    highest_similarity_score: highestSimilarity !== null ? Number(highestSimilarity.toFixed(2)) : null,
    last_search_at: now.toISOString(),
    next_search_at: new Date(now.getTime() + WEEK_MS).toISOString(),
    is_active: true,
    monitoring_data: {
      last_results: results.slice(0, 15).map((r: any) => ({
        title: r.title,
        publication_number: r.publication_number,
        similarity_score: scoreOf(r),
        url: r.url ?? null,
      })),
      last_error: null,
    },
  };

  if (existing) {
    const { error } = await db.from("prior_art_monitoring").update(monitoringData).eq("id", existing.id);
    if (error) throw new Error(`Failed to update monitoring record: ${error.message}`);
  } else {
    const { error } = await db.from("prior_art_monitoring").insert(monitoringData);
    if (error) throw new Error(`Failed to create monitoring record: ${error.message}`);
  }

  if (ideaId) {
    await db.from("patent_ideas")
      .update({ last_monitored_at: now.toISOString(), prior_art_monitoring: true })
      .eq("id", ideaId);
  }

  // Alert on a high-similarity result we have not alerted on before for this target
  let alertCreated = false;
  if (highestSimilarity !== null && highestSimilarity > 0.7) {
    const top = results.find((r: any) => scoreOf(r) === highestSimilarity);
    const pubNo = top?.publication_number ?? null;

    let alreadyAlerted = false;
    if (pubNo) {
      let q = db.from("infringement_alerts").select("id").eq("metadata->>publication_number", pubNo).limit(1);
      q = ideaId ? q.eq("patent_idea_id", ideaId) : q.eq("patent_session_id", sessionId);
      const { data: prior } = await q;
      alreadyAlerted = !!prior && prior.length > 0;
    }

    if (!alreadyAlerted) {
      const { error: alertError } = await db.from("infringement_alerts").insert({
        patent_idea_id: ideaId,
        patent_session_id: sessionId,
        alert_type: "similar_filing", // CHECK: potential_infringement | similar_filing | competitive_analysis
        severity: highestSimilarity > 0.85 ? "critical" : "high",
        title: `High similarity detected: ${String(top?.title || "Unknown patent").slice(0, 200)}`,
        description: `Found patent with ${Math.round(highestSimilarity * 100)}% similarity to your invention. Review recommended before filing.`,
        confidence_score: Number(highestSimilarity.toFixed(2)),
        source_url: top?.url || null,
        is_read: false,
        metadata: { publication_number: pubNo, detected_at: now.toISOString() },
      });
      if (alertError) {
        logStep("Failed to create alert", { error: alertError.message });
      } else {
        alertCreated = true;
        // Notify owner (send-notification-email honours users.email_preferences.prior_art_alert)
        fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
          },
          body: JSON.stringify({ user_id: ownerId, type: "prior_art_alert", session_id: sessionId }),
        }).catch((e) => logStep("Alert email failed", { error: String(e) }));
      }
    }
  }

  return {
    resultsFound: results.length,
    newResults: newResults.length,
    highestSimilarity,
    nextSearchAt: monitoringData.next_search_at,
    alertCreated,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey, { auth: { persistSession: false } });

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ success: false, error: "Please sign in to continue." }, 401);

  const isService = !!serviceKey && token === serviceKey;
  let callerId: string | null = null;
  if (!isService) {
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return json({ success: false, error: "Your session has expired. Please sign in again." }, 401);
    callerId = u.user.id;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { ideaId = null, sessionId = null, monitoringId = null } = body ?? {};
    const searchQuery: string | undefined = typeof body?.searchQuery === "string" ? body.searchQuery.trim().slice(0, 2000) : undefined;
    const hasTarget = !!(ideaId || sessionId || monitoringId);

    // ---------------------------------------------------------------------
    // Batch mode: process due rows (is_active, next_search_at <= now).
    //  - service-role caller (pg_cron): all users' due rows, subscribers only
    //  - signed-in user: only that user's due rows
    // ---------------------------------------------------------------------
    if (!hasTarget) {
      const startedAt = Date.now();
      const limit = Math.min(Math.max(Number(body?.limit) || (isService ? 5 : 3), 1), isService ? 20 : 10);
      const nowIso = new Date().toISOString();

      let candidates: MonitorRow[] = [];
      if (isService) {
        const { data, error } = await db.from("prior_art_monitoring")
          .select(MONITOR_COLS)
          .eq("is_active", true)
          .or(`next_search_at.is.null,next_search_at.lte.${nowIso}`)
          .order("next_search_at", { ascending: true, nullsFirst: true })
          .limit(limit * 3); // headroom for rows skipped (unpaid / orphaned / lost claim)
        if (error) throw new Error(error.message);
        candidates = (data ?? []) as MonitorRow[];
      } else {
        const [{ data: ideas }, { data: sessions }] = await Promise.all([
          db.from("patent_ideas").select("id").eq("user_id", callerId!),
          db.from("patent_sessions").select("id").eq("user_id", callerId!),
        ]);
        const ideaIds = (ideas ?? []).map((r: any) => r.id);
        const sessionIds = (sessions ?? []).map((r: any) => r.id);
        const ors: string[] = [];
        if (ideaIds.length) ors.push(`patent_idea_id.in.(${ideaIds.join(",")})`);
        if (sessionIds.length) ors.push(`patent_session_id.in.(${sessionIds.join(",")})`);
        if (ors.length) {
          const { data, error } = await db.from("prior_art_monitoring")
            .select(MONITOR_COLS)
            .eq("is_active", true)
            .or(ors.join(","))
            .order("next_search_at", { ascending: true, nullsFirst: true })
            .limit(200);
          if (error) throw new Error(error.message);
          candidates = ((data ?? []) as MonitorRow[])
            .filter((r) => !r.next_search_at || new Date(r.next_search_at).getTime() <= Date.now())
            .slice(0, limit);
        }
      }

      const summary = { processed: 0, skipped: 0, failed: 0, remainingDue: 0, results: [] as any[] };
      const paidCache = new Map<string, boolean>();

      for (const row of candidates) {
        if (summary.processed + summary.failed >= limit || Date.now() - startedAt > TIME_BUDGET_MS) {
          summary.remainingDue++;
          continue;
        }

        // Claim the row (optimistic lock on next_search_at) so overlapping cron runs
        // never search the same row twice.
        const claimUntil = new Date(Date.now() + RETRY_MS).toISOString();
        let claim = db.from("prior_art_monitoring").update({ next_search_at: claimUntil }).eq("id", row.id);
        claim = row.next_search_at ? claim.eq("next_search_at", row.next_search_at) : claim.is("next_search_at", null);
        const { data: claimed } = await claim.select("id");
        if (!claimed || claimed.length === 0) continue;

        const ownerId = await resolveOwner(db, row.patent_idea_id, row.patent_session_id);
        if (!ownerId || (!isService && ownerId !== callerId)) {
          // Orphaned target - deactivate so it stops being picked up
          if (!ownerId) await db.from("prior_art_monitoring").update({ is_active: false }).eq("id", row.id);
          summary.skipped++;
          continue;
        }

        if (isService) {
          if (!paidCache.has(ownerId)) paidCache.set(ownerId, await hasPaidMonitoring(db, ownerId));
          if (!paidCache.get(ownerId)) {
            // Scheduled monitoring is a subscriber feature: don't burn free credits.
            await db.from("prior_art_monitoring")
              .update({ next_search_at: new Date(Date.now() + WEEK_MS).toISOString() })
              .eq("id", row.id);
            summary.skipped++;
            continue;
          }
        }

        try {
          const r = await runMonitor(db, {
            ownerId,
            ideaId: row.patent_idea_id,
            sessionId: row.patent_session_id,
            searchQuery: row.search_query,
            existing: row,
            authHeader: isService ? `Bearer ${serviceKey}` : authHeader,
            scheduled: isService,
          });
          summary.processed++;
          summary.results.push({ id: row.id, ...r });
        } catch (e) {
          summary.failed++;
          const msg = e instanceof Error ? e.message : String(e);
          logStep("Monitor run failed", { id: row.id, error: msg });
          await db.from("prior_art_monitoring")
            .update({
              monitoring_data: { ...(row.monitoring_data ?? {}), last_error: msg, last_error_at: new Date().toISOString() },
            })
            .eq("id", row.id);
        }
      }

      logStep("Batch run complete", { ...summary, results: undefined });
      return json({ success: true, mode: isService ? "scheduled" : "user_due", ...summary });
    }

    // ---------------------------------------------------------------------
    // Single-target mode (interactive "Run now")
    // ---------------------------------------------------------------------
    let existing: MonitorRow | null = null;
    let targetIdea: string | null = ideaId;
    let targetSession: string | null = sessionId;

    if (monitoringId) {
      const { data } = await db.from("prior_art_monitoring").select(MONITOR_COLS).eq("id", monitoringId).maybeSingle();
      if (!data) return json({ success: false, error: "Monitor not found" }, 404);
      existing = data as MonitorRow;
      targetIdea = existing.patent_idea_id;
      targetSession = existing.patent_session_id;
    }

    const ownerId = await resolveOwner(db, targetIdea, targetSession);
    if (!ownerId) return json({ success: false, error: "Idea or application not found" }, 404);
    if (!isService && ownerId !== callerId) return json({ success: false, error: "Forbidden" }, 403);

    const query = searchQuery || existing?.search_query;
    if (!query) return json({ success: false, error: "Search query is required" }, 400);

    if (!existing) {
      // Match an existing monitor on the same target + query, else the target's first monitor
      let q = db.from("prior_art_monitoring").select(MONITOR_COLS).order("created_at", { ascending: true }).limit(20);
      q = targetIdea ? q.eq("patent_idea_id", targetIdea) : q.eq("patent_session_id", targetSession);
      const { data: rows } = await q;
      const list = (rows ?? []) as MonitorRow[];
      // Same query -> that monitor; a target with a single monitor -> reuse it (idea page re-runs)
      existing = list.find((r) => r.search_query === query) ?? (list.length === 1 ? list[0] : null);
    }

    logStep("Running single monitor", { ideaId: targetIdea, sessionId: targetSession, existing: !!existing });

    const r = await runMonitor(db, {
      ownerId,
      ideaId: targetIdea,
      sessionId: targetSession,
      searchQuery: query,
      existing,
      authHeader: isService ? `Bearer ${serviceKey}` : authHeader,
      scheduled: isService,
    });

    return json({ success: true, ...r });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const status = (error as any)?.status;
    logStep("ERROR", { message: errorMessage });
    // Surface search-side 401/402/403 (e.g. out of credits) instead of a generic 500
    return json({ success: false, error: errorMessage }, status && status >= 400 && status < 500 ? status : 500);
  }
});
