import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { 
  Shield, 
  Calendar, 
  AlertTriangle, 
  ArrowLeft, 
  Eye,
  DollarSign,
  TrendingUp,
  FileText,
  Search,
  ExternalLink,
  Clock
} from 'lucide-react';
import { format, addYears } from 'date-fns';

interface ActivePatent {
  id: string;
  user_id: string;
  idea_prompt: string;
  status: string;
  patent_type: string | null;
  patentability_score: number | null;
  created_at: string;
  patent_number?: string;
  grant_date?: string;
  maintenance_due?: string;
}

interface InfringementAlert {
  id: string;
  patent_session_id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  source_url: string | null;
  confidence_score: number | null;
  is_read: boolean;
  created_at: string;
}

const Active = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activePatents, setActivePatents] = useState<ActivePatent[]>([]);
  const [infringementAlerts, setInfringementAlerts] = useState<{[key: string]: InfringementAlert[]}>({});
  const [loading, setLoading] = useState(true);
  const [scanningInfringement, setScanningInfringement] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/auth');
        return;
      }
      setUser(session.user);
      await fetchActivePatents(session.user.id);
    };

    checkAuth();
  }, [navigate]);

  const fetchActivePatents = async (userId: string) => {
    try {
      // For demo purposes, we'll filter completed patent sessions as "active patents"
      const { data, error } = await supabase
        .from('patent_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Simulate active patents by adding patent numbers and grant dates
      const activePatentsData = (data || []).map((session, index) => ({
        ...session,
        patent_number: `US${(11000000 + index + Math.floor(Math.random() * 100000)).toString()}`,
        grant_date: addYears(new Date(session.created_at), 2).toISOString(),
        maintenance_due: addYears(new Date(session.created_at), 6).toISOString(),
      }));

      setActivePatents(activePatentsData);

      // Fetch infringement alerts for these patents
      if (activePatentsData.length > 0) {
        const sessionIds = activePatentsData.map(p => p.id);
        const { data: alertData, error: alertError } = await supabase
          .from('infringement_alerts')
          .select('*')
          .in('patent_session_id', sessionIds)
          .order('created_at', { ascending: false });

        if (alertError) throw alertError;

        // Group alerts by patent session
        const grouped = (alertData || []).reduce((acc, alert) => {
          if (!acc[alert.patent_session_id]) {
            acc[alert.patent_session_id] = [];
          }
          acc[alert.patent_session_id].push(alert);
          return acc;
        }, {} as {[key: string]: InfringementAlert[]});

        setInfringementAlerts(grouped);
      }
    } catch (error: any) {
      toast({
        title: "Error loading active patents",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const scanForInfringement = async (patentId: string) => {
    setScanningInfringement(patentId);
    
    try {
      // Simulate infringement scanning
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create mock alerts
      const mockAlert = {
        patent_session_id: patentId,
        alert_type: 'potential_infringement' as const,
        severity: 'medium' as const,
        title: 'Potential Infringement Detected',
        description: 'A new patent application with similar claims has been filed.',
        source_url: 'https://example.com/patent',
        confidence_score: 0.75,
        is_read: false,
      };

      const { error } = await supabase
        .from('infringement_alerts')
        .insert([mockAlert]);

      if (error) throw error;

      toast({
        title: "Infringement Scan Complete",
        description: "Found 1 potential infringement case",
        variant: "default",
      });

      // Refresh data
      if (user) {
        await fetchActivePatents(user.id);
      }
      
    } catch (error: any) {
      console.error('Error scanning for infringement:', error);
      toast({
        title: "Scan Failed",
        description: error.message || "Failed to scan for infringement",
        variant: "destructive",
      });
    } finally {
      setScanningInfringement(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-muted';
    }
  };

  const getMaintenanceStatus = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const monthsUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsUntilDue < 0) return { status: 'overdue', color: 'bg-red-500' };
    if (monthsUntilDue < 6) return { status: 'due soon', color: 'bg-orange-500' };
    return { status: 'current', color: 'bg-green-500' };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Loading your active patents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="safe-area py-8">
        <div className="content-width">
          {/* Header */}
          <div className="flex items-center gap-6 mb-12">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="gap-2 hover:scale-105 transition-transform"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Button>
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-3">
                Active Patent Portfolio
              </h1>
              <p className="text-xl text-muted-foreground">
                AI-powered infringement monitoring and automated portfolio management
              </p>
            </div>
            <Button 
              onClick={() => navigate('/new-application')} 
              className="gap-2 px-6 py-3 bg-gradient-primary hover:scale-105 transition-transform shadow-glow"
            >
              <Shield className="w-5 h-5" />
              Expand Portfolio
            </Button>
          </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activePatents.length}</p>
                  <p className="text-sm text-muted-foreground">Active Patents</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    ${(activePatents.length * 125000).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Portfolio Value</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {Object.values(infringementAlerts).reduce((total, alerts) => 
                      total + alerts.filter(a => !a.is_read).length, 0
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">New Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {activePatents.filter(p => {
                      if (!p.maintenance_due) return false;
                      const status = getMaintenanceStatus(p.maintenance_due);
                      return status.status !== 'current';
                    }).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Maintenance Due</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Patents List */}
        {activePatents.length === 0 ? (
          <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Active Patents</h3>
              <p className="text-muted-foreground mb-6">
                Once your patent applications are granted, they will appear here for monitoring.
              </p>
              <Button onClick={() => navigate('/pending')} className="bg-primary hover:bg-primary/90">
                <FileText className="w-4 h-4 mr-2" />
                View Pending Applications
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {activePatents.map((patent) => {
              const patentAlerts = infringementAlerts[patent.id] || [];
              const unreadAlerts = patentAlerts.filter(a => !a.is_read).length;
              const maintenanceStatus = patent.maintenance_due ? getMaintenanceStatus(patent.maintenance_due) : null;
              
              return (
                <Card key={patent.id} className="bg-card/90 border-white/20 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Shield className="w-6 h-6 text-primary" />
                          <CardTitle className="text-xl line-clamp-2">
                            {patent.idea_prompt}
                          </CardTitle>
                          {unreadAlerts > 0 && (
                            <Badge className="bg-red-500">
                              {unreadAlerts} Alert{unreadAlerts > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            Patent #: {patent.patent_number}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Granted: {patent.grant_date && format(new Date(patent.grant_date), 'MMM dd, yyyy')}
                          </div>
                          {patent.patent_type && (
                            <Badge variant="outline" className="text-xs">
                              {patent.patent_type}
                            </Badge>
                          )}
                          {maintenanceStatus && (
                            <Badge className={maintenanceStatus.color}>
                              Maintenance {maintenanceStatus.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Recent Alerts */}
                    {patentAlerts.length > 0 && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Recent Infringement Alerts
                        </h4>
                        <div className="space-y-2">
                          {patentAlerts.slice(0, 2).map((alert) => (
                            <div key={alert.id} className="flex items-center gap-3 p-3 bg-background/50 rounded-md">
                              <Badge className={getSeverityColor(alert.severity)}>
                                {alert.severity.toUpperCase()}
                              </Badge>
                              <div className="flex-1">
                                <p className="font-medium text-sm">{alert.title}</p>
                                <p className="text-xs text-muted-foreground">{alert.description}</p>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(alert.created_at), 'MMM dd')}
                              </div>
                              {alert.source_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(alert.source_url!, '_blank')}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                          {patentAlerts.length > 2 && (
                            <p className="text-sm text-muted-foreground text-center">
                              +{patentAlerts.length - 2} more alerts
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Patent Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Estimated Value</p>
                        <p className="font-medium">${(125000).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Years Remaining</p>
                        <p className="font-medium">
                          {patent.grant_date ? 
                            Math.max(0, 20 - Math.floor((new Date().getTime() - new Date(patent.grant_date).getTime()) / (1000 * 60 * 60 * 24 * 365)))
                            : 'N/A'
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Maintenance Due</p>
                        <p className="font-medium">
                          {patent.maintenance_due ? format(new Date(patent.maintenance_due), 'MMM yyyy') : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Alert Level</p>
                        <p className="font-medium">
                          {patentAlerts.length === 0 ? 'Green' : 
                           patentAlerts.some(a => a.severity === 'critical') ? 'Critical' :
                           patentAlerts.some(a => a.severity === 'high') ? 'High' : 'Medium'
                          }
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/session/${patent.id}`)}
                        className="gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View Patent
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => scanForInfringement(patent.id)}
                        disabled={scanningInfringement === patent.id}
                        className="gap-1"
                      >
                        {scanningInfringement === patent.id ? (
                          <TrendingUp className="w-4 h-4 animate-pulse" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        Scan for Infringement
                      </Button>

                      {patentAlerts.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/patent/${patent.id}/alerts`)}
                          className="gap-1"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          View Alerts ({unreadAlerts})
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );

};

export default Active;