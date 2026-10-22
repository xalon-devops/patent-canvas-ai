// Shared HTTP / auth helpers for edge functions.
// - Consistent CORS (incl. OPTIONS preflight)
// - JSON error bodies shaped `{ error: string, ... }` (what src/lib/edgeError.ts reads)
// - Caller authentication (user JWT via auth.getUser, or service-role bearer for server-to-server)
// - Ownership + entitlement checks before touching data with the service-role client
// - Body size limits, fetch timeouts, tolerant JSON parsing of model output

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export class HttpError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

/** Returns a preflight response for OPTIONS requests, otherwise null. */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return null;
}

/** Maps any thrown value to a JSON error response without leaking internals. */
export function errorResponse(err: unknown, fallback = "Something went wrong. Please try again.", tag = "edge"): Response {
  if (err instanceof HttpError) {
    return jsonResponse({ success: false, error: err.message, ...(err.extra ?? {}) }, err.status);
  }
  console.error(`[${tag}] unhandled error:`, err);
  return jsonResponse({ success: false, error: fallback }, 500);
}

let _admin: SupabaseClient | null = null;
export function getAdminClient(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _admin;
}

export interface Caller {
  /** Authenticated user id, or null for a service-role (server-to-server) call. */
  userId: string | null;
  email: string | null;
  isService: boolean;
  /** Raw bearer token (forward it when calling other functions on behalf of the user). */
  token: string;
  admin: SupabaseClient;
}

function bearer(req: Request): string | null {
  const h = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!h || !/^Bearer\s+/i.test(h)) return null;
  const t = h.replace(/^Bearer\s+/i, "").trim();
  return t || null;
}

/**
 * Authenticates the caller. Accepts a signed-in user's access token, or the
 * service-role key as bearer (crons / function-to-function). Throws 401 otherwise.
 * The anon key is NOT accepted as a user.
 */
export async function authenticate(req: Request): Promise<Caller> {
  const token = bearer(req);
  if (!token) throw new HttpError(401, "Please sign in to continue.");
  const admin = getAdminClient();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) {
    return { userId: null, email: null, isService: true, token, admin };
  }
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "Your session has expired. Please sign in again.");
  return { userId: data.user.id, email: data.user.email ?? null, isService: false, token, admin };
}

