import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { format } from 'date-fns';

interface PatentSession {
  id: string;
  user_id: string;
  idea_prompt: string;
  status: string;
  patent_type: string | null;
  patentability_score: number | null;
  download_url: string | null;
  created_at: string;
}

interface PriorArtResult {
  id: string;
  session_id: string;
  title: string;
  similarity_score: number;
  publication_number: string;
  created_at: string;
}

const Pending = () => {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<PatentSession[]>([]);
  const [priorArtResults, setPriorArtResults] = useState<{[key: string]: PriorArtResult[]}>({});
  const [loading, setLoading] = useState(true);
  const [searchingPriorArt, setSearchingPriorArt] = useState<string | null>(null);
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
      await fetchSessions(session.user.id);
    };

    checkAuth();
  }, [navigate]);

  const fetchSessions = async (userId: string) => {
    setLoading(true);
    try {
      // Fetch both patent_sessions and patent_ideas to show all applications
      const [sessionsResult, ideasResult] = await Promise.all([
        supabase
          .from('patent_sessions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('patent_ideas')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      ]);

      if (sessionsResult.error) throw sessionsResult.error;
      if (ideasResult.error) throw ideasResult.error;

      // Convert patent_ideas to match PatentSession format for display
      const convertedIdeas = (ideasResult.data || []).map(idea => ({
        id: idea.id,
        user_id: idea.user_id,
        created_at: idea.created_at,
        idea_prompt: idea.description,
        status: idea.status === 'monitoring' ? 'in_progress' : idea.status,
        patent_type: idea.patent_type,
        patentability_score: null,
        download_url: null,
        ai_analysis_complete: false,
        data_source: idea.data_source || {},
        visual_analysis: {},
        technical_analysis: null
      }));

      // Combine and sort all applications by creation date
      const allSessions = [...(sessionsResult.data || []), ...convertedIdeas]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setSessions(allSessions);

      // Fetch prior art results for patent_sessions only
      const sessionIds = (sessionsResult.data || []).map(s => s.id);
      if (sessionIds.length > 0) {
        const { data: priorArtData, error: priorArtError } = await supabase
          .from('prior_art_results')
          .select('*')
          .in('session_id', sessionIds)
          .order('similarity_score', { ascending: false });

        if (priorArtError) throw priorArtError;

        // Group prior art results by session
        const grouped = (priorArtData || []).reduce((acc, result) => {
          if (!acc[result.session_id]) {
            acc[result.session_id] = [];
          }
          acc[result.session_id].push(result);
          return acc;
        }, {} as {[key: string]: PriorArtResult[]});

        setPriorArtResults(grouped);
      }
    } catch (error: any) {
      toast({
        title: "Error loading applications",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const performPriorArtSearch = async (sessionId: string) => {
    setSearchingPriorArt(sessionId);
    
    try {
      const { data: searchData, error: searchError } = await supabase.functions.invoke('search-prior-art', {
        body: { session_id: sessionId }
      });

      if (searchError) {
        console.error('Prior art search error:', searchError);
        throw new Error(searchError.message || 'Failed to search prior art');
      }

      if (!searchData?.success) {
        console.error('Prior art search failed:', searchData);
        throw new Error(searchData?.error || 'Prior art search failed');
      }

      toast({
        title: "Prior Art Search Complete",
        description: `Found ${searchData.results_found || 0} relevant patents`,
        variant: "default",
      });

      // Refresh the data
      if (user) {
        await fetchSessions(user.id);
      }
      
    } catch (error: any) {
      console.error('Error in prior art search:', error);
      
      let errorMessage = 'An unexpected error occurred';
      if (error.message?.includes('Lens.org API key')) {
        errorMessage = 'Lens API is not configured. Please check system configuration.';
      } else if (error.message?.includes('session not found')) {
        errorMessage = 'Patent session not found. Please try refreshing the page.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Search Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSearchingPriorArt(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in_progress': return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-yellow-500" />;
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
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Loading your applications...</p>
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
                Pending Applications
              </h1>
              <p className="text-xl text-muted-foreground">
                Real-time patent prosecution tracking with AI-powered competitive intelligence
              </p>
            </div>
            <Button 
              onClick={() => navigate('/new-application')} 
              className="gap-2 px-6 py-3 bg-gradient-primary hover:scale-105 transition-transform shadow-glow"
            >
              <FileText className="w-5 h-5" />
              File New Patent
            </Button>
          </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{sessions.length}</p>
                  <p className="text-sm text-muted-foreground">Total Applications</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {sessions.filter(s => s.status === 'completed').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Loader className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {sessions.filter(s => s.status === 'in_progress').length}
                  </p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
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
                    {Object.values(priorArtResults).reduce((total, results) => 
                      total + results.filter(r => r.similarity_score > 0.7).length, 0
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">High Similarity</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Applications List */}
        {sessions.length === 0 ? (
          <Card className="bg-card/90 border-white/20 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Applications Yet</h3>
              <p className="text-muted-foreground mb-6">
                Start your first patent application to begin tracking its progress.
              </p>
              <Button onClick={() => navigate('/new-application')} className="bg-primary hover:bg-primary/90">
                <FileText className="w-4 h-4 mr-2" />
                Create Your First Application
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sessions.map((session) => {
              const sessionPriorArt = priorArtResults[session.id] || [];
              const highSimilarityCount = sessionPriorArt.filter(r => r.similarity_score > 0.7).length;
              
              return (
                <Card key={session.id} className="bg-card/90 border-white/20 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusIcon(session.status)}
                          <CardTitle className="text-xl line-clamp-2">
                            {session.idea_prompt}
                          </CardTitle>
                          <Badge className={getStatusColor(session.status)}>
                            {session.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Created: {format(new Date(session.created_at), 'MMM dd, yyyy')}
                          </div>
                          {session.patent_type && (
                            <Badge variant="outline" className="text-xs">
                              {session.patent_type}
                            </Badge>
                          )}
                          {session.patentability_score && (
                            <Badge className={getPatentabilityColor(session.patentability_score)}>
                              {getPatentabilityLabel(session.patentability_score)} Patentability
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Prior Art Summary */}
                    {sessionPriorArt.length > 0 && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Search className="w-4 h-4" />
                          Prior Art Analysis
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Total Found</p>
                            <p className="font-medium">{sessionPriorArt.length}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">High Similarity</p>
                            <p className="font-medium text-orange-600">{highSimilarityCount}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Highest Score</p>
                            <p className="font-medium">
                              {sessionPriorArt.length > 0 
                                ? (Math.max(...sessionPriorArt.map(r => r.similarity_score)) * 100).toFixed(1) + '%'
                                : 'N/A'
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Last Updated</p>
                            <p className="font-medium">
                              {sessionPriorArt.length > 0 
                                ? format(new Date(Math.max(...sessionPriorArt.map(r => new Date(r.created_at).getTime()))), 'MMM dd')
                                : 'Never'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/session/${session.id}`)}
                        className="gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => performPriorArtSearch(session.id)}
                        disabled={searchingPriorArt === session.id}
                        className="gap-1"
                      >
                        {searchingPriorArt === session.id ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        Update Prior Art
                      </Button>

                      {session.download_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(session.download_url!, '_blank')}
                          className="gap-1"
                        >
                          <Download className="w-4 h-4" />
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