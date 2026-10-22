import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MpepKnowledgeBaseCard } from '@/components/admin/MpepKnowledgeBaseCard';
import { User, Session } from '@supabase/supabase-js';
import { 
  Shield, 
  Users, 
  FileText, 
  Download, 
  Clock, 
  CheckCircle, 
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ArrowLeft,
  Activity,
  BarChart3,
  DollarSign,
  TrendingUp,
  Settings,
  Mail,
  Send,
  UserX,
  AlertCircle
} from 'lucide-react';
import { formatDateAdmin, getCurrentISOString } from '@/lib/dateUtils';
import { PageSEO } from '@/components/SEO';
import { STRIPE_CHECK_AND_SEE_PRICE_ID, PATENT_APPLICATION_PRICE_DISPLAY, CHECK_AND_SEE_PRICE_DISPLAY, SUPABASE_QUERY_LIMIT, formatPrice } from '@/lib/pricingConstants';
import AdminAnalyticsCharts from '@/components/admin/AdminAnalyticsCharts';
import AdminUserManagement from '@/components/admin/AdminUserManagement';
import { FunnelAnalytics } from '@/components/admin/FunnelAnalytics';

interface AdminPatentSession {
  id: string;
  idea_prompt: string;
  status: string;
  created_at: string;
  download_url: string;
  user_id: string;
  user_email?: string;
}

interface RevenueStats {
  totalRevenue: number;
  subscriptionRevenue: number;
  patentRevenue: number;
  totalTransactions: number;
  activeSubscriptions: number;
  pendingPayments: number;
}

interface AnalyticsData {
  dailyMetrics: {
    date: string;
    visitors: number;
    signups: number;
    conversions: number;
    revenue: number;
  }[];
  funnelData: {
    name: string;
    value: number;
    fill: string;
  }[];
  userStages: {
    stage: string;
    count: number;
    percentage: number;
  }[];
  conversionRate: number;
  visitorTrend: number;
  revenueTrend: number;
}

