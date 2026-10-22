import { ProtectedHeader } from '@/components/ProtectedHeader';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { getEdgeErrorMessage } from '@/lib/edgeError';
import ItemActionsMenu from '@/components/ItemActionsMenu';
import { renamePatentIdea, deletePatentIdea, setIdeaMonitoring } from '@/hooks/usePatentData';
import { 
  ArrowLeft, 
  Lightbulb, 
  FileText, 
  Calendar, 
  TrendingUp, 
  AlertTriangle,
  Play,
  Loader2,
  Search,
  RefreshCw
} from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { PageSEO } from '@/components/SEO';

interface PatentIdea {
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

interface IdeaAlert {
  id: string;
  title: string;
  description: string | null;
  severity: string | null;
  source_url: string | null;
  is_read: boolean | null;
  created_at: string;
}

const IdeaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  // Auth is enforced by ProtectedRoute
  const { user } = useUserProfile();
  const userId = user?.id;
  const [idea, setIdea] = useState<PatentIdea | null>(null);
  const [alerts, setAlerts] = useState<IdeaAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runningMonitoring, setRunningMonitoring] = useState(false);
  const [togglingMonitoring, setTogglingMonitoring] = useState(false);
  const [monitoringResults, setMonitoringResults] = useState<{ resultsFound?: number; highestSimilarity?: number | null } | null>(null);

  const loadIdea = useCallback(async () => {
    if (!id || !userId) return;
    setLoadError(null);
    try {
      const [ideaRes, alertsRes] = await Promise.all([
        supabase
          .from('patent_ideas')
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('infringement_alerts')
          .select('id, title, description, severity, source_url, is_read, created_at')
          .eq('patent_idea_id', id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (ideaRes.error) throw ideaRes.error;
      setIdea(ideaRes.data as PatentIdea | null);
      // Only show alerts when the caller owns the idea
      setAlerts(ideaRes.data && !alertsRes.error ? (alertsRes.data as IdeaAlert[]) : []);
    } catch (error: any) {
      console.error('Error loading idea:', error);
      setLoadError(error.message || 'Could not load this idea.');
    } finally {
      setLoading(false);
    }
  }, [id, userId]);

  useEffect(() => {
    setLoading(true);
    loadIdea();
  }, [loadIdea]);

  const handleRename = async (title: string) => {
    if (!idea) return;
    await renamePatentIdea(idea.id, title);
    setIdea(prev => (prev ? { ...prev, title } : prev));
  };

  // Throws so ItemActionsMenu shows the error inside the confirm dialog
  const handleDelete = async () => {
    if (!idea) return;
    await deletePatentIdea(idea.id);
    toast({
      title: "Idea deleted",
      description: "Your patent idea has been removed.",
    });
    navigate('/ideas');
  };

  const handleDraftPatent = () => {
    navigate(`/new-application?ideaId=${id}`);
  };

  const handleToggleMonitoring = async (enabled: boolean) => {
    if (!idea) return;
    setTogglingMonitoring(true);
    try {
      await setIdeaMonitoring(idea, enabled);
      setIdea(prev => (prev ? { ...prev, prior_art_monitoring: enabled } : prev));
      toast({
        title: enabled ? 'Monitoring on' : 'Monitoring off',
        description: enabled
          ? "We'll keep watching for new patents similar to this idea."
          : 'This idea is no longer being watched.',
      });
    } catch (error: any) {
      toast({ title: 'Could not update monitoring', description: error.message, variant: 'destructive' });
    } finally {
      setTogglingMonitoring(false);
    }
  };

  const handleRunMonitoring = async () => {
    if (!idea) return;
    
    setRunningMonitoring(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-prior-art-monitoring', {
        body: {
          ideaId: idea.id,
          searchQuery: [idea.title, idea.description].filter(Boolean).join(': '),
        }
      });

      if (error) {
        const parsed = await getEdgeErrorMessage(error, 'Failed to run prior art monitoring.');
        if (parsed.requiresSubscription) {
          toast({
            title: 'Out of free searches',
            description: 'Subscribe to Check & See for unlimited prior art searches.',
            variant: 'destructive',
          });
          navigate('/check');
          return;
        }
        throw new Error(parsed.message);
      }
      if (data?.success === false) throw new Error(data?.error || 'Failed to run prior art monitoring.');

      setMonitoringResults(data);
      await loadIdea();

      const found = data?.resultsFound ?? 0;
      toast({
        title: "Monitoring complete",
        description: `Found ${found} similar patent${found === 1 ? '' : 's'}. ${data?.highestSimilarity ? `Highest similarity: ${Math.round(data.highestSimilarity * 100)}%` : 'No high-similarity matches found.'}`,
      });
    } catch (error: any) {
      console.error('Monitoring error:', error);
      toast({
        title: "Monitoring failed",
        description: error.message || "Failed to run prior art monitoring.",
        variant: "destructive",
      });
    } finally {
      setRunningMonitoring(false);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'monitoring': return 'bg-primary';
      case 'drafted': return 'bg-secondary';
      case 'abandoned': return 'bg-muted';
      default: return 'bg-muted';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
        <Card className="w-full max-w-md text-center p-6 sm:p-8">
          <Lightbulb className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold mb-2">{loadError ? "Couldn't load this idea" : 'Idea not found'}</h2>
          <p className="text-muted-foreground mb-6">
            {loadError || "This patent idea doesn't exist or you don't have permission to view it."}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {loadError && (
              <Button variant="outline" onClick={() => { setLoading(true); loadIdea(); }}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try again
              </Button>
            )}
            <Button onClick={() => navigate('/ideas')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Ideas
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const status = idea.status || 'monitoring';
  const alreadyDrafted = status === 'drafted';

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PageSEO.IdeaDetail />
      {/* Header */}
      <ProtectedHeader title="Idea" backTo="/ideas" backLabel="Ideas">
        <ItemActionsMenu name={idea.title} itemLabel="idea" onRename={handleRename} onDelete={handleDelete} />
      </ProtectedHeader>

      <main className="container mx-auto px-4 py-6 sm:py-12 max-w-4xl">
        {/* Idea Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
              <div className="p-2.5 sm:p-3 bg-accent/10 rounded-xl flex-shrink-0">
                <Lightbulb className="h-6 w-6 sm:h-8 sm:w-8 text-accent" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2 break-words">{idea.title}</h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <Badge className={getStatusColor(status)}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Badge>
                  <Badge variant="outline">
                    {idea.patent_type === 'software' ? 'Software Patent' : 'Physical Patent'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Created {formatDate(idea.created_at)}
            </div>
            {idea.last_monitored_at && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Last monitored {formatDate(idea.last_monitored_at)}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <Card className="mb-6 shadow-card">
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
              {idea.description || 'No description yet.'}
            </p>
          </CardContent>
        </Card>

        {/* Analysis Data */}
        {idea.data_source && Object.keys(idea.data_source).length > 0 && (
          <Card className="mb-6 shadow-card">
            <CardHeader>
              <CardTitle>Analysis Summary</CardTitle>
              <CardDescription>
                Data collected during patent analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {idea.data_source.patentability_score && (
                <div>
                  <div className="text-sm font-medium mb-1">Patentability Score</div>
                  <div className="text-2xl font-bold text-primary">
                    {idea.data_source.patentability_score}%
                  </div>
                </div>
              )}
              {Array.isArray(idea.data_source.prior_art_results) && (
                <div>
                  <div className="text-sm font-medium mb-1">Prior Art Found</div>
                  <div className="text-lg">
                    {idea.data_source.prior_art_results.length} similar patents
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Monitoring */}
        <Card className="mb-6 shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <CardTitle>Prior art monitoring</CardTitle>
                <CardDescription>
                  Watch for newly published patents that look like this idea.
                </CardDescription>
              </div>
              <Switch
                checked={!!idea.prior_art_monitoring}
                disabled={togglingMonitoring}
                onCheckedChange={handleToggleMonitoring}
                aria-label="Prior art monitoring"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No alerts for this idea yet.</p>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${alert.severity === 'critical' || alert.severity === 'high' ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words">{alert.title}</p>
                    {alert.description && <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(alert.created_at)}</p>
                  </div>
                  {alert.source_url && (
                    <a href={alert.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex-shrink-0">
                      View
                    </a>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>
              Choose what to do with this patent idea
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => (alreadyDrafted ? navigate('/drafts') : handleDraftPatent())}
            >
              <Play className="h-4 w-4 mr-2" />
              {alreadyDrafted ? 'View Your Drafts' : 'Draft Full Patent Application'}
            </Button>
            <Button 
              variant="secondary"
              className="w-full"
              size="lg"
              onClick={handleRunMonitoring}
              disabled={runningMonitoring}
            >
              {runningMonitoring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running Prior Art Search...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Run Prior Art Monitoring
                </>
              )}
            </Button>
            {monitoringResults && (
              <div className="p-4 bg-muted/50 rounded-lg text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="font-medium">Latest Monitoring Results</span>
                </div>
                <p className="text-muted-foreground">
                  Found {monitoringResults.resultsFound ?? 0} similar patents.
                  {monitoringResults.highestSimilarity && (
                    <span className="block mt-1">
                      Highest similarity: <strong>{Math.round(monitoringResults.highestSimilarity * 100)}%</strong>
                    </span>
                  )}
                </p>
              </div>
            )}
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/ideas')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Ideas Lab
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default IdeaDetail;
