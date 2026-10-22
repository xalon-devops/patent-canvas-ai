import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

/**
 * Trademark watch runner.
 *
 * Two callers:
 *  - A signed-in user (their JWT): create a watch for one of their own marks /
 *    searches / applications, or re-run one of their own watches. Paid feature.
 *  - A cron / another function (service-role key as bearer): with `monitorId`
 *    runs that watch; otherwise runs every active watch that is due
 *    (next_search_at <= now), a few per invocation.
 *
 * Each run re-searches the mark, diffs the hits against marks already seen,
 * updates last_search_at / next_search_at, and emails the owner when a new
 * likely conflict appears.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RETRY_MS = 24 * 60 * 60 * 1000;
const MANUAL_COOLDOWN_MS = 15 * 60 * 1000;
const CONFLICT_THRESHOLD = 0.6;
const CRON_BATCH_DEFAULT = 3;
const CRON_BATCH_MAX = 10;
const CRON_TIME_BUDGET_MS = 110 * 1000;
const EMAIL_FROM = "PatentBot™ <teams@msg.patentbot-ai.com>";
const APP_URL = "https://patentbot-ai.com";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[TRADEMARK-MONITORING] ${step}${detailsStr}`);
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (v: unknown): string | null => (typeof v === "string" && UUID_RE.test(v) ? v : null);
const asText = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const asClasses = (v: unknown): string[] =>
  (Array.isArray(v) ? v : [])
    .map((c) => String(c ?? "").replace(/\D/g, "").padStart(3, "0"))
    .filter((c) => /^0(0[1-9]|[1-3]\d|4[0-5])$/.test(c))
    .slice(0, 45);

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Stable identity for a hit so re-runs can tell new marks from ones already seen
const hitKey = (r: any): string => {
  const serial = String(r?.serial_number ?? "").replace(/\D/g, "");
  if (serial) return `sn:${serial}`;
  const reg = String(r?.registration_number ?? "").replace(/\D/g, "");
  if (reg) return `rn:${reg}`;
  return `nm:${String(r?.mark_name ?? "").toLowerCase().replace(/\s+/g, " ").trim()}|${String(r?.owner ?? "").toLowerCase().trim()}`;
};

const isConflict = (r: any) =>
  (r?.similarity_score ?? 0) >= CONFLICT_THRESHOLD || r?.verdict === "HIGH_RISK" || r?.verdict === "MODERATE_RISK";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ success: false, error: "Please sign in to continue." }, 401);
  const isServiceCall = !!serviceKey && token === serviceKey;

  let callerId: string | null = null;
  if (!isServiceCall) {
    const { data: u, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !u?.user) return json({ success: false, error: "Your session has expired. Please sign in again." }, 401);
    callerId = u.user.id;
  }

  const hasMonitoringAccess = async (userId: string): Promise<boolean> => {
    const [{ data: admin }, { data: sub }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      supabase.from("subscriptions").select("plan").eq("user_id", userId)
        .in("status", ["active", "trialing"]).neq("plan", "free").maybeSingle(),
    ]);
    return !!admin || !!sub;
  };

  try {
    const body = await req.json().catch(() => ({}));
    const monitorId = asUuid(body?.monitorId);

    // ---------------- Cron / server-to-server ----------------
    if (isServiceCall) {
      if (monitorId) {
        const { data: monitor, error } = await supabase.from("trademark_monitoring").select("*").eq("id", monitorId).maybeSingle();
        if (error) throw error;
        if (!monitor) return json({ success: false, error: "Monitor not found" }, 404);
        const result = await runMonitor(supabase, monitor);
        return json({ success: true, ...result });
      }

      const limit = Math.min(Math.max(Number(body?.limit) || CRON_BATCH_DEFAULT, 1), CRON_BATCH_MAX);
      const nowIso = new Date().toISOString();
      const { data: due, error: dueErr } = await supabase
        .from("trademark_monitoring")
        .select("*")
        .eq("is_active", true)
        .or(`next_search_at.is.null,next_search_at.lte.${nowIso}`)
        .order("next_search_at", { ascending: true, nullsFirst: true })
        .limit(limit);
      if (dueErr) throw dueErr;

      const started = Date.now();
      const summary: any[] = [];
      const accessCache = new Map<string, boolean>();
      for (const monitor of due || []) {
        if (Date.now() - started > CRON_TIME_BUDGET_MS) break;

        // Claim the row so an overlapping cron invocation doesn't run it too
        const { data: claimed } = await supabase
          .from("trademark_monitoring")
          .update({ next_search_at: new Date(Date.now() + RETRY_MS).toISOString() })
          .eq("id", monitor.id)
          .eq("is_active", true)
          .or(`next_search_at.is.null,next_search_at.lte.${nowIso}`)
          .select("id");
        if (!claimed?.length) continue;

        // Watches are part of the paid Trademark Suite: skip (don't delete) lapsed accounts
        if (!accessCache.has(monitor.user_id)) accessCache.set(monitor.user_id, await hasMonitoringAccess(monitor.user_id));
        if (!accessCache.get(monitor.user_id)) {
          await supabase.from("trademark_monitoring")
            .update({ next_search_at: new Date(Date.now() + WEEK_MS).toISOString() })
            .eq("id", monitor.id);
          summary.push({ id: monitor.id, skipped: "no_subscription" });
          continue;
        }

        try {
          const r = await runMonitor(supabase, monitor);
          summary.push({ id: monitor.id, ...r });
        } catch (e) {
          summary.push({ id: monitor.id, error: e instanceof Error ? e.message : String(e) });
        }
      }
      logStep("Cron batch complete", { processed: summary.length });
      return json({ success: true, processed: summary.length, results: summary });
    }

    // ---------------- Signed-in user ----------------
    const userId = callerId!;
    if (!(await hasMonitoringAccess(userId))) {
      return json({
        success: false,
        requires_subscription: true,
        error: "Trademark watch is part of the Trademark Suite subscription.",
      }, 402);
    }

    if (monitorId) {
      const { data: monitor, error } = await supabase
        .from("trademark_monitoring").select("*").eq("id", monitorId).maybeSingle();
      if (error) throw error;
      if (!monitor || monitor.user_id !== userId) return json({ success: false, error: "Monitor not found" }, 404);

      const lastRun = Date.parse(monitor.monitoring_data?.last_run_at ?? "");
      if (!Number.isNaN(lastRun) && Date.now() - lastRun < MANUAL_COOLDOWN_MS) {
        return json({ success: false, error: "This watch just ran. Try again in a few minutes." }, 429);
      }
      const result = await runMonitor(supabase, monitor);
      return json({ success: true, monitorId: monitor.id, ...result });
    }

    // Create (or reuse) a watch for one of the caller's own marks
    const trademarkSearchId = asUuid(body?.trademarkSearchId);
    const trademarkApplicationId = asUuid(body?.trademarkApplicationId);
    let markName = asText(body?.markName, 120);
    let searchQuery = asText(body?.searchQuery, 2000);
    let niceClasses = asClasses(body?.niceClasses);

    if (trademarkSearchId) {
      const { data: s } = await supabase.from("trademark_searches")
        .select("id, user_id, mark_name, mark_description, nice_classes").eq("id", trademarkSearchId).maybeSingle();
      if (!s || s.user_id !== userId) return json({ success: false, error: "Search not found" }, 404);
      markName = markName || s.mark_name;
      searchQuery = searchQuery || s.mark_description || s.mark_name;
      if (!niceClasses.length) niceClasses = asClasses(s.nice_classes);
    }
    if (trademarkApplicationId) {
      const { data: a } = await supabase.from("trademark_applications")
        .select("id, user_id, mark_name, mark_description, nice_classes").eq("id", trademarkApplicationId).maybeSingle();
      if (!a || a.user_id !== userId) return json({ success: false, error: "Application not found" }, 404);
      markName = markName || a.mark_name;
      searchQuery = searchQuery || a.mark_description || a.mark_name;
      if (!niceClasses.length) niceClasses = asClasses(a.nice_classes);
    }
    if (!markName) return json({ success: false, error: "Mark name is required" }, 400);
    searchQuery = searchQuery || markName;

    // One watch per mark per user — reuse an existing one instead of duplicating
    const { data: existing } = await supabase
      .from("trademark_monitoring")
      .select("*")
      .eq("user_id", userId)
      .ilike("mark_name", markName.replace(/[\\%_]/g, (m) => `\\${m}`))
      .limit(1)
      .maybeSingle();

    let monitor = existing;
    if (existing) {
      const patch: Record<string, unknown> = { is_active: true };
      if (trademarkSearchId && !existing.trademark_search_id) patch.trademark_search_id = trademarkSearchId;
      if (trademarkApplicationId && !existing.trademark_application_id) patch.trademark_application_id = trademarkApplicationId;
      if (niceClasses.length && !(existing.nice_classes || []).length) patch.nice_classes = niceClasses;
      const { data: upd, error: updErr } = await supabase.from("trademark_monitoring")
        .update(patch).eq("id", existing.id).select("*").maybeSingle();
      if (updErr) throw updErr;
      monitor = upd || existing;
      return json({
        success: true, created: false, monitorId: existing.id,
        resultsFound: monitor.results_found ?? 0,
        highestSimilarity: monitor.highest_similarity_score ?? null,
        nextSearchAt: monitor.next_search_at,
      });
    }

    const { data: created, error: insErr } = await supabase
      .from("trademark_monitoring")
      .insert({
        user_id: userId,
        mark_name: markName,
        search_query: searchQuery,
        nice_classes: niceClasses,
        trademark_search_id: trademarkSearchId,
        trademark_application_id: trademarkApplicationId,
        is_active: true,
        next_search_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (insErr) throw insErr;
    logStep("Created monitor", { id: created.id, userId });

    // Baseline run right away so the user sees what's already out there
    let result: any = {};
    try {
      result = await runMonitor(supabase, created);
    } catch (e) {
      logStep("Baseline run failed; cron will retry", { id: created.id, error: e instanceof Error ? e.message : String(e) });
    }
    return json({ success: true, created: true, monitorId: created.id, ...result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : (error as any)?.message || String(error);
    logStep("ERROR", { message: errorMessage });
    return json({ success: false, error: errorMessage }, 500);
  }
});

async function runMonitor(supabase: any, monitor: any) {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const previous = (monitor.monitoring_data && typeof monitor.monitoring_data === "object") ? monitor.monitoring_data : {};
  const knownKeys: string[] = Array.isArray(previous.known_keys) ? previous.known_keys : [];
  const isBaseline = !previous.last_run_at;

  logStep("Running monitor", { id: monitor.id, mark: monitor.mark_name, baseline: isBaseline });

  let results: any[] = [];
  try {
    const searchResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/search-trademarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({
        mark_name: monitor.mark_name,
        mark_description: monitor.search_query,
        nice_classes: monitor.nice_classes || [],
        skip_credit_check: true,
      }),
    });
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      throw new Error(`Search failed (${searchResponse.status}): ${errorText.slice(0, 300)}`);
    }
    const searchData = await searchResponse.json();
    results = Array.isArray(searchData?.results) ? searchData.results : [];
  } catch (e) {
    // Record the failure and retry tomorrow instead of leaving the row due forever
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("trademark_monitoring").update({
      next_search_at: new Date(Date.now() + RETRY_MS).toISOString(),
      monitoring_data: { ...previous, last_error: message, last_error_at: new Date().toISOString() },
    }).eq("id", monitor.id);
    throw e;
  }

  // The applicant's own web presence is not a conflict
  const hits = results.filter((r) => !r?.is_applicant_use);
  const known = new Set(knownKeys);
  const newHits = hits.filter((r) => !known.has(hitKey(r)));
  const newConflicts = isBaseline ? [] : newHits.filter(isConflict);

  const highestSimilarity = hits.length > 0
    ? Math.max(...hits.map((r: any) => Number(r.similarity_score) || 0))
    : null;

  const allKeys = Array.from(new Set([...knownKeys, ...hits.map(hitKey)])).slice(-500);
  const now = new Date();
  const nextSearchAt = new Date(now.getTime() + WEEK_MS).toISOString();
  const slim = (r: any) => ({
    mark_name: r.mark_name,
    serial_number: r.serial_number ?? null,
    registration_number: r.registration_number ?? null,
    similarity_score: r.similarity_score,
    verdict: r.verdict ?? null,
    status: r.status,
    owner: r.owner,
    url: r.url ?? null,
  });

  const { error: updErr } = await supabase.from("trademark_monitoring").update({
    results_found: hits.length,
    new_results_count: isBaseline ? 0 : newHits.length,
    highest_similarity_score: highestSimilarity,
    last_search_at: now.toISOString(),
    next_search_at: nextSearchAt,
    monitoring_data: {
      last_run_at: now.toISOString(),
      known_keys: allKeys,
      last_results: hits.slice(0, 5).map(slim),
      new_results: isBaseline ? [] : newHits.slice(0, 10).map(slim),
      new_conflicts: newConflicts.slice(0, 10).map(slim),
    },
  }).eq("id", monitor.id);
  if (updErr) throw updErr;

  let notified = false;
  if (newConflicts.length > 0) {
    notified = await notifyOwner(supabase, monitor, newConflicts).catch((e) => {
      logStep("Notification failed", { id: monitor.id, error: e instanceof Error ? e.message : String(e) });
      return false;
    });
  }

  logStep("Monitor run complete", { id: monitor.id, hits: hits.length, newHits: newHits.length, newConflicts: newConflicts.length, notified });
  return {
    resultsFound: hits.length,
    newResults: isBaseline ? 0 : newHits.length,
    newConflicts: newConflicts.length,
    highestSimilarity,
    nextSearchAt,
    notified,
  };
}

async function notifyOwner(supabase: any, monitor: any, conflicts: any[]): Promise<boolean> {
  const { data: profile } = await supabase.from("users").select("email, email_preferences").eq("id", monitor.user_id).maybeSingle();
  let email: string | null = profile?.email ?? null;
  if (!email) {
    const { data: authUser } = await supabase.auth.admin.getUserById(monitor.user_id);
    email = authUser?.user?.email ?? null;
  }
  if (!email) return false;

  const prefs = profile?.email_preferences || {};
  const optedIn = prefs.trademark_alert ?? prefs.prior_art_alert ?? true;
  if (optedIn === false) return false;

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    logStep("RESEND_API_KEY not set; skipping email");
    return false;
  }

  const mark = escapeHtml(String(monitor.mark_name));
  const subject = `New possible conflict with "${String(monitor.mark_name).slice(0, 60)}"`;
  const rows = conflicts.slice(0, 5).map((c) => {
    const name = escapeHtml(String(c.mark_name ?? "Unknown mark"));
    const owner = c.owner ? ` — ${escapeHtml(String(c.owner))}` : "";
    const pct = Math.round((Number(c.similarity_score) || 0) * 100);
    const serial = c.serial_number ? ` · Serial ${escapeHtml(String(c.serial_number))}` : "";
    return `<li style="margin-bottom:8px"><strong>${name}</strong>${owner}<br/><span style="color:#666;font-size:13px">${pct}% similar${serial}${c.status ? ` · ${escapeHtml(String(c.status))}` : ""}</span></li>`;
  }).join("");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
      <h2 style="margin:0 0 12px">Trademark watch: new possible conflict</h2>
      <p>Your weekly watch for <strong>${mark}</strong> found ${conflicts.length} new mark${conflicts.length === 1 ? "" : "s"} that may conflict with yours:</p>
      <ul style="padding-left:18px">${rows}</ul>
      <p><a href="${APP_URL}/trademark-check" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Review in PatentBot</a></p>
      <p style="color:#888;font-size:12px">This is an automated research alert, not legal advice. You can turn off trademark watches from your dashboard.</p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [email], subject, html }),
  });
  const ok = res.ok;
  const payload = await res.json().catch(() => ({}));

  await supabase.from("email_notifications").insert({
    user_id: monitor.user_id,
    email_type: "trademark_alert",
    recipient_email: email,
    subject,
    status: ok ? "sent" : "failed",
    sent_at: ok ? new Date().toISOString() : null,
    metadata: { monitor_id: monitor.id, conflicts: conflicts.length, resend_id: payload?.id ?? null },
  });
  return ok;
}