/** Like authenticate(), but returns null instead of throwing when no/invalid token. */
export async function authenticateOptional(req: Request): Promise<Caller | null> {
  try {
    return await authenticate(req);
  } catch {
    return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export async function isAdminUser(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

/**
 * Loads a patent session and verifies the caller may act on it
 * (owner, admin, or service role). Responds 404 for both missing and
 * not-owned to avoid leaking session existence.
 */
// deno-lint-ignore no-explicit-any
export async function requireSessionAccess(caller: Caller, sessionId: unknown, columns = "*"): Promise<any> {
  if (!isUuid(sessionId)) throw new HttpError(400, "A valid session_id is required.");
  const cols = columns === "*" || columns.split(",").map((c) => c.trim()).includes("user_id")
    ? columns
    : `${columns}, user_id`;
  const { data, error } = await caller.admin.from("patent_sessions").select(cols).eq("id", sessionId).maybeSingle();
  if (error) {
    console.error("requireSessionAccess query error:", error);
    throw new HttpError(500, "Could not load the patent session.");
  }
  if (!data) throw new HttpError(404, "Patent session not found.");
  // deno-lint-ignore no-explicit-any
  const row = data as any;
  if (caller.isService) return row;
  if (row.user_id === caller.userId) return row;
  if (caller.userId && (await isAdminUser(caller.admin, caller.userId))) return row;
  throw new HttpError(404, "Patent session not found.");
}

/** Verifies the caller owns the given patent idea. */
// deno-lint-ignore no-explicit-any
export async function requireIdeaAccess(caller: Caller, ideaId: unknown): Promise<any> {
  if (!isUuid(ideaId)) throw new HttpError(400, "A valid idea_id is required.");
  const { data, error } = await caller.admin.from("patent_ideas").select("*").eq("id", ideaId).maybeSingle();
  if (error) throw new HttpError(500, "Could not load the patent idea.");
  // deno-lint-ignore no-explicit-any
  const row = data as any;
  if (!row) throw new HttpError(404, "Patent idea not found.");
  if (caller.isService || row.user_id === caller.userId) return row;
  if (caller.userId && (await isAdminUser(caller.admin, caller.userId))) return row;
  throw new HttpError(404, "Patent idea not found.");
}

/** Active subscription row (status active/trialing), or null. */
export async function getActiveSubscription(admin: SupabaseClient, userId: string): Promise<{ plan: string; status: string } | null> {
  const { data } = await admin.from("subscriptions").select("plan, status").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  if (data.status !== "active" && data.status !== "trialing") return null;
  return data as { plan: string; status: string };
}

/**
 * True when the user may use paid AI features: admin, or `is_paid_user`
 * (active/trialing subscription on any non-free plan, incl. free_grant).
 */
export async function hasPaidAccess(admin: SupabaseClient, userId: string): Promise<boolean> {
  if (await isAdminUser(admin, userId)) return true;
  const { data, error } = await admin.rpc("is_paid_user", { _user_id: userId });
  if (!error) return !!data;
  const sub = await getActiveSubscription(admin, userId);
  return !!sub && sub.plan !== "free" && sub.plan !== "inactive";
}

/**
 * True when the user may export / download / file a specific application:
 * admin, an admin free_grant subscription, a completed $1,000 application
 * payment for this application_id (Stripe webhook / verify-payment write
 * status 'completed'), or an unassigned admin-granted application credit.
 */
export async function hasApplicationEntitlement(admin: SupabaseClient, userId: string, applicationId: string): Promise<boolean> {
  if (await isAdminUser(admin, userId)) return true;
  const sub = await getActiveSubscription(admin, userId);
  if (sub?.plan === "free_grant") return true;
  const { data: payments } = await admin
    .from("application_payments")
    .select("id, application_id, status")
    .eq("user_id", userId)
    .in("status", ["completed", "paid"]);
  // deno-lint-ignore no-explicit-any
  const rows = (payments ?? []) as any[];
  if (rows.some((p) => p.application_id === applicationId)) return true;
  // Admin "grant free application" rows are inserted with application_id NULL.
  // Claim one for this application so a single grant unlocks a single application.
  const credit = rows.find((p) => p.application_id === null);
  if (!credit) return false;
  const { error } = await admin
    .from("application_payments")
    .update({ application_id: applicationId })
    .eq("id", credit.id)
    .is("application_id", null);
  if (error) console.warn("Could not claim application credit (continuing):", error.message);
  return true;
}

export async function requireApplicationEntitlement(caller: Caller, applicationId: string): Promise<void> {
  if (caller.isService) return;
  if (await hasApplicationEntitlement(caller.admin, caller.userId!, applicationId)) return;
  throw new HttpError(402, "Payment required", {
    requires_payment: true,
    requires_subscription: true,
    message: "Please complete the $1,000 payment for this application to continue.",
  });
}

export async function requirePaidAccess(caller: Caller): Promise<void> {
  if (caller.isService) return;
  if (await hasPaidAccess(caller.admin, caller.userId!)) return;
  throw new HttpError(402, "An active subscription is required for this feature.", { requires_subscription: true });
}

/** Reads and parses a JSON body with a size cap. Empty body -> {}. */
// deno-lint-ignore no-explicit-any
export async function readJson<T = any>(req: Request, maxBytes = 1_000_000): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len && len > maxBytes) throw new HttpError(413, "Request is too large.");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request is too large.");
  if (!text.trim()) return {} as T;
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object") throw new Error("not an object");
    return parsed as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}

/** fetch() with an abort timeout (default 60s). */
export async function fetchWithTimeout(input: string | URL, init: RequestInit = {}, timeoutMs = 60_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw new HttpError(504, "An upstream service timed out. Please try again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Maps a non-OK AI gateway response to an HttpError with a user-friendly message. */
export async function aiGatewayError(res: Response, tag = "ai"): Promise<HttpError> {
  const body = await res.text().catch(() => "");
  console.error(`[${tag}] AI gateway error ${res.status}:`, body.slice(0, 500));
  if (res.status === 429) return new HttpError(429, "Rate limit exceeded. Please try again in a moment.");
  // Gateway 402 = our AI workspace is out of credits. Don't surface as 402: the frontend
  // (src/lib/edgeError.ts) treats 402 as "user must subscribe".
  if (res.status === 402) return new HttpError(503, "The AI service is temporarily unavailable. Please try again later.");
  return new HttpError(502, "The AI service failed to respond. Please try again.");
}

/**
 * Best-effort JSON extraction from model output: handles ```json fences,
 * leading prose, and trailing text. Returns null if nothing parses.
 */
// deno-lint-ignore no-explicit-any
export function parseModelJson<T = any>(text: unknown): T | null {
  if (typeof text !== "string" || !text.trim()) return null;
  const candidates: string[] = [];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.push(fence[1]);
  candidates.push(text);
  const firstObj = text.indexOf("{");
  const lastObj = text.lastIndexOf("}");
  if (firstObj !== -1 && lastObj > firstObj) candidates.push(text.slice(firstObj, lastObj + 1));
  const firstArr = text.indexOf("[");
  const lastArr = text.lastIndexOf("]");
  if (firstArr !== -1 && lastArr > firstArr) candidates.push(text.slice(firstArr, lastArr + 1));
  for (const c of candidates) {
    try {
      return JSON.parse(c.trim()) as T;
    } catch { /* try next */ }
  }
  return null;
}

/** Clamp a 0..1 (or 0..100) score into the DECIMAL(3,2) 0..1 range used by patent_sessions.patentability_score. */
export function toUnitScore(v: unknown): number | null {
  let n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return null;
  if (n > 1) n = n / 100;
  n = Math.max(0, Math.min(1, n));
  return Math.round(n * 100) / 100;
}

/** Fire-and-forget call to another edge function with the service-role key. */
export async function invokeFunctionAsService(name: string, body: unknown, timeoutMs = 15_000): Promise<Response | null> {
  try {
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    return await fetchWithTimeout(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
      body: JSON.stringify(body),
    }, timeoutMs);
  } catch (e) {
    console.error(`invokeFunctionAsService(${name}) failed:`, e);
    return null;
  }
}

export const PATENT_SECTION_TYPES = ["abstract", "field", "background", "summary", "claims", "drawings", "description"] as const;
export type PatentSectionType = typeof PATENT_SECTION_TYPES[number];
export function isSectionType(v: unknown): v is PatentSectionType {
  return typeof v === "string" && (PATENT_SECTION_TYPES as readonly string[]).includes(v);
}

/**
 * Inserts or updates the single row for (session_id, section_type).
 * patent_sections has no UNIQUE(session_id, section_type), so upsert/onConflict
 * cannot be used; this updates the most recent row and removes older duplicates.
 * Returns false if the existing section was user-edited and `respectUserEdits` is set.
 */
export async function saveSection(
  admin: SupabaseClient,
  sessionId: string,
  sectionType: PatentSectionType,
  content: string,
  opts: { respectUserEdits?: boolean; markUserEdited?: boolean } = {},
): Promise<boolean> {
  const { data: rows, error } = await admin
    .from("patent_sections")
    .select("id, is_user_edited, created_at")
    .eq("session_id", sessionId)
    .eq("section_type", sectionType)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`load section ${sectionType}: ${error.message}`);
  const existing = rows ?? [];
  if (existing.length === 0) {
    const { error: insErr } = await admin.from("patent_sections").insert({
      session_id: sessionId,
      section_type: sectionType,
      content,
      is_user_edited: opts.markUserEdited ?? false,
    });
    if (insErr) throw new Error(`insert section ${sectionType}: ${insErr.message}`);
    return true;
  }
  const [latest, ...dupes] = existing;
  if (opts.respectUserEdits && latest.is_user_edited) return false;
  const { error: updErr } = await admin
    .from("patent_sections")
    .update({ content, is_user_edited: opts.markUserEdited ?? false })
    .eq("id", latest.id);
  if (updErr) throw new Error(`update section ${sectionType}: ${updErr.message}`);
  if (dupes.length) {
    await admin.from("patent_sections").delete().in("id", dupes.map((d: { id: string }) => d.id));
  }
  return true;
}

/**
 * The 'drawings' section is stored as a JSON array of
 * { figure_number, description (HTML), image_data (data URL) } by generate-patent-diagrams.
 * Returns the figure descriptions as HTML (never the base64 image payload) for text exports.
 */
export function sectionContentForExport(sectionType: string, content: string | null | undefined): string {
  const raw = content ?? "";
  if (sectionType !== "drawings") return raw;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[")) return raw;
  try {
    const figs = JSON.parse(trimmed);
    if (!Array.isArray(figs)) return raw;
    return figs
      // deno-lint-ignore no-explicit-any
      .map((f: any, i: number) => (typeof f?.description === "string" && f.description.trim()) ? f.description : `<p>FIG. ${f?.figure_number ?? i + 1}</p>`)
      .join("\n");
  } catch {
    return raw;
  }
}

/**
 * Draft-completion side effects (idempotent):
 * - moves the session to 'completed' unless it is already 'completed'/'filed'
 * - sends the 'draft_complete' email (send-notification-email) once per session
 */
export async function markDraftComplete(admin: SupabaseClient, sessionId: string, userId: string | null | undefined): Promise<void> {
  const { error: statusErr } = await admin
    .from("patent_sessions")
    .update({ status: "completed" })
    .eq("id", sessionId)
    .or("status.is.null,status.in.(in_progress,draft)");
  if (statusErr) console.error("markDraftComplete status update failed:", statusErr.message);

  if (!userId) return;
  try {
    const { data: prior } = await admin
      .from("email_notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("email_type", "draft_complete")
      .ilike("content", `%/session/${sessionId}%`)
      .limit(1);
    if (prior && prior.length > 0) return;
    const res = await invokeFunctionAsService("send-notification-email", {
      user_id: userId,
      type: "draft_complete",
      session_id: sessionId,
    });
    if (res && !res.ok) console.warn("draft_complete email failed:", res.status, (await res.text()).slice(0, 200));
  } catch (e) {
    console.error("markDraftComplete email error:", e);
  }
}

/**
 * Validates a user-supplied URL before the server fetches it (SSRF guard):
 * http(s) only, no credentials, no localhost / private / link-local / metadata hosts.
 * Returns the normalized URL string or throws 400.
 */
export function assertPublicHttpUrl(input: unknown): string {
  if (typeof input !== "string" || !input.trim() || input.length > 2048) throw new HttpError(400, "A valid URL is required.");
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new HttpError(400, "A valid URL is required.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new HttpError(400, "Only http(s) URLs are supported.");
  if (u.username || u.password) throw new HttpError(400, "URLs with credentials are not supported.");
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blockedHost =
    host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") ||
    host === "metadata.google.internal" || !host.includes(".") && !host.includes(":");
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  let privateIp = false;
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    privateIp = a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  } else if (host.includes(":")) {
    privateIp = host === "::1" || host === "::" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80") ||
      host.startsWith("::ffff:");
  }
  if (blockedHost || privateIp) throw new HttpError(400, "That URL cannot be fetched.");
  return u.toString();
}

export interface SearchAccess {
  unlimited: boolean;
  remaining: number;
}

/**
 * Prior-art search gate: admins, paid users (is_paid_user: active/trialing non-free plan, incl. free_grant)
 * and service-role callers are unlimited; everyone else needs free credits in user_search_credits.
 * Throws 402 { requires_subscription: true } when no credits remain.
 */
export async function requireSearchAccess(caller: Caller, freeLimit = 3): Promise<SearchAccess> {
  if (caller.isService) return { unlimited: true, remaining: Infinity };
  const uid = caller.userId!;
  if (await hasPaidAccess(caller.admin, uid)) return { unlimited: true, remaining: Infinity };
  let { data: credits } = await caller.admin
    .from("user_search_credits")
    .select("free_searches_remaining")
    .eq("user_id", uid)
    .maybeSingle();
  if (!credits) {
    // A signup trigger normally creates this row; backfill for older accounts.
    await caller.admin
      .from("user_search_credits")
      .upsert({ user_id: uid, searches_used: 0, free_searches_remaining: freeLimit }, { onConflict: "user_id", ignoreDuplicates: true });
    ({ data: credits } = await caller.admin
      .from("user_search_credits")
      .select("free_searches_remaining")
      .eq("user_id", uid)
      .maybeSingle());
  }
  const remaining = Number(credits?.free_searches_remaining ?? 0);
  if (remaining <= 0) {
    throw new HttpError(402, "No search credits remaining. Please subscribe to continue.", { requires_subscription: true });
  }
  return { unlimited: false, remaining };
}

/** Atomically consumes one free search credit (service-role-only RPC). Returns remaining credits. */
export async function consumeSearchCredit(caller: Caller, access: SearchAccess): Promise<number | "unlimited"> {
  if (access.unlimited) return "unlimited";
  const { data, error } = await caller.admin.rpc("decrement_search_credit", { _user_id: caller.userId });
  if (error) console.error("decrement_search_credit failed:", error.message);
  else if (data === false) console.warn("decrement_search_credit: no credits left (concurrent search?)");
  return Math.max(0, access.remaining - 1);
}

/** Coerces model/scraper dates to a Postgres DATE literal (YYYY-MM-DD) or null. */
export function toPgDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s))) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !isNaN(Date.parse(s))) return s.slice(0, 10);
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  return null;
}
