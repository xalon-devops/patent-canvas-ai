import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PATENT_VALUE_ESTIMATE, HIGH_SIMILARITY_THRESHOLD } from '@/lib/pricingConstants';

// ===== TYPE DEFINITIONS =====
export interface PatentSession {
  id: string;
  user_id: string;
  idea_prompt: string | null;
  status: string | null;
  patent_type: string | null;
  patentability_score: number | null;
  download_url: string | null;
  created_at: string | null;
  ai_analysis_complete: boolean | null;
  data_source: any;
  visual_analysis: any;
  technical_analysis: string | null;
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
  summary: string | null;
  url: string | null;
  source: string | null;
  assignee: string | null;
  patent_date: string | null;
  created_at: string | null;
  overlap_claims: string[] | null;
  difference_claims: string[] | null;
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

export interface Subscription {
  id: string;
  user_id: string;
  status: string;
  plan: string;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
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

// ===== MAIN DATA HOOK =====
export function usePatentData(userId: string | undefined) {
  const [sessions, setSessions] = useState<PatentSession[]>([]);
  const [ideas, setIdeas] = useState<PatentIdea[]>([]);
  const [priorArtBySession, setPriorArtBySession] = useState<Record<string, PriorArtResult[]>>({});
  const [alertsBySession, setAlertsBySession] = useState<Record<string, InfringementAlert[]>>({});
  const [alertsByIdea, setAlertsByIdea] = useState<Record<string, InfringementAlert[]>>({});
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [searchCredits, setSearchCredits] = useState<UserSearchCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch all patent sessions
  const fetchSessions = useCallback(async () => {
    if (!userId) return;
    
    const { data, error } = await supabase
      .from('patent_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setSessions(data || []);
    return data || [];
  }, [userId]);

  // Fetch all patent ideas
  const fetchIdeas = useCallback(async () => {
    if (!userId) return;
    
    const { data, error } = await supabase
      .from('patent_ideas')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setIdeas(data || []);
    return data || [];
  }, [userId]);

  // Fetch prior art results for all sessions
  const fetchPriorArt = useCallback(async (sessionIds: string[]) => {
    if (sessionIds.length === 0) return;

    const { data, error } = await supabase
      .from('prior_art_results')
      .select('*')
      .in('session_id', sessionIds)
      .order('similarity_score', { ascending: false });

    if (error) throw error;

    // Group by session
    const grouped = (data || []).reduce((acc, result) => {
      if (!acc[result.session_id]) acc[result.session_id] = [];
      acc[result.session_id].push(result);
      return acc;
    }, {} as Record<string, PriorArtResult[]>);

    setPriorArtBySession(grouped);
    return grouped;
  }, []);

  // Fetch infringement alerts
  const fetchAlerts = useCallback(async (sessionIds: string[], ideaIds: string[]) => {
    const { data, error } = await supabase
      .from('infringement_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by session
    const bySession = (data || []).reduce((acc, alert) => {
      if (alert.patent_session_id) {
        if (!acc[alert.patent_session_id]) acc[alert.patent_session_id] = [];
        acc[alert.patent_session_id].push(alert);
      }
      return acc;
    }, {} as Record<string, InfringementAlert[]>);

    // Group by idea
    const byIdea = (data || []).reduce((acc, alert) => {
      if (alert.patent_idea_id) {
        if (!acc[alert.patent_idea_id]) acc[alert.patent_idea_id] = [];
        acc[alert.patent_idea_id].push(alert);
      }
      return acc;
    }, {} as Record<string, InfringementAlert[]>);

    setAlertsBySession(bySession);
    setAlertsByIdea(byIdea);
    return { bySession, byIdea, all: data || [] };
  }, []);

  // Fetch subscription status
  const fetchSubscription = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    setSubscription(data);
    return data;
  }, [userId]);

  // Fetch search credits
  const fetchSearchCredits = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('user_search_credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    setSearchCredits(data);
    return data;
  }, [userId]);

