import { supabase } from "@/integrations/supabase/client";

// Generate a simple session fingerprint
function generateFingerprint(): string {
  return btoa(navigator.userAgent + window.innerWidth + window.innerHeight).slice(0, 12);
}

// Get or create session ID from localStorage
function getSessionId(): string {
  let sessionId = localStorage.getItem("conversion_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("conversion_session_id", sessionId);
  }
  return sessionId;
}

/**
 * Log conversion events for analytics
 * Events are stored in console for now - can be extended to store in DB
 */
export async function logEvent(event_type: string, metadata: any = {}, company = "PatentBot AI") {
  const sessionId = getSessionId();
  const fingerprint = generateFingerprint();
  
  const eventData = {
    session_id: sessionId,
    event_type,
    route: window.location.pathname,
    metadata: {
      ...metadata,
      company,
      fingerprint,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      domain: window.location.hostname,
    },
  };

  // Log to console for debugging
  console.log("[ConversionTracker]", event_type, eventData);

  // Get current user if authenticated
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // Could store in a conversion_events table if needed
    // For now, just log authenticated events
    console.log("[ConversionTracker] Authenticated user:", user.email, event_type);
  }
}

// Track page views
export function trackPageView(pageName?: string) {
  logEvent("page_view", { page: pageName || window.location.pathname });
}

// Track button clicks
export function trackButtonClick(buttonName: string, context?: Record<string, any>) {
  logEvent("button_click", { button: buttonName, ...context });
}

// Track signup/login
export function trackAuth(action: "signup" | "login" | "logout") {
  logEvent(`auth_${action}`);
}

// Track payment events
export function trackPayment(action: string, amount?: number, planType?: string) {
  logEvent("payment", { action, amount, plan_type: planType });
}