const Admin = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<AdminPatentSession[]>([]);
  const [sessionsPage, setSessionsPage] = useState(0);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [revenueStats, setRevenueStats] = useState<RevenueStats>({
    totalRevenue: 0,
    subscriptionRevenue: 0,
    patentRevenue: 0,
    totalTransactions: 0,
    activeSubscriptions: 0,
    pendingPayments: 0,
  });
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    dailyMetrics: [],
    funnelData: [],
    userStages: [],
    conversionRate: 0,
    visitorTrend: 0,
    revenueTrend: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics');
  const [winbackLoading, setWinbackLoading] = useState(false);
  const [winbackPreview, setWinbackPreview] = useState<{ targetCount: number; willSendThisRun: number; targetUsers: any[] } | null>(null);
  const [selectedWinbackType, setSelectedWinbackType] = useState<string>('never_started');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/auth');
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/auth');
      } else {
        checkAdminAccess(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAdminAccess = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setIsAdmin(true);
        fetchAllData();
      } else {
        toast({
          title: "Access Denied",
          description: "You don't have admin permissions",
          variant: "destructive",
        });
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast({
        title: "Error checking admin access",
        description: error.message,
        variant: "destructive",
      });
      navigate('/dashboard');
    }
  };

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    // Sessions are paginated server-side and loaded when the Sessions tab is opened
    await Promise.all([
      fetchRevenueStats(),
      fetchAnalytics()
    ]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const SESSIONS_PAGE_SIZE = 25;

  const fetchSessionsPage = useCallback(async (page: number, search: string, status: string) => {
    setSessionsLoading(true);
    try {
      let query = supabase
        .from('patent_sessions')
        // Only the columns the list renders (data_source / analyses can be very large)
        .select('id, idea_prompt, status, created_at, download_url, user_id, users!patent_sessions_user_id_fkey(email)', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (status !== 'all') query = query.eq('status', status);

      const term = search.trim();
      if (term) {
        if (/^[0-9a-f-]{36}$/i.test(term)) {
          query = query.eq('id', term);
        } else if (term.includes('@')) {
          const { data: matchedUsers } = await supabase
            .from('users')
            .select('id')
            .ilike('email', `%${term}%`)
            .limit(100);
          const ids = (matchedUsers || []).map((u) => u.id);
          if (ids.length === 0) {
            setSessions([]);
            setSessionsTotal(0);
            return;
          }
          query = query.in('user_id', ids);
        } else {
          query = query.ilike('idea_prompt', `%${term.replace(/[%_]/g, '')}%`);
        }
      }

      const from = page * SESSIONS_PAGE_SIZE;
      const { data, error, count } = await query.range(from, from + SESSIONS_PAGE_SIZE - 1);
      if (error) throw error;

      setSessions((data || []).map((row: any) => ({
        ...row,
        user_email: row.users?.email || 'Unknown',
      })));
      setSessionsTotal(count ?? 0);
    } catch (error: any) {
      console.error('Error loading sessions:', error);
      toast({ title: 'Error loading sessions', description: error.message, variant: 'destructive' });
    } finally {
      setSessionsLoading(false);
    }
  }, [toast]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset to first page when filters change
  useEffect(() => {
    setSessionsPage(0);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    if (!isAdmin || activeTab !== 'sessions') return;
    fetchSessionsPage(sessionsPage, debouncedSearch, statusFilter);
  }, [isAdmin, activeTab, sessionsPage, debouncedSearch, statusFilter, fetchSessionsPage]);

  const fetchRevenueStats = async () => {
    try {
      const [
        { data: transactions },
        { data: appPayments },
        { count: activeSubsCount },
        { count: pendingTxCount },
        { count: pendingAppCount },
      ] = await Promise.all([
        // Completed payment transactions
        supabase
          .from('payment_transactions')
          .select('amount, payment_type')
          .eq('status', 'completed')
          .limit(SUPABASE_QUERY_LIMIT),
        // Completed application payments
        supabase
          .from('application_payments')
          .select('amount')
          .eq('status', 'completed')
          .gt('amount', 0)
          .limit(SUPABASE_QUERY_LIMIT),
        // Active paid subscriptions (exclude free grants)
        supabase
          .from('subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active')
          .neq('plan', 'free_grant'),
        supabase
          .from('payment_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('application_payments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ]);

      const subscriptionRevenue = (transactions || [])
        .filter(tx => tx.payment_type === 'subscription')
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);

      const patentRevenue = (appPayments || [])
        .filter(p => p.amount > 0) // Only count paid apps
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      setRevenueStats({
        totalRevenue: subscriptionRevenue + patentRevenue,
        subscriptionRevenue,
        patentRevenue,
        totalTransactions: (transactions?.length || 0) + (appPayments?.filter(p => p.amount > 0).length || 0),
        activeSubscriptions: activeSubsCount || 0,
        pendingPayments: (pendingTxCount || 0) + (pendingAppCount || 0),
      });
    } catch (error: any) {
      console.error('Error fetching revenue stats:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      // Get last 14 days of data for trend comparison
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const since = twoWeeksAgo.toISOString();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const subCount = (status: string) => supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)
        .neq('plan', 'free_grant');

      // All independent queries run in parallel; totals use head-only counts
      const [
        { data: usersData },
        { data: sessionsData },
        { data: paymentsData },
        { data: subPayments },
        { count: totalUsers },
        { data: uniqueSessionUsers },
        { count: completedSessions },
        { data: paidAppUsers },
        { count: trialingCountRaw },
        { count: activeSubCountRaw },
        { count: cancelledCountRaw },
        { count: canceledCountRaw },
        { count: pastDueCountRaw },
        { count: freeGrantCount },
        { count: abandonedCount },
      ] = await Promise.all([
        supabase.from('users').select('created_at').gte('created_at', since),
        supabase.from('patent_sessions').select('created_at, status').gte('created_at', since),
        supabase.from('application_payments').select('created_at, amount, status').eq('status', 'completed').gte('created_at', since),
        supabase.from('payment_transactions').select('created_at, amount, status, payment_type, description').eq('status', 'completed').gte('created_at', since),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        // NOTE: capped by PostgREST max_rows (1000); distinct counts need an RPC for exactness
        supabase.from('patent_sessions').select('user_id').limit(SUPABASE_QUERY_LIMIT),
        supabase.from('patent_sessions').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('application_payments').select('user_id').eq('status', 'completed').limit(SUPABASE_QUERY_LIMIT),
        subCount('trialing'),
        subCount('active'),
        subCount('cancelled'),
        subCount('canceled'),
        subCount('past_due'),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('plan', 'free_grant').eq('status', 'active'),
        supabase.from('payment_transactions').select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', oneHourAgo),
      ]);

      // Filter to PatentBot only (descriptions contain 'Patent' or 'Check & See')
      const patentbotSubPayments = (subPayments || []).filter(p =>
        p.description?.includes('Patent') ||
        p.description?.includes('Check & See') ||
        p.payment_type === 'subscription'
      );

      const usersWithSessions = new Set(uniqueSessionUsers?.map(s => s.user_id)).size;
      const uniquePaidUsers = new Set(paidAppUsers?.map(p => p.user_id)).size;
      const trialingCount = trialingCountRaw || 0;
      const activeSubCount = activeSubCountRaw || 0;
      const cancelledCount = (cancelledCountRaw || 0) + (canceledCountRaw || 0);
      const pastDueCount = pastDueCountRaw || 0;

      // Generate daily metrics for last 7 days (signups-based, no fake visitors)
      const dailyMetrics = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayUsers = usersData?.filter(u => u.created_at.startsWith(dateStr)) || [];
        const daySessions = sessionsData?.filter(s => s.created_at.startsWith(dateStr)) || [];
        const dayPayments = [
          ...(paymentsData?.filter(p => p.created_at.startsWith(dateStr)) || []),
          ...(patentbotSubPayments?.filter(p => p.created_at.startsWith(dateStr)) || [])
        ];
        
        const signups = dayUsers.length;
        
        dailyMetrics.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          visitors: 0, // Will be populated by Lovable analytics if available
          signups,
          conversions: dayPayments.length,
          revenue: dayPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
        });
      }

      // Calculate trends (this week vs last week)
      const thisWeekSignups = dailyMetrics.reduce((sum, d) => sum + d.signups, 0);
      let lastWeekSignups = 0;
      for (let i = 13; i >= 7; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayUsers = usersData?.filter(u => u.created_at.startsWith(dateStr)) || [];
        lastWeekSignups += dayUsers.length;
      }
      const signupTrend = lastWeekSignups > 0 
        ? Math.round(((thisWeekSignups - lastWeekSignups) / lastWeekSignups) * 100)
        : thisWeekSignups > 0 ? 100 : 0;

      // Revenue trend
      const thisWeekRevenue = dailyMetrics.reduce((sum, d) => sum + d.revenue, 0);
      let lastWeekRevenue = 0;
      for (let i = 13; i >= 7; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayPayments = [
          ...(paymentsData?.filter(p => p.created_at.startsWith(dateStr)) || []),
          ...(patentbotSubPayments?.filter(p => p.created_at.startsWith(dateStr)) || [])
        ];
        lastWeekRevenue += dayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      }
      const revenueTrend = lastWeekRevenue > 0
        ? Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100)
        : thisWeekRevenue > 0 ? 100 : 0;

      // Funnel data - real user journey
      const funnelData = [
        { name: 'Signed Up', value: totalUsers || 0, fill: 'hsl(var(--primary))' },
        { name: 'Started Application', value: usersWithSessions, fill: 'hsl(var(--secondary))' },
        { name: 'Completed Draft', value: completedSessions || 0, fill: 'hsl(var(--accent))' },
        { name: 'Trialing', value: trialingCount, fill: '#8b5cf6' },
        { name: 'Paid', value: uniquePaidUsers + activeSubCount, fill: '#10b981' }
      ];

      // User stages with subscription status breakdown
      const total = totalUsers || 1;
      const userStages = [
        { stage: 'Free Users', count: (totalUsers || 0) - activeSubCount - uniquePaidUsers - trialingCount - (freeGrantCount || 0), percentage: 0 },
        { stage: 'Trialing', count: trialingCount, percentage: 0 },
        { stage: 'Active Subs', count: activeSubCount, percentage: 0 },
        { stage: 'Patent Buyers', count: uniquePaidUsers, percentage: 0 },
        { stage: 'Free Grants', count: freeGrantCount || 0, percentage: 0 },
        { stage: 'Past Due', count: pastDueCount, percentage: 0 },
        { stage: 'Cancelled', count: cancelledCount, percentage: 0 },
        { stage: 'Abandoned', count: abandonedCount || 0, percentage: 0 }
      ].filter(s => s.count > 0).map(s => ({ ...s, percentage: (s.count / total) * 100 }));

      const totalConversions = uniquePaidUsers + activeSubCount;
      const conversionRate = total > 0 ? (totalConversions / total) * 100 : 0;

      setAnalyticsData({
        dailyMetrics,
        funnelData,
        userStages,
        conversionRate,
        visitorTrend: signupTrend, // Using signup trend since we don't have real visitor data
        revenueTrend
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const updateSessionStatus = async (sessionId: string, newStatus: string) => {
    try {
      const { data: updatedRows, error } = await supabase
        .from('patent_sessions')
        .update({ status: newStatus })
        .eq('id', sessionId)
        .select('id');

      if (error) throw error;
      // RLS silently filters rows the caller may not update - report instead of faking success
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('Update was not applied (no admin UPDATE permission on patent_sessions).');
      }

      setSessions(prev => prev.map(session => 
        session.id === sessionId ? { ...session, status: newStatus } : session
      ));

      toast({ title: "Status Updated", description: `Session marked as ${newStatus}` });
    } catch (error: any) {
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
    }
  };

  const generateDownload = async (sessionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('export-patent', {
        body: { session_id: sessionId }
      });

      if (error) throw error;

      if (data?.success && data.download_url) {
        // Persisting the URL needs an admin UPDATE policy; the link itself works regardless
        const { error: persistError } = await supabase
          .from('patent_sessions')
          .update({ download_url: data.download_url })
          .eq('id', sessionId);
        if (persistError) console.warn('Could not persist download_url:', persistError);

        setSessions(prev => prev.map(session => 
          session.id === sessionId ? { ...session, download_url: data.download_url } : session
        ));

        toast({ title: "Download Generated", description: "Patent document is ready for download" });
      } else {
        throw new Error(data?.error || 'Export did not return a download link.');
      }
    } catch (error: any) {
      toast({ title: "Error generating download", description: error.message, variant: "destructive" });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'filed': return <FileText className="h-4 w-4 text-blue-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'completed': 'default',
      'filed': 'secondary',
      'in_progress': 'outline'
    };
    return <Badge variant={variants[status] || 'outline'}>{status.replace('_', ' ').toUpperCase()}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Winback email handlers
  const handleWinbackPreview = async () => {
    setWinbackLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-winback-emails', {
        body: { targetType: selectedWinbackType, dryRun: true }
      });

      if (error) throw error;

      setWinbackPreview({
        targetCount: data.targetCount,
        willSendThisRun: data.willSendThisRun ?? data.targetCount,
        targetUsers: data.targetUsers || []
      });

      toast({
        title: "Preview Ready",
        description: `Found ${data.targetCount} users to email${data.willSendThisRun < data.targetCount ? ` (up to ${data.willSendThisRun} per run)` : ''}`,
      });
    } catch (error: any) {
      toast({
        title: "Preview Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setWinbackLoading(false);
    }
  };

  const handleSendWinbackEmails = async () => {
    if (!winbackPreview || winbackPreview.targetCount === 0) {
      toast({
        title: "No Users Selected",
        description: "Run a preview first to see target users",
        variant: "destructive"
      });
      return;
    }

    setWinbackLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-winback-emails', {
        body: { targetType: selectedWinbackType, dryRun: false }
      });

      if (error) throw error;

      toast({
        title: "Winback Emails Sent!",
        description: `Sent ${data.sentCount} emails (${data.errorCount} errors)${data.remaining ? `. ${data.remaining} remaining - send again to continue.` : ''}`,
      });

      setWinbackPreview(null);
    } catch (error: any) {
      toast({
        title: "Send Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setWinbackLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">You don't have administrator permissions.</p>
            <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PageSEO.Admin />
      
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-xl font-bold">Admin Panel</h1>
                  <p className="text-sm text-muted-foreground">PatentBot AI™ Administration</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                <Activity className="h-3 w-3 mr-1" />
                Live
              </Badge>
              <Button variant="outline" size="sm" onClick={() => { fetchAllData(); if (activeTab === 'sessions') fetchSessionsPage(sessionsPage, debouncedSearch, statusFilter); }}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Revenue Summary */}
        <Card className="mb-6 border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              PatentBot AI™ Revenue (Lifetime)
            </CardTitle>
            <CardDescription>Only PatentBot AI revenue (excludes other apps using this Stripe)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="p-4 bg-card rounded-lg border text-center">
                <div className="text-lg sm:text-2xl font-bold text-green-500">{formatPrice(revenueStats.totalRevenue)}</div>
                <div className="text-xs text-muted-foreground mt-1">Total Revenue</div>
              </div>
              <div className="p-4 bg-card rounded-lg border text-center">
                <div className="text-lg sm:text-2xl font-bold text-primary">{formatPrice(revenueStats.patentRevenue)}</div>
                <div className="text-xs text-muted-foreground mt-1">Patent Apps</div>
              </div>
              <div className="p-4 bg-card rounded-lg border text-center">
                <div className="text-lg sm:text-2xl font-bold text-secondary">{formatPrice(revenueStats.subscriptionRevenue)}</div>
                <div className="text-xs text-muted-foreground mt-1">Subscriptions</div>
              </div>
              <div className="p-4 bg-card rounded-lg border text-center">
                <div className="text-lg sm:text-2xl font-bold text-foreground">{revenueStats.totalTransactions}</div>
                <div className="text-xs text-muted-foreground mt-1">Paid Transactions</div>
              </div>
              <div className="p-4 bg-card rounded-lg border text-center">
                <div className="text-lg sm:text-2xl font-bold text-blue-500">{revenueStats.activeSubscriptions}</div>
                <div className="text-xs text-muted-foreground mt-1">Active Subs</div>
              </div>
              <div className="p-4 bg-card rounded-lg border text-center">
                <div className="text-lg sm:text-2xl font-bold text-yellow-500">{revenueStats.pendingPayments}</div>
                <div className="text-xs text-muted-foreground mt-1">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <MpepKnowledgeBaseCard />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Sessions</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="space-y-8">
              {/* Funnel Analytics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Conversion Funnel Tracking
                  </CardTitle>
                  <CardDescription>Track where visitors drop off in the signup funnel</CardDescription>
                </CardHeader>
                <CardContent>
                  <FunnelAnalytics />
                </CardContent>
              </Card>
              
              {/* Legacy Analytics Charts */}
              <AdminAnalyticsCharts data={analyticsData} />
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <AdminUserManagement />
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters & Search
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by idea, email, or session ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="filed">Filed</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {sessionsLoading && sessions.length === 0 ? (
                <div className="flex justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sessions.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Sessions Found</h3>
                    <p className="text-muted-foreground">
                      {searchTerm || statusFilter !== 'all' 
                        ? 'Try adjusting your search or filters'
                        : 'No patent sessions have been created yet'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                sessions.map((session) => (
                  <Card key={session.id} className="shadow-card border-0 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base flex items-center gap-2 mb-2 break-words">
                            {getStatusIcon(session.status)}
                            {session.idea_prompt ? 
                              session.idea_prompt.slice(0, 100) + (session.idea_prompt.length > 100 ? '...' : '') :
                              'Untitled Patent Application'}
                          </CardTitle>
                          <CardDescription className="space-y-1">
                            <div>User: {session.user_email}</div>
                            <div>Created: {formatDateAdmin(session.created_at)}</div>
                            <div className="text-xs font-mono break-all">ID: {session.id}</div>
                          </CardDescription>
                        </div>
                        {getStatusBadge(session.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/session/${session.id}`)}>
                          <ExternalLink className="h-3 w-3" />
                          View Session
                        </Button>
                        {session.status !== 'filed' && (
                          <Button variant="default" size="sm" onClick={() => updateSessionStatus(session.id, 'filed')}>
                            <CheckCircle className="h-3 w-3" />
                            Mark as Filed
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => generateDownload(session.id)}>
                          <Download className="h-3 w-3" />
                          Generate Download
                        </Button>
                        {session.download_url && (
                          <Button variant="secondary" size="sm" onClick={() => window.open(session.download_url, '_blank')}>
                            <ExternalLink className="h-3 w-3" />
                            Download
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
              {sessionsTotal > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Showing {sessionsPage * SESSIONS_PAGE_SIZE + 1}–{Math.min((sessionsPage + 1) * SESSIONS_PAGE_SIZE, sessionsTotal)} of {sessionsTotal} sessions
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={sessionsPage === 0 || sessionsLoading}
                      onClick={() => setSessionsPage(p => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(sessionsPage + 1) * SESSIONS_PAGE_SIZE >= sessionsTotal || sessionsLoading}
                      onClick={() => setSessionsPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Admin Privileges</CardTitle>
                  <CardDescription>Your admin account has full access</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Bypass all paywalls</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>View all user data</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Grant free user access</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Manage admin roles</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Info</CardTitle>
                  <CardDescription>PatentBot AI configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Stripe Price</span>
                    <code className="text-xs">auto-resolved server-side</code>
                  </div>

                  <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Patent App Price</span>
                    <span className="font-medium">{PATENT_APPLICATION_PRICE_DISPLAY}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Subscription Price</span>
                    <span className="font-medium">{CHECK_AND_SEE_PRICE_DISPLAY}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Free Trial</span>
                    <span className="font-medium text-green-600">7 days</span>
                  </div>
                </CardContent>
              </Card>

              {/* Winback Email Campaign Card */}
              <Card className="md:col-span-2 border-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    Winback Email Campaigns
                  </CardTitle>
                  <CardDescription>Send targeted emails to inactive/unpaid users to bring them back</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Campaign Type Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Target Audience</label>
                    <Select value={selectedWinbackType} onValueChange={setSelectedWinbackType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select audience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never_started">
                          <div className="flex items-center gap-2">
                            <UserX className="h-4 w-4" />
                            <span>Never Started - Signed up but no sessions</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="abandoned_draft">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span>Abandoned Drafts - Started but didn't pay</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="churned_subscription">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            <span>Churned Subscribers - Canceled/expired subs</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="all_inactive">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>All Inactive - Everyone without active payment</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preview Results */}
                  {winbackPreview && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Target Users Found:</span>
                        <Badge variant={winbackPreview.targetCount > 0 ? "default" : "secondary"}>
                          {winbackPreview.targetCount} users
                        </Badge>
                      </div>
                      {winbackPreview.targetUsers.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-sm text-muted-foreground">Preview (first 10):</span>
                          <div className="grid gap-1 text-sm">
                            {winbackPreview.targetUsers.map((u: any, i: number) => (
                              <div key={i} className="flex justify-between items-center py-1 px-2 bg-background rounded">
                                <span className="truncate">{u.email}</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(u.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      variant="outline"
                      onClick={handleWinbackPreview}
                      disabled={winbackLoading}
                    >
                      {winbackLoading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Preview Recipients
                    </Button>
                    <Button 
                      onClick={handleSendWinbackEmails}
                      disabled={winbackLoading || !winbackPreview || winbackPreview.targetCount === 0}
                      className="bg-primary"
                    >
                      {winbackLoading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Send to {winbackPreview ? Math.min(winbackPreview.willSendThisRun, winbackPreview.targetCount) : 0} Users
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-3 w-3" />
                    Emails use PatentBot branded templates via Resend. All sends are logged to email_notifications table.
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Email Recovery Stats</CardTitle>
                  <CardDescription>Abandoned checkout emails sent via Stripe webhook</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-4">
                    Abandoned checkout emails are automatically sent when a Stripe checkout session expires. 
                    Check the email_notifications table for delivery status and the Stripe dashboard for checkout session expiry events.
                  </div>
                  <div className="flex gap-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open('https://dashboard.stripe.com/events', '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Stripe Events
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(`https://supabase.com/dashboard/project/jdkogqskjsmwlhigaecb/editor`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Email Logs
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
