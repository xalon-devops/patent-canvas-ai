import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Funnel steps in order
export const FUNNEL_STEPS = {
  LANDING: 'landing',
  AUTH_VIEW: 'auth_view',
  AUTH_SIGNUP_START: 'auth_signup_start',
  AUTH_SIGNUP_COMPLETE: 'auth_signup_complete',
  AUTH_LOGIN: 'auth_login',
  DASHBOARD: 'dashboard',
  NEW_APPLICATION_START: 'new_application_start',
  PATENT_SESSION_CREATED: 'patent_session_created',
  PAYMENT_INITIATED: 'payment_initiated',
  PAYMENT_COMPLETE: 'payment_complete',
  CHECK_PAGE_VIEW: 'check_page_view',
  PRIOR_ART_SEARCH: 'prior_art_search',
} as const;

type FunnelStep = typeof FUNNEL_STEPS[keyof typeof FUNNEL_STEPS];

// Get or create session ID
function getSessionId(): string {
  try {
    let sessionId = sessionStorage.getItem('funnel_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('funnel_session_id', sessionId);
    }
    return sessionId;
  } catch {
    return crypto.randomUUID();
  }
}

// Track a funnel event
export async function trackFunnelEvent(
  eventType: string,
  funnelStep: FunnelStep,
  metadata: Record<string, any> = {}
) {
  const sessionId = getSessionId();
  const pagePath = window.location.pathname;

  try {
    // Get current user if authenticated
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('funnel_events').insert({
      session_id: sessionId,
      user_id: user?.id || null,
      event_type: eventType,
      funnel_step: funnelStep,
      page_path: pagePath,
      metadata: {
        ...metadata,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
        screen_width: window.innerWidth,
        timestamp: new Date().toISOString(),
      },
    });

    console.log('[Funnel]', eventType, funnelStep, metadata);
  } catch (error) {
    console.error('[Funnel] Error tracking event:', error);
  }
}

// Hook for automatic page tracking
export function useFunnelTracking() {
  const location = useLocation();
  const trackedPaths = useRef(new Set<string>());

  // Map routes to funnel steps
  const getStepForPath = useCallback((path: string): FunnelStep | null => {
    if (path === '/') return FUNNEL_STEPS.LANDING;
    if (path === '/auth') return FUNNEL_STEPS.AUTH_VIEW;
    if (path === '/dashboard') return FUNNEL_STEPS.DASHBOARD;
    if (path === '/new-application') return FUNNEL_STEPS.NEW_APPLICATION_START;
    if (path === '/check') return FUNNEL_STEPS.CHECK_PAGE_VIEW;
    if (path.startsWith('/session/')) return FUNNEL_STEPS.PATENT_SESSION_CREATED;
    return null;
  }, []);

  useEffect(() => {
    const path = location.pathname;
    const step = getStepForPath(path);
    
    // Only track each path once per session to avoid duplicates on re-renders
    if (step && !trackedPaths.current.has(path)) {
      trackedPaths.current.add(path);
      trackFunnelEvent('page_view', step, {
        search: location.search,
        hash: location.hash,
      });
    }
  }, [location.pathname, location.search, getStepForPath]);

  // Return tracking function for manual events
  return { trackFunnelEvent };
}

// Specific tracking functions for key conversion events
export function trackSignupStart() {
  trackFunnelEvent('signup_form_interaction', FUNNEL_STEPS.AUTH_SIGNUP_START);
}

export function trackSignupComplete(userId: string, email: string) {
  trackFunnelEvent('signup_complete', FUNNEL_STEPS.AUTH_SIGNUP_COMPLETE, { userId, email });
}

export function trackLogin(userId: string, email: string) {
  trackFunnelEvent('login', FUNNEL_STEPS.AUTH_LOGIN, { userId, email });
}

export function trackPatentSessionCreated(sessionId: string) {
  trackFunnelEvent('patent_session_created', FUNNEL_STEPS.PATENT_SESSION_CREATED, { sessionId });
}

export function trackPaymentInitiated(amount: number, type: string) {
  trackFunnelEvent('payment_initiated', FUNNEL_STEPS.PAYMENT_INITIATED, { amount, type });
}

export function trackPaymentComplete(amount: number, type: string, paymentId?: string) {
  trackFunnelEvent('payment_complete', FUNNEL_STEPS.PAYMENT_COMPLETE, { amount, type, paymentId });
}

export function trackPriorArtSearch(query: string) {
  trackFunnelEvent('prior_art_search', FUNNEL_STEPS.PRIOR_ART_SEARCH, { query: query.slice(0, 100) });
}
