import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  FileText,
  Search,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { formatDate, formatDateShort, formatMonthYear, calculateYearsRemaining } from '@/lib/dateUtils';
import { usePatentData, PatentSession, InfringementAlert } from '@/hooks/usePatentData';
import { PATENT_VALUE_ESTIMATE, MAINTENANCE_DUE_SOON_MONTHS, formatDollars, calculatePortfolioValue } from '@/lib/pricingConstants';
import { PageSEO } from '@/components/SEO';

const Active = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { 
    completedSessions, 
    alertsBySession: infringementAlerts, 
    stats,
    loading,
  } = usePatentData(user?.id);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/auth');
        return;
      }
      setUser(session.user);
    };
    checkAuth();
  }, [navigate]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-muted';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-6 h-6 border-3 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-xs text-muted-foreground">Loading active patents…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PageSEO.Active />
      <div className="safe-area py-4 sm:py-6">
        <div className="content-width px-3 sm:px-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="gap-1.5 self-start text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Dashboard
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-1">
                Active Patent Portfolio
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">
                Infringement monitoring & portfolio management
              </p>
            </div>
            <Button 
              onClick={() => navigate('/new-application')} 
              size="sm"
              className="gap-1.5 bg-gradient-primary shadow-glow self-start sm:self-auto text-xs"
            >
              <Shield className="w-3.5 h-3.5" />
              Expand Portfolio
            </Button>
          </div>

          {/* Stats Overview - compact 2x2 grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Shield className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-bold">{stats.activePatents}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <DollarSign className="w-4 h-4 text-secondary" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-bold">{formatDollars(stats.portfolioValue)}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Value</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-destructive/10 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-bold">{stats.unreadAlerts}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Alerts</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <Clock className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-bold">{stats.completedApplications}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Patents List */}
          {completedSessions.length === 0 ? (
            <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
              <CardContent className="p-8 sm:p-10 text-center">
                <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-base font-semibold mb-1">No Active Patents</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Granted patents will appear here for monitoring.
                </p>
                <Button onClick={() => navigate('/pending')} size="sm" className="bg-primary hover:bg-primary/90 text-xs">
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  View Pending
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {completedSessions.map((patent) => {
                const patentAlerts = infringementAlerts[patent.id] || [];
                const unreadAlerts = patentAlerts.filter(a => !a.is_read).length;
                
                return (
                  <Card key={patent.id} className="bg-card/90 border-white/20 backdrop-blur-sm">
                    <CardHeader className="p-3 sm:p-4 pb-2">
                      <div className="flex items-start gap-2">
                        <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm sm:text-base line-clamp-2 leading-snug">
                            {patent.idea_prompt}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] sm:text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(patent.created_at)}
                            </div>
                            {patent.patent_type && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {patent.patent_type}
                              </Badge>
                            )}
                            {unreadAlerts > 0 && (
                              <Badge className="bg-red-500 text-[10px] px-1.5 py-0">
                                {unreadAlerts} alert{unreadAlerts > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 pt-0 space-y-2.5">
                      {/* Alerts */}
                      {patentAlerts.length > 0 && (
                        <div className="bg-muted/50 rounded-md p-2.5">
                          <h4 className="font-medium text-xs mb-2 flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3" />
                            Infringement Alerts
                          </h4>
                          <div className="space-y-1.5">
                            {patentAlerts.slice(0, 2).map((alert) => (
                              <div key={alert.id} className="flex items-center gap-2 p-2 bg-background/50 rounded text-xs">
                                <Badge className={`${getSeverityColor(alert.severity)} text-[10px] px-1.5 py-0`}>
                                  {alert.severity}
                                </Badge>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{alert.title}</p>
                                </div>
                                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                  {formatDateShort(alert.created_at)}
                                </span>
                                {alert.source_url && (
                                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0"
                                    onClick={() => window.open(alert.source_url!, '_blank')}>
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                            {patentAlerts.length > 2 && (
                              <p className="text-[10px] text-muted-foreground text-center">
                                +{patentAlerts.length - 2} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Details grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground text-[10px]">Est. Value</p>
                          <p className="font-medium">{formatDollars(PATENT_VALUE_ESTIMATE)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px]">Status</p>
                          <p className="font-medium">Completed</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px]">Alert Level</p>
                          <p className="font-medium">
                            {patentAlerts.length === 0 ? 'Green' : 
                             patentAlerts.some(a => a.severity === 'critical') ? 'Critical' :
                             patentAlerts.some(a => a.severity === 'high') ? 'High' : 'Medium'}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" className="gap-1 text-xs h-7"
                          onClick={() => navigate(`/session/${patent.id}`)}>
                          <Eye className="w-3 h-3" />
                          View
                        </Button>
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
