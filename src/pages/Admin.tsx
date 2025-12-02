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
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { PageSEO } from '@/components/SEO';

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

const Admin = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<AdminPatentSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<AdminPatentSession[]>([]);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>({ nexus: false, kronos: false });
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
        checkTrackingStatus();
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
      // Fetch all patent sessions with user email
      const { data, error } = await supabase
        .from('patent_sessions')
        .select(`
          *,
          users!patent_sessions_user_id_fkey(email)
        `)
        .order('created_at', { ascending: false });

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

  const checkTrackingStatus = async () => {
    try {
      // Check if NEXUS tracking script is present in DOM
      const nexusPresent = document.querySelector('script')?.textContent?.includes('NEXUS Universal Tracking') || false;
      
      // Check Kronos tracking by looking at localStorage and recent network activity
      const sessionId = localStorage.getItem("session_id");
      const kronosPresent = !!sessionId;
      
      // Check last activity times
      const nexusLastSeen = localStorage.getItem("nexus_cid") ? new Date().toISOString() : undefined;
      const kronosLastSeen = sessionId ? new Date().toISOString() : undefined;
      
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
        {/* Tracking Status Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Tracking Systems Status
            </CardTitle>
            <CardDescription>
              Real-time status of analytics and conversion tracking systems
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* NEXUS Tracking */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-purple-500" />
                  <div>
                    <h4 className="font-medium">NEXUS Tracking</h4>
                    <p className="text-sm text-muted-foreground">Referral & conversion tracking</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={trackingStatus.nexus ? "default" : "secondary"}>
                    {trackingStatus.nexus ? "✅ Active" : "⚠️ Inactive"}
                  </Badge>
                  {trackingStatus.nexusLastSeen && (
                    <p className="text-xs text-muted-foreground mt-1">
                      CID Generated
                    </p>
                  )}
                </div>
              </div>

              {/* Kronos Capital Tracking */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Eye className="h-5 w-5 text-blue-500" />
                  <div>
                    <h4 className="font-medium">Kronos Capital</h4>
                    <p className="text-sm text-muted-foreground">Session & page view tracking</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={trackingStatus.kronos ? "default" : "secondary"}>
                    {trackingStatus.kronos ? "✅ Active" : "⚠️ Inactive"}
                  </Badge>
                  {trackingStatus.kronosLastSeen && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Session Active
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={checkTrackingStatus}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Status
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
                        <div>Created: {format(new Date(session.created_at), 'MMM d, yyyy HH:mm')}</div>
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