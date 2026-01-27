import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { 
  Lightbulb, 
  Calendar, 
  TrendingUp, 
  AlertTriangle, 
  Eye, 
  FileText, 
  ArrowLeft,
  Clock,
  Shield,
  Search,
  Plus
} from 'lucide-react';
import { formatDate, formatDateShort } from '@/lib/dateUtils';
import { usePatentData, PatentIdea, InfringementAlert } from '@/hooks/usePatentData';
import QuickIdeaCapture from '@/components/QuickIdeaCapture';
import { PageSEO } from '@/components/SEO';

const Ideas = () => {
  const [user, setUser] = useState<User | null>(null);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Use centralized data hook
  const { 
    ideas, 
    alertsByIdea,
    stats,
    loading,
    refetch
  } = usePatentData(user?.id);

  // Flatten alerts for display
  const alerts = Object.values(alertsByIdea).flat();

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

  const handleViewIdea = (ideaId: string) => {
    navigate(`/idea/${ideaId}`);
  };

  const handleDraftPatent = (ideaId: string) => {
    navigate(`/new-application?ideaId=${ideaId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'monitoring': return 'bg-primary';
      case 'drafted': return 'bg-secondary';
      case 'abandoned': return 'bg-muted';
      default: return 'bg-muted';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-destructive';
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
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Loading your ideas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PageSEO.Ideas />
      <div className="safe-area py-6 sm:py-8 px-4 sm:px-6">
        <div className="content-width">
          {/* Header */}
          <div className="space-y-4 mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Dashboard</span>
            </Button>
            
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
                Ideas Laboratory
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                AI-powered patent monitoring
              </p>
            </div>
            
            <div className="flex flex-col xs:flex-row gap-2">
              <Button 
                onClick={() => setQuickCaptureOpen(true)} 
                variant="outline"
                size="sm"
                className="gap-2 flex-1 xs:flex-none"
              >
                <Plus className="w-4 h-4" />
                Quick Capture
              </Button>
              <Button 
                onClick={() => navigate('/new-application')} 
                size="sm"
                className="gap-2 flex-1 xs:flex-none"
              >
                <Lightbulb className="w-4 h-4" />
                Draft Patent
              </Button>
            </div>
          </div>

          {/* Quick Idea Capture Dialog */}
          <QuickIdeaCapture 
            open={quickCaptureOpen} 
            onOpenChange={setQuickCaptureOpen}
            onSuccess={() => refetch()}
          />

          {/* Stats Overview - Compact Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <Card className="bg-card/80">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                    <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg sm:text-xl font-bold">{stats.totalIdeas}</p>
                    <p className="text-xs text-muted-foreground truncate">Ideas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg flex-shrink-0">
                    <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg sm:text-xl font-bold">{stats.monitoringIdeas}</p>
                    <p className="text-xs text-muted-foreground truncate">Monitoring</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg flex-shrink-0">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg sm:text-xl font-bold">{stats.draftedIdeas}</p>
                    <p className="text-xs text-muted-foreground truncate">Drafted</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/80">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg sm:text-xl font-bold">{stats.unreadAlerts}</p>
                    <p className="text-xs text-muted-foreground truncate">Alerts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        {/* Recent Alerts */}
        {alerts.length > 0 && (
          <Card className="mb-6 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="w-4 h-4" />
                Recent Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex flex-col xs:flex-row xs:items-center gap-2 p-3 border rounded-lg">
                  <Badge className={`${getSeverityColor(alert.severity)} text-xs flex-shrink-0 w-fit`}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{alert.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-1">{alert.description}</p>
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    {formatDate(alert.created_at)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Ideas Grid */}
        {ideas.length === 0 ? (
          <Card className="bg-card/80 border-border/20 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <Lightbulb className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Ideas Yet</h3>
              <p className="text-muted-foreground mb-6">
                Start tracking your innovative ideas and monitor the patent landscape.
              </p>
              <Button onClick={() => navigate('/new-application')} className="gap-2">
                <Lightbulb className="w-4 h-4" />
                Create Your First Idea
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ideas.map((idea) => (
              <Card key={idea.id} className="bg-card/80 border-border/20 backdrop-blur-sm hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-2">{idea.title}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        {idea.description}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(idea.status)}>
                      {idea.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(idea.created_at)}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {idea.patent_type}
                    </Badge>
                  </div>

                  {idea.prior_art_monitoring && (
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">
                        Monitoring enabled
                        {idea.last_monitored_at && (
                          <span className="ml-1">
                            · Last check: {formatDateShort(idea.last_monitored_at)}
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewIdea(idea.id)}
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    {idea.status === 'monitoring' && (
                      <Button
                        size="sm"
                        onClick={() => handleDraftPatent(idea.id)}
                        className="flex-1"
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Draft Patent
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );

};

export default Ideas;