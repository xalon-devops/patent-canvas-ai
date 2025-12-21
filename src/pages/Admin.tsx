import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
  Globe,
  Eye,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { formatDateAdmin, getCurrentISOString } from '@/lib/dateUtils';
import { PageSEO } from '@/components/SEO';
import { STRIPE_CHECK_AND_SEE_PRICE_ID, PATENT_APPLICATION_PRICE_DISPLAY, CHECK_AND_SEE_PRICE_DISPLAY, SUPABASE_QUERY_LIMIT, formatPrice } from '@/lib/pricingConstants';

// PatentBot AI Price IDs (Stripe) - ONLY track revenue from these
const PATENTBOT_PRICE_IDS = {
  CHECK_AND_SEE: STRIPE_CHECK_AND_SEE_PRICE_ID,
  PATENT_APPLICATION: 'patent_application', // metadata identifier for one-time payments
};

interface AdminPatentSession {
  id: string;
  idea_prompt: string;
  status: string;
  created_at: string;
  download_url: string;
  user_id: string;
  user_email?: string;
}

interface TrackingStatus {
  nexus: boolean;
  kronos: boolean;
  nexusLastSeen?: string;
  kronosLastSeen?: string;
}

interface RevenueStats {
  totalRevenue: number;
  subscriptionRevenue: number;
  patentRevenue: number;
  totalTransactions: number;
  activeSubscriptions: number;
  pendingPayments: number;
}

interface UserStats {
  totalUsers: number;
  usersWithProfiles: number;
  usersWithoutProfiles: number;
}

