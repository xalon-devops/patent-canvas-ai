import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { PATENT_VALUE_ESTIMATE, HIGH_SIMILARITY_THRESHOLD } from '@/lib/pricingConstants';

// ===== TYPE DEFINITIONS =====
export interface PatentSession {
  id: string;
  user_id: string;
  idea_prompt: string | null;
  title?: string | null;
  status: string | null;
  patent_type: string | null;
  patentability_score: number | null;
  download_url: string | null;
  created_at: string | null;
  ai_analysis_complete: boolean | null;
  data_source: any;
  // Heavy columns are not loaded by list views
  visual_analysis?: any;
  technical_analysis?: string | null;
}

export interface PatentIdea {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  patent_type: string;
  data_source: any;
  prior_art_monitoring: boolean | null;
  last_monitored_at: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriorArtResult {
  id: string;
  session_id: string;
  title: string | null;
  similarity_score: number | null;
  publication_number: string | null;
  url: string | null;
  source: string | null;
  created_at: string | null;
  summary?: string | null;
  assignee?: string | null;
  patent_date?: string | null;
  overlap_claims?: string[] | null;
  difference_claims?: string[] | null;
}

export interface InfringementAlert {
  id: string;
  patent_session_id: string | null;
  patent_idea_id: string | null;
  alert_type: string;
  severity: string | null;
  title: string;
  description: string | null;
  source_url: string | null;
  confidence_score: number | null;
  is_read: boolean | null;
  created_at: string;
}

export interface UserSearchCredits {
  id: string;
  user_id: string;
  searches_used: number;
  free_searches_remaining: number;
  last_search_at: string | null;
}

// ===== COMPUTED STATS INTERFACE =====
export interface PortfolioStats {
  totalApplications: number;
  completedApplications: number;
  inProgressApplications: number;
  activePatents: number;
  totalIdeas: number;
  monitoringIdeas: number;
  draftedIdeas: number;
  highSimilarityCount: number;
  unreadAlerts: number;
  portfolioValue: number;
  maintenanceDue: number;
}

// ===== QUERY HELPERS =====

/** Max rows loaded for list views. Totals use exact counts so they stay right past this. */
export const LIST_LIMIT = 200;
/** Keep `in.(...)` filters short enough for URL length limits */
const ID_CHUNK = 80;

const SESSION_LIST_COLUMNS =
  'id, user_id, idea_prompt, title, status, patent_type, patentability_score, download_url, created_at, ai_analysis_complete, data_source';
const PRIOR_ART_COLUMNS = 'id, session_id, title, similarity_score, publication_number, url, source, created_at';
const ALERT_COLUMNS =
  'id, patent_session_id, patent_idea_id, alert_type, severity, title, description, source_url, confidence_score, is_read, created_at';

/** Session statuses that count as a draft still being worked on */
export const DRAFT_STATUSES = ['in_progress', 'draft'];
/** Session statuses that count as a finished / filed application */
export const ACTIVE_STATUSES = ['completed', 'filed'];

const isDraftStatus = (status: string | null) => !status || DRAFT_STATUSES.includes(status);
const isActiveStatus = (status: string | null) => !!status && ACTIVE_STATUSES.includes(status);

function chunk<T>(arr: T[], size = ID_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** PostgREST `or` filter matching alerts/monitors that belong to the given sessions or ideas */
export function ownedByFilter(sessionIds: string[], ideaIds: string[]): string {
  const parts: string[] = [];
  if (sessionIds.length) parts.push(`patent_session_id.in.(${sessionIds.join(',')})`);
  if (ideaIds.length) parts.push(`patent_idea_id.in.(${ideaIds.join(',')})`);
  return parts.join(',');
}

/** Split session+idea ids into small batches so each request URL stays short */
function idBatches(sessionIds: string[], ideaIds: string[]) {
  return [
    ...chunk(sessionIds).map(ids => ({ sessionIds: ids, ideaIds: [] as string[] })),
    ...chunk(ideaIds).map(ids => ({ sessionIds: [] as string[], ideaIds: ids })),
  ];
}

const channelSuffix = () => Math.random().toString(36).slice(2, 10);

// ===== MAIN DATA HOOK =====
export function usePatentData(userId: string | undefined) {
  const [sessions, setSessions] = useState<PatentSession[]>([]);
  const [ideas, setIdeas] = useState<PatentIdea[]>([]);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [ideaCount, setIdeaCount] = useState<number | null>(null);
  const [priorArtBySession, setPriorArtBySession] = useState<Record<string, PriorArtResult[]>>({});
  const [alertsBySession, setAlertsBySession] = useState<Record<string, InfringementAlert[]>>({});
  const [alertsByIdea, setAlertsByIdea] = useState<Record<string, InfringementAlert[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Latest ids for realtime handlers without re-subscribing on every data change
  const sessionIdsRef = useRef<string[]>([]);
  const ideaIdsRef = useRef<string[]>([]);
  const channelName = useRef(`patent-data-${channelSuffix()}`);

  const fetchSessions = useCallback(async () => {
    if (!userId) return [];
    const { data, error, count } = await supabase
      .from('patent_sessions')
      .select(SESSION_LIST_COLUMNS, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT);

    if (error) throw error;
    const rows = (data || []) as PatentSession[];
    sessionIdsRef.current = rows.map(s => s.id);
    setSessions(rows);
    setSessionCount(count ?? rows.length);
    return rows;
  }, [userId]);

  const fetchIdeas = useCallback(async () => {
    if (!userId) return [];
    const { data, error, count } = await supabase
      .from('patent_ideas')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT);

    if (error) throw error;
    const rows = (data || []) as PatentIdea[];
    ideaIdsRef.current = rows.map(i => i.id);
    setIdeas(rows);
    setIdeaCount(count ?? rows.length);
    return rows;
  }, [userId]);

  // Prior art results for the loaded sessions (light columns only)
  const fetchPriorArt = useCallback(async (sessionIds: string[]) => {
    if (sessionIds.length === 0) {
      setPriorArtBySession({});
      return {};
    }

    const responses = await Promise.all(
      chunk(sessionIds).map(ids =>
        supabase
          .from('prior_art_results')
          .select(PRIOR_ART_COLUMNS)
          .in('session_id', ids)
          .order('similarity_score', { ascending: false })
          .limit(ids.length * 15)
      )
    );

    const grouped: Record<string, PriorArtResult[]> = {};
    for (const { data, error } of responses) {
      if (error) throw error;
      for (const result of (data || []) as PriorArtResult[]) {
        (grouped[result.session_id] ||= []).push(result);
      }
    }

    setPriorArtBySession(grouped);
    return grouped;
  }, []);

  // Infringement alerts — always scoped to this user's sessions/ideas
  const fetchAlerts = useCallback(async (sessionIds: string[], ideaIds: string[]) => {
    if (sessionIds.length === 0 && ideaIds.length === 0) {
      setAlertsBySession({});
      setAlertsByIdea({});
      return { bySession: {}, byIdea: {}, all: [] as InfringementAlert[] };
    }

    const responses = await Promise.all(
      idBatches(sessionIds, ideaIds).map(b =>
        supabase
          .from('infringement_alerts')
          .select(ALERT_COLUMNS)
          .or(ownedByFilter(b.sessionIds, b.ideaIds))
          .order('created_at', { ascending: false })
          .limit(LIST_LIMIT)
      )
    );

    const seen = new Set<string>();
    const all: InfringementAlert[] = [];
    for (const { data, error } of responses) {
      if (error) throw error;
      for (const alert of (data || []) as InfringementAlert[]) {
        if (seen.has(alert.id)) continue;
        seen.add(alert.id);
        all.push(alert);
      }
    }
    all.sort((a, b) => b.created_at.localeCompare(a.created_at));

    const bySession: Record<string, InfringementAlert[]> = {};
    const byIdea: Record<string, InfringementAlert[]> = {};
    for (const alert of all) {
      if (alert.patent_session_id) (bySession[alert.patent_session_id] ||= []).push(alert);
      if (alert.patent_idea_id) (byIdea[alert.patent_idea_id] ||= []).push(alert);
    }

    setAlertsBySession(bySession);
    setAlertsByIdea(byIdea);
    return { bySession, byIdea, all };
  }, []);

  const fetchAllData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [sessionsData, ideasData] = await Promise.all([fetchSessions(), fetchIdeas()]);
      const sessionIds = sessionsData.map(s => s.id);
      const ideaIds = ideasData.map(i => i.id);

      await Promise.all([
        fetchPriorArt(sessionIds),
        fetchAlerts(sessionIds, ideaIds),
      ]);
    } catch (err: any) {
      console.error('Error fetching patent data:', err);
      setError(err.message);
      toast({
        title: "Error loading data",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, fetchSessions, fetchIdeas, fetchPriorArt, fetchAlerts, toast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const refetchAlerts = useCallback(
    () => fetchAlerts(sessionIdsRef.current, ideaIdsRef.current),
    [fetchAlerts]
  );

  // Realtime: one channel per hook instance, subscribed once per user
  useEffect(() => {
    if (!userId) return;

    const safe = (fn: () => Promise<unknown>) => () => {
      fn().catch(err => console.error('[PatentData] realtime refetch failed:', err));
    };

    const channel = supabase
      .channel(`${channelName.current}-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'application_payments', filter: `user_id=eq.${userId}` },
        safe(fetchAllData))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patent_sessions', filter: `user_id=eq.${userId}` },
        safe(async () => { const rows = await fetchSessions(); await fetchPriorArt(rows.map(r => r.id)); }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patent_ideas', filter: `user_id=eq.${userId}` },
        safe(fetchIdeas))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infringement_alerts' },
        safe(refetchAlerts))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchAllData, fetchSessions, fetchIdeas, fetchPriorArt, refetchAlerts]);

  // Filtered views
  const draftSessions = sessions.filter(s => isDraftStatus(s.status));
  const completedSessions = sessions.filter(s => isActiveStatus(s.status));
  const pendingSessions = sessions; // All sessions shown in pending

  // Computed stats - single source of truth for all portfolio metrics
  const stats: PortfolioStats = {
    totalApplications: sessionCount ?? sessions.length,
    completedApplications: completedSessions.length,
    inProgressApplications: draftSessions.length,
    activePatents: completedSessions.length,
    totalIdeas: ideaCount ?? ideas.length,
    monitoringIdeas: ideas.filter(i => i.status === 'monitoring').length,
    draftedIdeas: ideas.filter(i => i.status === 'drafted').length,
    highSimilarityCount: Object.values(priorArtBySession)
      .flat()
      .filter(r => (r.similarity_score || 0) > HIGH_SIMILARITY_THRESHOLD).length,
    unreadAlerts: Array.from(
      new Map(
        [...Object.values(alertsBySession).flat(), ...Object.values(alertsByIdea).flat()].map(a => [a.id, a])
      ).values()
    ).filter(a => !a.is_read).length,
    portfolioValue: completedSessions.length * PATENT_VALUE_ESTIMATE,
    maintenanceDue: 0, // Calculated in Active page based on dates
  };

  return {
    // Raw data
    sessions,
    ideas,
    priorArtBySession,
    alertsBySession,
    alertsByIdea,

    // Filtered views
    draftSessions,
    completedSessions,
    pendingSessions,

    // Computed stats
    stats,

    // State
    loading,
    error,

    // Actions
    refetch: fetchAllData,
    refetchSessions: fetchSessions,
    refetchIdeas: fetchIdeas,
    refetchAlerts,
  };
}

// ===== LIGHTWEIGHT COUNTS (dashboard tiles) =====
export interface PortfolioCounts {
  totalApplications: number;
  activePatents: number;
  totalIdeas: number;
  unreadAlerts: number;
}

/**
 * Head-only counts for dashboard tiles. Avoids loading full sessions, ideas,
 * prior-art results and alerts just to show four numbers.
 */
export function usePortfolioCounts(userId: string | undefined) {
  const [counts, setCounts] = useState<PortfolioCounts>({ totalApplications: 0, activePatents: 0, totalIdeas: 0, unreadAlerts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [sessionsRes, ideasRes, activeRes] = await Promise.all([
        supabase.from('patent_sessions').select('id', { count: 'exact' }).eq('user_id', userId).limit(LIST_LIMIT),
        supabase.from('patent_ideas').select('id', { count: 'exact' }).eq('user_id', userId).limit(LIST_LIMIT),
        supabase.from('patent_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('status', ACTIVE_STATUSES),
      ]);
      if (sessionsRes.error) throw sessionsRes.error;
      if (ideasRes.error) throw ideasRes.error;
      if (activeRes.error) throw activeRes.error;

      const sessionIds = (sessionsRes.data || []).map(r => r.id);
      const ideaIds = (ideasRes.data || []).map(r => r.id);

      let unreadAlerts = 0;
      if (sessionIds.length || ideaIds.length) {
        const alertRes = await Promise.all(
          idBatches(sessionIds, ideaIds).map(b =>
            supabase
              .from('infringement_alerts')
              .select('id', { count: 'exact', head: true })
              .eq('is_read', false)
              .or(ownedByFilter(b.sessionIds, b.ideaIds))
          )
        );
        for (const r of alertRes) {
          if (r.error) throw r.error;
          unreadAlerts += r.count || 0;
        }
      }

      setCounts({
        totalApplications: sessionsRes.count ?? sessionIds.length,
        activePatents: activeRes.count ?? 0,
        totalIdeas: ideasRes.count ?? ideaIds.length,
        unreadAlerts,
      });
    } catch (err: any) {
      console.error('Error loading portfolio counts:', err);
      setError(err.message || 'Could not load your portfolio.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { counts, loading, error, refetch: load };
}

// ===== SEARCH CREDITS (Check & See) =====
/** Free-search credits for the signed-in user, kept live via realtime. */
export function useSearchCredits(userId: string | undefined) {
  const [credits, setCredits] = useState<UserSearchCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const channelName = useRef(`search-credits-${channelSuffix()}`);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('user_search_credits')
      .select('id, user_id, searches_used, free_searches_remaining, last_search_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) console.error('Error loading search credits:', error);
    else setCredits(data as UserSearchCredits | null);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`${channelName.current}-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_search_credits', filter: `user_id=eq.${userId}` },
        () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  return { credits, loading, refetch: load };
}

// ===== INDIVIDUAL SESSION HOOK =====
export function usePatentSession(sessionId: string | undefined) {
  const [session, setSession] = useState<PatentSession | null>(null);
  const [priorArt, setPriorArt] = useState<PriorArtResult[]>([]);
  const [alerts, setAlerts] = useState<InfringementAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const [sessionRes, priorArtRes, alertsRes] = await Promise.all([
        supabase.from('patent_sessions').select('*').eq('id', sessionId).maybeSingle(),
        supabase.from('prior_art_results').select('*').eq('session_id', sessionId).order('similarity_score', { ascending: false }),
        supabase.from('infringement_alerts').select('*').eq('patent_session_id', sessionId).order('created_at', { ascending: false }),
      ]);

      if (sessionRes.error) throw sessionRes.error;
      setSession(sessionRes.data);
      // Only show related rows when the caller can actually see the session
      setPriorArt(sessionRes.data ? (priorArtRes.data || []) : []);
      setAlerts(sessionRes.data ? ((alertsRes.data || []) as InfringementAlert[]) : []);
    } catch (err: any) {
      toast({
        title: "Error loading session",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [sessionId, toast]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return { session, priorArt, alerts, loading, refetch: fetchSession };
}

// ===== AUTH + DATA COMBO HOOK =====
/** Patent data for the signed-in user (auth state comes from UserProfileContext). */
export function useAuthenticatedPatentData() {
  const { user, loading: authLoading } = useUserProfile();
  const userId = user?.id;
  const patentData = usePatentData(userId);

  return {
    ...patentData,
    userId,
    isAuthenticated: !!userId,
    authLoading,
    loading: authLoading || patentData.loading,
  };
}

// ===== OWNED-ITEM MUTATIONS (rename / delete under RLS) =====
// prior_art_monitoring, infringement_alerts and patent_documents have no FK to
// sessions/ideas, so their rows are cleaned up here before the parent is removed.

/** Rename a patent application. Throws when nothing was updated (not found / not owner). */
export async function renamePatentSession(sessionId: string, title: string) {
  const { data, error } = await supabase
    .from('patent_sessions')
    .update({ title })
    .eq('id', sessionId)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('This application could not be found. Refresh and try again.');
}

/** Delete a patent application and its monitoring rows. Refuses when the application was paid for. */
export async function deletePatentSession(sessionId: string) {
  const { data: payment, error: payErr } = await supabase
    .from('application_payments')
    .select('id, status')
    .eq('application_id', sessionId)
    .maybeSingle();
  if (payErr) throw payErr;
  if (payment && ['completed', 'paid', 'succeeded'].includes(payment.status)) {
    throw new Error('This application has a completed payment and cannot be deleted. Contact support if you need it removed.');
  }

  const { error: monErr } = await supabase.from('prior_art_monitoring').delete().eq('patent_session_id', sessionId);
  if (monErr) console.warn('Could not remove monitoring for session:', monErr);

  const { data, error } = await supabase.from('patent_sessions').delete().eq('id', sessionId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('This application could not be deleted. Refresh and try again.');
}

/** Rename an idea. Throws when nothing was updated. */
export async function renamePatentIdea(ideaId: string, title: string) {
  const { data, error } = await supabase
    .from('patent_ideas')
    .update({ title })
    .eq('id', ideaId)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('This idea could not be found. Refresh and try again.');
}

/** Delete an idea and its monitoring rows. */
export async function deletePatentIdea(ideaId: string) {
  const { error: monErr } = await supabase.from('prior_art_monitoring').delete().eq('patent_idea_id', ideaId);
  if (monErr) console.warn('Could not remove monitoring for idea:', monErr);

  const { data, error } = await supabase.from('patent_ideas').delete().eq('id', ideaId).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('This idea could not be deleted. Refresh and try again.');
}

/** Turn prior-art monitoring on/off for an idea: creates or removes its prior_art_monitoring row. */
export async function setIdeaMonitoring(idea: Pick<PatentIdea, 'id' | 'title' | 'description'>, enabled: boolean) {
  if (enabled) {
    const { data: existing, error: selErr } = await supabase
      .from('prior_art_monitoring')
      .select('id')
      .eq('patent_idea_id', idea.id)
      .limit(1);
    if (selErr) throw selErr;
    if (existing && existing.length > 0) {
      const { error } = await supabase.from('prior_art_monitoring').update({ is_active: true }).eq('patent_idea_id', idea.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('prior_art_monitoring').insert({
        patent_idea_id: idea.id,
        search_query: [idea.title, idea.description].filter(Boolean).join(': ').slice(0, 1000),
        is_active: true,
        last_search_at: new Date().toISOString(),
        next_search_at: new Date().toISOString(),
      });
      if (error) throw error;
    }
  } else {
    const { error } = await supabase.from('prior_art_monitoring').delete().eq('patent_idea_id', idea.id);
    if (error) throw error;
  }

  const { error } = await supabase.from('patent_ideas').update({ prior_art_monitoring: enabled }).eq('id', idea.id);
  if (error) throw error;
}
