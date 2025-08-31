import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { 
  ArrowLeft, 
  Clock, 
  FileText, 
  Trash2,
  Play,
  Code,
  Package,
  Calendar,
  Brain,
  Search,
  BarChart3,
  Gavel,
  FileCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DraftSession {
  id: string;
  patent_type: string;
  idea_prompt: string;
  status: string;
  created_at: string;
  ai_analysis_complete: boolean;
  patentability_score: number | null;
  data_source: any;
}

const Drafts = () => {
  const [user, setUser] = useState<User | null>(null);
  const [drafts, setDrafts] = useState<DraftSession[]>([]);
  const [loading, setLoading] = useState(true);
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
      await loadDrafts(session.user.id);
    };

    checkAuth();
  }, [navigate]);

  const loadDrafts = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('patent_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrafts(data || []);
    } catch (error: any) {
      console.error('Error loading drafts:', error);
      toast({
        title: "Error loading drafts",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resumeDraft = (sessionId: string) => {
    navigate(`/new-application?sessionId=${sessionId}`);
  };

  const deleteDraft = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('patent_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      setDrafts(prev => prev.filter(draft => draft.id !== sessionId));
      toast({
        title: "Draft deleted",
        description: "The draft application has been removed.",
      });
    } catch (error: any) {
      console.error('Error deleting draft:', error);
      toast({
        title: "Error deleting draft",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStepFromSession = (draft: DraftSession) => {
    // Determine current step based on session data
    if (!draft.idea_prompt) return 1;
    if (!draft.data_source || Object.keys(draft.data_source).length === 0) return 3;
    
    // Check if we have AI questions answered
    const hasQuestions = draft.data_source?.ai_questions_complete;
    if (!hasQuestions) return 4; // AI Q&A step
    
    // Check if prior art search is done
    const hasPriorArt = draft.data_source?.prior_art_complete;
    if (!hasPriorArt) return 5; // Prior art analysis step
    
    // Check if patentability assessment is done
    if (!draft.ai_analysis_complete) return 6; // Patentability assessment step
    
    return 7; // Patent drafting step
  };

  const getStepName = (step: number) => {
    const steps = {
      1: 'Patent Type Selection',
      2: 'Idea Description',
      3: 'File Upload',
      4: 'AI Q&A',
      5: 'Prior Art Analysis',
      6: 'Patentability Assessment',
      7: 'Patent Drafting'
    };
    return steps[step as keyof typeof steps] || 'Unknown';
  };

  const getStepIcon = (step: number) => {
    const icons = {
      1: Code,
      2: FileText,
      3: Package,
      4: Brain,
      5: Search,
      6: BarChart3,
      7: Gavel
    };
    const IconComponent = icons[step as keyof typeof icons] || FileText;
    return <IconComponent className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your drafts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-card/90 backdrop-blur-xl sticky top-0 z-50 shadow-card">
        <div className="safe-area">
          <div className="content-width">
            <div className="flex items-center gap-4 py-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/dashboard')}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-bold">Draft Applications</h1>
                <p className="text-sm text-muted-foreground">
                  Continue where you left off
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="safe-area py-8">
        <div className="content-width">
          {drafts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <div className="p-6 bg-muted/30 rounded-2xl inline-block mb-6">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No draft applications</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Start a new patent application to see your drafts here. You can save your progress and continue later.
              </p>
              <Button onClick={() => navigate('/new-application')} variant="gradient">
                Start New Application
              </Button>
            </motion.div>
          ) : (
            <div className="grid gap-6">
              <AnimatePresence>
                {drafts.map((draft, index) => {
                  const currentStep = getStepFromSession(draft);
                  const stepName = getStepName(currentStep);
                  const stepIcon = getStepIcon(currentStep);
                  
                  return (
                    <motion.div
                      key={draft.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="glass hover:shadow-glow/30 transition-all duration-300">
                        <CardHeader className="pb-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Badge variant="outline" className="flex items-center gap-1">
                                  {draft.patent_type === 'software' ? <Code className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                                  {draft.patent_type === 'software' ? 'Software' : 'Physical'}
                                </Badge>
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  {stepIcon}
                                  Step {currentStep}: {stepName}
                                </Badge>
                              </div>
                              <CardTitle className="text-lg leading-tight mb-2">
                                {draft.idea_prompt ? 
                                  (draft.idea_prompt.length > 100 ? 
                                    `${draft.idea_prompt.substring(0, 100)}...` : 
                                    draft.idea_prompt
                                  ) : 
                                  'Untitled Patent Application'
                                }
                              </CardTitle>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(draft.created_at).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(draft.created_at).toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </div>
                                {draft.patentability_score && (
                                  <div className="flex items-center gap-1">
                                    <BarChart3 className="h-3 w-3" />
                                    {Math.round(draft.patentability_score * 100)}% patentable
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => resumeDraft(draft.id)}
                                className="flex items-center gap-2"
                              >
                                <Play className="h-3 w-3" />
                                Resume
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteDraft(draft.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>Progress: Step {currentStep} of 7</span>
                            </div>
                            <div className="w-24 bg-muted rounded-full h-2">
                              <div 
                                className="bg-primary rounded-full h-2 transition-all duration-300"
                                style={{ width: `${(currentStep / 7) * 100}%` }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Drafts;