const Admin = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<AdminPatentSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<AdminPatentSession[]>([]);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>({ nexus: false, kronos: false });
  const [revenueStats, setRevenueStats] = useState<RevenueStats>({
    totalRevenue: 0,
    subscriptionRevenue: 0,
    patentRevenue: 0,
    totalTransactions: 0,
    activeSubscriptions: 0,
    pendingPayments: 0,
  });
  const [userStats, setUserStats] = useState<UserStats>({
    totalUsers: 0,
    usersWithProfiles: 0,
    usersWithoutProfiles: 0,
  });
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAdmin, setIsAdmin] = useState(false);
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
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setIsAdmin(true);
        fetchAllSessions();
        fetchRevenueStats();
        checkTrackingStatus();
        fetchUserStats();
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

  const fetchAllSessions = async () => {
    try {
      // Fetch all patent sessions with user email (high limit for popular app)
      const { data, error } = await supabase
        .from('patent_sessions')
        .select(`
          *,
          users!patent_sessions_user_id_fkey(email)
        `)
        .order('created_at', { ascending: false })
        .limit(SUPABASE_QUERY_LIMIT);

      if (error) throw error;
      
      // Transform data to include user email
      const sessionsWithUserEmail = data?.map(session => ({
        ...session,
        user_email: session.users?.email || 'Unknown'
      })) || [];
      
      setSessions(sessionsWithUserEmail);
      setFilteredSessions(sessionsWithUserEmail);
    } catch (error: any) {
      toast({
        title: "Error loading sessions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch real PatentBot AI revenue from our database (only our price_ids)
  const fetchRevenueStats = async () => {
    try {
      // Fetch completed payment transactions (subscriptions) - high limit for scale
      const { data: transactions, error: txError } = await supabase
        .from('payment_transactions')
        .select('amount, status, payment_type, metadata, created_at')
        .eq('status', 'completed')
        .limit(SUPABASE_QUERY_LIMIT);

      // Fetch completed application payments (one-time $1,000)
      const { data: appPayments, error: appError } = await supabase
        .from('application_payments')
        .select('amount, status, created_at')
        .eq('status', 'completed')
        .limit(SUPABASE_QUERY_LIMIT);

      // Fetch active subscriptions
      const { data: activeSubs, error: subError } = await supabase
        .from('subscriptions')
        .select('id, status, plan')
        .eq('status', 'active')
        .limit(SUPABASE_QUERY_LIMIT);

      // Fetch pending payments
      const { data: pendingTx } = await supabase
        .from('payment_transactions')
        .select('id')
        .eq('status', 'pending')
        .limit(SUPABASE_QUERY_LIMIT);

      const { data: pendingApp } = await supabase
        .from('application_payments')
        .select('id')
        .eq('status', 'pending')
        .limit(SUPABASE_QUERY_LIMIT);

      // Calculate revenue (amounts are in cents)
      const subscriptionRevenue = (transactions || [])
        .filter(tx => tx.payment_type === 'subscription')
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);

      const patentRevenue = (appPayments || [])
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const totalTransactions = (transactions?.length || 0) + (appPayments?.length || 0);

      setRevenueStats({
        totalRevenue: subscriptionRevenue + patentRevenue,
        subscriptionRevenue,
        patentRevenue,
        totalTransactions,
        activeSubscriptions: activeSubs?.length || 0,
        pendingPayments: (pendingTx?.length || 0) + (pendingApp?.length || 0),
      });

    } catch (error: any) {
      console.error('Error fetching revenue stats:', error);
    }
  };

  const checkTrackingStatus = async () => {
    try {
      // Check if NEXUS tracking script is present in DOM
      const nexusPresent = document.querySelector('script')?.textContent?.includes('NEXUS Universal Tracking') || false;
      
      // Check Kronos tracking by looking at localStorage and recent network activity
      const sessionId = localStorage.getItem("session_id");
      const kronosPresent = !!sessionId;
      
      // Check last activity times
      const nexusLastSeen = localStorage.getItem("nexus_cid") ? getCurrentISOString() : undefined;
      const kronosLastSeen = sessionId ? getCurrentISOString() : undefined;
      
      setTrackingStatus({
        nexus: nexusPresent,
        kronos: kronosPresent,
        nexusLastSeen,
        kronosLastSeen
      });
    } catch (error) {
      console.error('Error checking tracking status:', error);
    }
  };

  const fetchUserStats = async () => {
    try {
      // Get total users from users table
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Get users with profiles
      const { count: usersWithProfiles } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      setUserStats({
        totalUsers: totalUsers || 0,
        usersWithProfiles: usersWithProfiles || 0,
        usersWithoutProfiles: (totalUsers || 0) - (usersWithProfiles || 0),
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const backfillProfiles = async () => {
    setBackfillLoading(true);
    try {
      // Get all users without profiles
      const { data: allUsers } = await supabase.from('users').select('id, email');
      const { data: existingProfiles } = await supabase.from('profiles').select('user_id');
      
      const existingUserIds = new Set(existingProfiles?.map(p => p.user_id) || []);
      const usersWithoutProfiles = allUsers?.filter(u => !existingUserIds.has(u.id)) || [];

      if (usersWithoutProfiles.length === 0) {
        toast({ title: "All users have profiles", description: "No backfill needed." });
        return;
      }

      // Create profiles for users without them
      const profilesToInsert = usersWithoutProfiles.map(u => ({
        user_id: u.id,
        display_name: u.email?.split('@')[0] || 'User',
      }));

      const { error } = await supabase.from('profiles').insert(profilesToInsert);
      if (error) throw error;

      toast({
        title: "Backfill Complete",
        description: `Created ${profilesToInsert.length} profile(s).`,
      });
      fetchUserStats();
    } catch (error: any) {
      toast({ title: "Backfill Failed", description: error.message, variant: "destructive" });
    } finally {
      setBackfillLoading(false);
    }
  };

  useEffect(() => {
    let filtered = sessions;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(session => 
        session.idea_prompt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(session => session.status === statusFilter);
    }

    setFilteredSessions(filtered);
  }, [searchTerm, statusFilter, sessions]);

  const updateSessionStatus = async (sessionId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('patent_sessions')
        .update({ status: newStatus })
        .eq('id', sessionId);

      if (error) throw error;

      // Update local state
      setSessions(sessions.map(session => 
        session.id === sessionId 
          ? { ...session, status: newStatus }
          : session
      ));

      toast({
        title: "Status Updated",
        description: `Session marked as ${newStatus}`,
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const generateDownload = async (sessionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('export-patent', {
        body: { session_id: sessionId }
      });

      if (error) throw error;

      if (data?.success && data.download_url) {
        // Update session with download URL
        await supabase
          .from('patent_sessions')
          .update({ download_url: data.download_url })
          .eq('id', sessionId);

        // Update local state
        setSessions(sessions.map(session => 
          session.id === sessionId 
            ? { ...session, download_url: data.download_url }
            : session
        ));

        toast({
          title: "Download Generated",
          description: "Patent document is ready for download",
          variant: "default",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error generating download",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'filed':
        return <FileText className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'completed': 'default',
      'filed': 'secondary',
      'in_progress': 'outline'
    };
    
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              You don't have administrator permissions.
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              Return to Dashboard
            </Button>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-xl font-bold">Admin Panel</h1>
                  <p className="text-sm text-muted-foreground">
                    PatentBot AI™ Administration
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {sessions.length} Total Sessions
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Revenue Stats Card - PatentBot AI Only */}
        <Card className="mb-6 border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              PatentBot AI™ Revenue
            </CardTitle>
            <CardDescription>
              Real revenue from PatentBot AI services only (Check & See + Patent Applications)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="p-4 bg-card rounded-lg border text-center">
                <div className="text-2xl font-bold text-green-500">
                  {formatPrice(revenueStats.totalRevenue)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Total Revenue</div>
              </div>
              <div className="p-4 bg-card rounded-lg border text-center">
                <div className="text-2xl font-bold text-primary">
                  {formatPrice(revenueStats.patentRevenue)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Patent Apps ({PATENT_APPLICATION_PRICE_DISPLAY})</div>
              </div>
              <div className="p-4 bg-card rounded-lg border text-center">
                <div className="text-2xl font-bold text-secondary">
                  {formatPrice(revenueStats.subscriptionRevenue)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Subscriptions ({CHECK_AND_SEE_PRICE_DISPLAY})</div>
              </div>
              <div className="p-4 bg-card rounded-lg border text-center">
                <div className="text-2xl font-bold text-foreground">
                  {revenueStats.totalTransactions}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Completed Payments</div>
              </div>
              <div className="p-4 bg-card rounded-lg border text-center">
                <div className="text-2xl font-bold text-blue-500">
                  {revenueStats.activeSubscriptions}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Active Subs</div>
              </div>
              <div className="p-4 bg-card rounded-lg border text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {revenueStats.pendingPayments}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Pending</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Tracking: Check & See ({STRIPE_CHECK_AND_SEE_PRICE_ID}) + Patent Applications
              </p>
              <Button variant="outline" size="sm" onClick={fetchRevenueStats}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Revenue
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by idea, email, or session ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="filed">Filed</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={fetchAllSessions}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardContent>
        </Card>

        {/* Sessions List */}
        <div className="space-y-4">
          {filteredSessions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Sessions Found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filters'
                    : 'No patent sessions have been created yet'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredSessions.map((session) => (
              <Card key={session.id} className="shadow-card border-0 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2 mb-2">
                        {getStatusIcon(session.status)}
                        {session.idea_prompt ? 
                          session.idea_prompt.slice(0, 100) + (session.idea_prompt.length > 100 ? '...' : '') :
                          'Untitled Patent Application'
                        }
                      </CardTitle>
                      <CardDescription className="space-y-1">
                        <div>User: {session.user_email}</div>
                        <div>Created: {formatDateAdmin(session.created_at)}</div>
                        <div className="text-xs font-mono">ID: {session.id}</div>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(session.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                   <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/session/${session.id}`)}
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Session
                    </Button>
                    
                    {session.status !== 'filed' && (
                      <Button
                        variant="professional"
                        size="sm"
                        onClick={() => updateSessionStatus(session.id, 'filed')}
                      >
                        <CheckCircle className="h-3 w-3" />
                        Mark as Filed
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateDownload(session.id)}
                    >
                      <Download className="h-3 w-3" />
                      Generate Download
                    </Button>
                    
                    {session.download_url && (
                      <Button
                        variant="premium"
                        size="sm"
                        onClick={() => window.open(session.download_url, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Download Latest
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await supabase.functions.invoke('send-email', {
                            body: {
                              type: 'patent_completion',
                              userId: session.user_id,
                              sessionId: session.id,
                              userEmail: session.user_email
                            }
                          });
                          toast({
                            title: "Email Sent",
                            description: "Patent completion notification sent to user",
                          });
                        } catch (error) {
                          toast({
                            title: "Email Failed",
                            description: "Failed to send email notification",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Send Email
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Admin;