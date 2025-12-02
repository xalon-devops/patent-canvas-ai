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
import { format } from 'date-fns';
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
                Ideas Laboratory
              </h1>
              <p className="text-xl text-muted-foreground">
                Nurture innovations with AI-powered competitive intelligence and daily patent landscape monitoring
              </p>
            </div>
            <Button 
              onClick={() => setQuickCaptureOpen(true)} 
              variant="outline"
              className="gap-2 px-4 py-2"
            >
              <Plus className="w-4 h-4" />
              Quick Capture
            </Button>
            <Button 
              onClick={() => navigate('/new-application')} 
              className="gap-2 px-6 py-3 bg-gradient-primary hover:scale-105 transition-transform shadow-glow"
            >
              <Lightbulb className="w-5 h-5" />
              Full Patent Draft — $1,000
            </Button>
          </div>

          {/* Quick Idea Capture Dialog */}
          <QuickIdeaCapture 
            open={quickCaptureOpen} 
            onOpenChange={setQuickCaptureOpen}
            onSuccess={() => refetch()}
          />

          {/* Enhanced Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <Card className="glass group hover:shadow-glow transition-all duration-500 transform hover:scale-[1.02]">
              <CardContent className="p-8">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-primary/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <Lightbulb className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">{stats.totalIdeas}</p>
                    <p className="text-sm text-muted-foreground font-medium">Active Ideas</p>
                  </div>
                </div>
              </CardContent>
          </Card>

          <Card className="bg-white/60 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Eye className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.monitoringIdeas}</p>
                  <p className="text-sm text-muted-foreground">Being Monitored</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <FileText className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.draftedIdeas}</p>
                  <p className="text-sm text-muted-foreground">Drafted</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.unreadAlerts}</p>
                  <p className="text-sm text-muted-foreground">New Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Alerts */}
        {alerts.length > 0 && (
          <Card className="mb-8 bg-white/60 border-white/20 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Recent Monitoring Alerts
              </CardTitle>
              <CardDescription>
                Latest updates from your patent landscape monitoring
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Badge className={getSeverityColor(alert.severity)}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                  <div className="flex-1">
                    <h4 className="font-medium">{alert.title}</h4>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(alert.created_at), 'MMM dd, yyyy')}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Ideas Grid */}
        {ideas.length === 0 ? (
          <Card className="bg-white/60 border-white/20 backdrop-blur-sm">
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
              <Card key={idea.id} className="bg-white/60 border-white/20 backdrop-blur-sm hover:shadow-lg transition-shadow">
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
                      {format(new Date(idea.created_at), 'MMM dd, yyyy')}
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
                            · Last check: {format(new Date(idea.last_monitored_at), 'MMM dd')}
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