// Server-side access to a user's Supabase Management OAuth token.
// Tokens live only in public.supabase_connections (service-role access); they are never
// returned to the browser. Expired access tokens are refreshed with the refresh token.

// deno-lint-ignore no-explicit-any
type Db = any;

export type ConnectionRow = {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  connection_status: string | null;
  is_active: boolean | null;
  project_ref?: string | null;
  connection_metadata?: Record<string, unknown> | null;
};

export const CONNECTION_COLS =
  "id, user_id, access_token, refresh_token, token_expires_at, connection_status, is_active, project_ref, connection_metadata";

/** Most recent pending/active connection of the user (or a specific one they own). */
export async function getUserConnection(db: Db, userId: string, connectionId?: string | null): Promise<ConnectionRow | null> {
  let q = db.from("supabase_connections").select(CONNECTION_COLS).eq("user_id", userId);
  if (connectionId) {
    q = q.eq("id", connectionId);
  } else {
    q = q.in("connection_status", ["pending", "active"]).order("created_at", { ascending: false }).limit(1);
  }
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ConnectionRow) ?? null;
}

/** Returns a non-expired access token, refreshing (and persisting) it when needed. */
export async function getValidAccessToken(db: Db, conn: ConnectionRow): Promise<string> {
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (!expiresAt || expiresAt - Date.now() > 60_000 || !conn.refresh_token) {
    return conn.access_token;
  }

  const clientId = Deno.env.get("SUPABASE_OAUTH_CLIENT_ID") || Deno.env.get("PATENTBOT_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("SUPABASE_OAUTH_CLIENT_SECRET") || Deno.env.get("PATENTBOT_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) return conn.access_token;

  const res = await fetch("https://api.supabase.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    console.warn("[OAUTH-TOKEN] Refresh failed:", res.status);
    throw new Error("Your Supabase connection has expired. Please reconnect your Supabase account.");
  }
  const t = await res.json();
  if (!t?.access_token) throw new Error("Your Supabase connection has expired. Please reconnect your Supabase account.");

  const newExpiry = new Date(Date.now() + (Number(t.expires_in) > 0 ? Number(t.expires_in) : 3600) * 1000).toISOString();
  await db.from("supabase_connections").update({
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? conn.refresh_token,
    token_expires_at: newExpiry,
  }).eq("id", conn.id);

  conn.access_token = t.access_token;
  conn.refresh_token = t.refresh_token ?? conn.refresh_token;
  conn.token_expires_at = newExpiry;
  return t.access_token;
}
