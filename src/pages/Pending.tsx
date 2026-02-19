import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { 
  FileText, 
  Calendar, 
  Clock, 
  ArrowLeft, 
  Search,
  Eye,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader
} from 'lucide-react';
import { formatDate, formatDateShort } from '@/lib/dateUtils';
import { usePatentData } from '@/hooks/usePatentData';
import { PageSEO } from '@/components/SEO';

const Pending = () => {
  const [user, setUser] = useState<User | null>(null);
  const [searchingPriorArt, setSearchingPriorArt] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { 
    pendingSessions: sessions, 
    priorArtBySession: priorArtResults, 
    stats, 
    loading,
    refetch 
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

  const performPriorArtSearch = async (sessionId: string) => {
    setSearchingPriorArt(sessionId);
    try {
      const { data: searchData, error: searchError } = await supabase.functions.invoke('search-prior-art-enhanced', {
        body: { session_id: sessionId }
      });
      if (searchError) throw new Error(searchError.message || 'Failed to search prior art');
      if (!searchData?.success) throw new Error(searchData?.error || 'Prior art search failed');

      toast({
        title: "Prior Art Search Complete",
        description: `Found ${searchData.results_found || 0} relevant patents`,
      });
      await refetch();
    } catch (error: any) {
      let errorMessage = 'An unexpected error occurred';
      if (error.message?.includes('Lens.org API key')) {
        errorMessage = 'Lens API is not configured.';
      } else if (error.message?.includes('session not found')) {
        errorMessage = 'Patent session not found. Please refresh.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({ title: "Search Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setSearchingPriorArt(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      case 'in_progress': return <Loader className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
      case 'failed': return <XCircle className="w-3.5 h-3.5 text-red-500" />;
      default: return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  const getPatentabilityColor = (score: number | null) => {
    if (!score) return 'bg-muted';
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getPatentabilityLabel = (score: number | null) => {
    if (!score) return 'Unknown';
    if (score >= 0.8) return 'Strong';
    if (score >= 0.6) return 'Moderate';
    return 'Weak';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-6 h-6 border-3 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-xs text-muted-foreground">Loading applications…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PageSEO.Pending />
      <div className="safe-area py-4 sm:py-6">
        <div className="content-width px-3 sm:px-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="gap-1.5 self-start text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />
              Dashboard
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-1">
                Pending Applications
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">
                Patent prosecution tracking with AI competitive intelligence
              </p>
            </div>
            <Button onClick={() => navigate('/new-application')} size="sm" className="gap-1.5 bg-gradient-primary shadow-glow self-start sm:self-auto text-xs">
              <FileText className="w-3.5 h-3.5" />
              File New Patent
            </Button>
          </div>

          {/* Stats - compact 2x2 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-bold">{stats.totalApplications}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-secondary" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-bold">{stats.completedApplications}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <Loader className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-lg sm:text-xl font-bold">{stats.inProgressApplications}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">In Progress</p>
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
                    <p className="text-lg sm:text-xl font-bold">{stats.highSimilarityCount}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">High Similarity</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Applications List */}
          {sessions.length === 0 ? (
            <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
              <CardContent className="p-8 sm:p-10 text-center">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-base font-semibold mb-1">No Applications Yet</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Start your first patent application to begin tracking.
                </p>
                <Button onClick={() => navigate('/new-application')} size="sm" className="bg-primary hover:bg-primary/90 text-xs">
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Create First Application
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {sessions.map((session) => {
                const sessionPriorArt = priorArtResults[session.id] || [];
                const highSimilarityCount = sessionPriorArt.filter(r => r.similarity_score > 0.7).length;
                
                return (
                  <Card key={session.id} className="bg-card/90 border-white/20 backdrop-blur-sm">
                    <CardHeader className="p-3 sm:p-4 pb-2">
                      <div className="flex items-start gap-2">
                        {getStatusIcon(session.status)}
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm sm:text-base line-clamp-2 leading-snug">
                            {session.idea_prompt}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] sm:text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(session.created_at)}
                            </div>
                            <Badge className={`${getStatusColor(session.status)} text-[10px] px-1.5 py-0`}>
                              {session.status.replace('_', ' ')}
                            </Badge>
                            {session.patent_type && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {session.patent_type}
                              </Badge>
                            )}
                            {session.patentability_score && (
                              <Badge className={`${getPatentabilityColor(session.patentability_score)} text-[10px] px-1.5 py-0`}>
                                {getPatentabilityLabel(session.patentability_score)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 pt-0 space-y-2.5">
                      {/* Prior Art Summary */}
                      {sessionPriorArt.length > 0 && (
                        <div className="bg-muted/50 rounded-md p-2.5">
                          <h4 className="font-medium text-xs mb-2 flex items-center gap-1.5">
                            <Search className="w-3 h-3" />
                            Prior Art
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground text-[10px]">Found</p>
                              <p className="font-medium">{sessionPriorArt.length}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[10px]">High Similarity</p>
                              <p className="font-medium text-destructive">{highSimilarityCount}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[10px]">Highest</p>
                              <p className="font-medium">
                                {(Math.max(...sessionPriorArt.map(r => r.similarity_score)) * 100).toFixed(1)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-[10px]">Updated</p>
                              <p className="font-medium">
                                {formatDateShort(new Date(Math.max(...sessionPriorArt.map(r => new Date(r.created_at).getTime()))))}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button variant="outline" size="sm" className="gap-1 text-xs h-7"
                          onClick={() => navigate(`/session/${session.id}`)}>
                          <Eye className="w-3 h-3" />
                          Details
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 text-xs h-7"
                          onClick={() => performPriorArtSearch(session.id)}
                          disabled={searchingPriorArt === session.id}>
                          {searchingPriorArt === session.id ? (
                            <Loader className="w-3 h-3 animate-spin" />
                          ) : (
                            <Search className="w-3 h-3" />
                          )}
                          Prior Art
                        </Button>
                        {session.download_url && (
                          <Button variant="outline" size="sm" className="gap-1 text-xs h-7"
                            onClick={() => window.open(session.download_url!, '_blank')}>
                            <Download className="w-3 h-3" />
                            Download
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

export default Pending;
