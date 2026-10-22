// Signed OAuth `state` for the Supabase Management OAuth flow.
// The state carries the initiating user id + app origin and is HMAC-SHA256 signed
// with a server-only secret, so the callback can trust it (CSRF / account-binding
// protection) and never redirects or postMessages to an arbitrary origin.

const enc = new TextEncoder();

export const STATE_TTL_MS = 15 * 60 * 1000;
export const DEFAULT_APP_ORIGIN = "https://patentbot-ai.com";

const ALLOWED_ORIGINS = new Set<string>([
  "https://patentbot-ai.com",
  "https://www.patentbot-ai.com",
  ...(Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean),
]);

/** Returns the origin if allow-listed (prod domain, Lovable previews, localhost), else the prod domain. */
export function safeAppOrigin(candidate: string | null | undefined): string {
  if (!candidate) return DEFAULT_APP_ORIGIN;
  try {
    const u = new URL(candidate);
    const origin = `${u.protocol}//${u.host}`;
    if (ALLOWED_ORIGINS.has(origin)) return origin;
    if (u.protocol === "https:" && /(^|\.)(lovable\.app|lovableproject\.com)$/.test(u.hostname)) return origin;
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) return origin;
  } catch { /* fallthrough */ }
  return DEFAULT_APP_ORIGIN;
}

function secret(): string {
  const s = Deno.env.get("OAUTH_STATE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!s) throw new Error("Missing OAUTH_STATE_SECRET");
  return s;
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export type OAuthState = { userId: string; origin: string; ts: number; nonce: string };

export async function signState(userId: string, origin: string): Promise<string> {
  const payload: OAuthState = {
    userId,
    origin: safeAppOrigin(origin),
    ts: Date.now(),
    nonce: b64url(crypto.getRandomValues(new Uint8Array(16))),
  };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = b64url(await hmac(body));
  return `${body}.${sig}`;
}

/** Verifies signature + expiry. Returns null when the state is forged, malformed or expired. */
export async function verifyState(state: string | null): Promise<OAuthState | null> {
  if (!state || state.length > 2048) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  try {
    const expected = await hmac(body);
    if (!timingSafeEqual(expected, b64urlDecode(sig))) return null;
    const parsed = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as OAuthState;
    if (!parsed?.userId || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > STATE_TTL_MS || parsed.ts > Date.now() + 60_000) return null;
    parsed.origin = safeAppOrigin(parsed.origin);
    return parsed;
  } catch {
    return null;
  }
}

/** Unverified origin extraction for error pages - always passed through the allow-list. */
export function originFromUntrustedState(state: string | null): string {
  try {
    const body = (state ?? "").split(".")[0];
    const parsed = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    return safeAppOrigin(parsed?.origin);
  } catch {
    return DEFAULT_APP_ORIGIN;
  }
}

/** JSON-encode a value for safe embedding inside an inline <script>. */
export function scriptLiteral(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
