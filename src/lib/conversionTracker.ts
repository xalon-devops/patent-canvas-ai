import { createClient } from "@supabase/supabase-js";

// 🔗 Kronos Capital Supabase (do not change)
const KRONOS_SUPABASE_URL = "https://omcetfxeloqyzuigzyag.supabase.co";
const KRONOS_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY2V0ZnhlbG9xeXp1aWd6eWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MTA3MDUsImV4cCI6MjA2ODA4NjcwNX0.84rXj5CzaVSHFIkKcdOt2wfLFeepNAt-FAqEJCNSWbg";

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