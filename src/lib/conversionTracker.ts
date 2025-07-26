import { createClient } from "@supabase/supabase-js";

const KRONOS_SUPABASE_URL = "https://your-kronos.supabase.co"; // Replace with actual URL
const KRONOS_SUPABASE_KEY = "public-anon-key"; // Replace with actual anon key

const supabase = createClient(KRONOS_SUPABASE_URL, KRONOS_SUPABASE_KEY);

async function initSession(company: string) {
  let sessionId = localStorage.getItem("session_id");
  if (sessionId) return sessionId;

  const fingerprint = btoa(navigator.userAgent + window.innerWidth + window.innerHeight).slice(0, 12);
  const userAgent = navigator.userAgent;
  const isAuthenticated = !!localStorage.getItem("sb-access-token");

  const { data, error } = await supabase
    .from("user_sessions")
    .insert([
      {
        company,
        domain: window.location.hostname,
        fingerprint,
        user_agent: userAgent,
        is_authenticated: isAuthenticated,
      },
    ])
    .select()
    .single();

  if (data?.id) {
    localStorage.setItem("session_id", data.id);
    return data.id;
  }

  console.error("Session init error", error);
  return null;
}

export async function logEvent(event_type: string, metadata: any = {}, company = "Unknown") {
  const session_id = await initSession(company);
  if (!session_id) return;
  await supabase.from("user_events").insert([
    {
      session_id,
      event_type,
      route: window.location.pathname,
      metadata,
    },
  ]);
}