import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { 
  ArrowLeft, 
  Lightbulb, 
  FileText, 
  Calendar, 
  TrendingUp, 
  AlertTriangle,
  Trash2,
  Edit,
  Play,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

interface PatentIdea {
  id: string;
  user_id: string;
  title: string;
  description: string;
  patent_type: string;
  data_source: any;
  prior_art_monitoring: boolean;
  last_monitored_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const IdeaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [idea, setIdea] = useState<PatentIdea | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    checkAuthAndLoadIdea();
  }, [id]);

  const checkAuthAndLoadIdea = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate('/auth');
      return;
    }

    setUser(session.user);
    await loadIdea(session.user.id);
  };

  const loadIdea = async (userId: string) => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('patent_ideas')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      setIdea(data);
    } catch (error: any) {
      console.error('Error loading idea:', error);
      toast({
        title: "Error loading idea",
        description: error.message,
        variant: "destructive",
      });
      navigate('/ideas');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!idea || !window.confirm('Are you sure you want to delete this idea? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('patent_ideas')
        .delete()
        .eq('id', idea.id);

      if (error) throw error;

      toast({
        title: "Idea deleted",
        description: "Your patent idea has been removed.",
      });
      navigate('/ideas');
    } catch (error: any) {
      toast({
        title: "Error deleting idea",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDraftPatent = () => {
    navigate(`/new-application?ideaId=${id}`);
  };

  const getStatusColor = (status: string) => {
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Card className="max-w-md text-center p-8">
          <Lightbulb className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Idea not found</h2>
          <p className="text-muted-foreground mb-6">
            This patent idea doesn't exist or you don't have permission to view it.
          </p>
          <Button onClick={() => navigate('/ideas')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Ideas
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/ideas')}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Ideas
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Idea Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-xl">
                <Lightbulb className="h-8 w-8 text-accent" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2">{idea.title}</h1>
                <div className="flex items-center gap-3">
                  <Badge className={getStatusColor(idea.status)}>
                    {idea.status.charAt(0).toUpperCase() + idea.status.slice(1)}
                  </Badge>
                  <Badge variant="outline">
                    {idea.patent_type === 'software' ? 'Software Patent' : 'Physical Patent'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Created {format(new Date(idea.created_at), 'MMM d, yyyy')}
            </div>
            {idea.last_monitored_at && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Last monitored {format(new Date(idea.last_monitored_at), 'MMM d, yyyy')}
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
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {idea.description}
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
              {idea.data_source.prior_art_results && (
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
              onClick={handleDraftPatent}
            >
              <Play className="h-4 w-4 mr-2" />
              Draft Full Patent Application
            </Button>
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