  // Master fetch function
  const fetchAllData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [sessionsData, ideasData] = await Promise.all([
        fetchSessions(),
        fetchIdeas(),
        fetchSubscription(),
        fetchSearchCredits(),
      ]);

      const sessionIds = (sessionsData || []).map(s => s.id);
      const ideaIds = (ideasData || []).map(i => i.id);

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
  }, [userId, fetchSessions, fetchIdeas, fetchPriorArt, fetchAlerts, fetchSubscription, fetchSearchCredits, toast]);

  // Initial fetch
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Real-time subscription updates for all critical data changes
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('patent-data-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('[PatentData] Subscription changed, refetching...');
          fetchSubscription();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'application_payments',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('[PatentData] Application payment changed, refetching...');
          fetchAllData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patent_sessions',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('[PatentData] Patent session changed, refetching sessions...');
          fetchSessions();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patent_ideas',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('[PatentData] Patent idea changed, refetching ideas...');
          fetchIdeas();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'infringement_alerts',
        },
        () => {
          console.log('[PatentData] New infringement alert, refetching alerts...');
          fetchAlerts(sessions.map(s => s.id), ideas.map(i => i.id));
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_search_credits',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('[PatentData] Search credits changed, refetching...');
          fetchSearchCredits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchSubscription, fetchAllData, fetchSessions, fetchIdeas, fetchAlerts, fetchSearchCredits, sessions, ideas]);

  // Computed stats - single source of truth for all portfolio metrics
  const stats: PortfolioStats = {
    totalApplications: sessions.length,
    completedApplications: sessions.filter(s => s.status === 'completed').length,
    inProgressApplications: sessions.filter(s => s.status === 'in_progress').length,
    activePatents: sessions.filter(s => s.status === 'completed').length,
    totalIdeas: ideas.length,
    monitoringIdeas: ideas.filter(i => i.status === 'monitoring').length,
    draftedIdeas: ideas.filter(i => i.status === 'drafted').length,
    highSimilarityCount: Object.values(priorArtBySession)
      .flat()
      .filter(r => (r.similarity_score || 0) > HIGH_SIMILARITY_THRESHOLD).length,
    unreadAlerts: [
      ...Object.values(alertsBySession).flat(),
      ...Object.values(alertsByIdea).flat(),
    ].filter(a => !a.is_read).length,
    portfolioValue: sessions.filter(s => s.status === 'completed').length * PATENT_VALUE_ESTIMATE,
    maintenanceDue: 0, // Calculated in Active page based on dates
  };

  // Filter helpers
  const draftSessions = sessions.filter(s => s.status === 'in_progress');
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const pendingSessions = sessions; // All sessions shown in pending

  return {
    // Raw data
    sessions,
    ideas,
    priorArtBySession,
    alertsBySession,
    alertsByIdea,
    subscription,
    searchCredits,
    
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
    refetchAlerts: () => fetchAlerts(sessions.map(s => s.id), ideas.map(i => i.id)),
  };
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
        supabase.from('patent_sessions').select('*').eq('id', sessionId).single(),
        supabase.from('prior_art_results').select('*').eq('session_id', sessionId).order('similarity_score', { ascending: false }),
        supabase.from('infringement_alerts').select('*').eq('patent_session_id', sessionId).order('created_at', { ascending: false }),
      ]);

      if (sessionRes.error) throw sessionRes.error;
      setSession(sessionRes.data);
      setPriorArt(priorArtRes.data || []);
      setAlerts(alertsRes.data || []);
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
export function useAuthenticatedPatentData() {
  const [userId, setUserId] = useState<string | undefined>();
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const patentData = usePatentData(userId);

  return {
    ...patentData,
    userId,
    isAuthenticated: !!userId,
    authLoading,
    loading: authLoading || patentData.loading,
  };
}
