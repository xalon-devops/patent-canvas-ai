import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuthenticatedPatentData, PatentSession } from '@/hooks/usePatentData';
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
import { PageSEO } from '@/components/SEO';

const Drafts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Use centralized data hook - single source of truth
  const { 
    draftSessions: drafts, 
    loading, 
    isAuthenticated,
    refetchSessions 
  } = useAuthenticatedPatentData();

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [loading, isAuthenticated, navigate]);

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

      // Refetch to update centralized state
      refetchSessions();
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

  const getStepFromSession = (draft: PatentSession) => {
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
      <PageSEO.Drafts />
      {/* Header */}
      <header className="border-b bg-card/90 backdrop-blur-xl sticky top-0 z-50 shadow-card">
        <div className="safe-area px-4 sm:px-6">
          <div className="content-width">
            <div className="flex items-center gap-2 sm:gap-4 py-3 sm:py-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/dashboard')}
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden xs:inline ml-2">Dashboard</span>
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold truncate">Draft Applications</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  Continue where you left off
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="safe-area px-4 sm:px-6 py-6 sm:py-8">
        <div className="content-width">
          {drafts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8 sm:py-12 px-4"
            >
              <div className="p-4 sm:p-6 bg-muted/30 rounded-2xl inline-block mb-4 sm:mb-6">
                <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2">No draft applications</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 max-w-md mx-auto">
                Start a new patent application to see your drafts here. You can save your progress and continue later.
              </p>
              <Button onClick={() => navigate('/new-application')} variant="gradient" className="w-full sm:w-auto">
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
                        <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                  {draft.patent_type === 'software' ? <Code className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                                  {draft.patent_type === 'software' ? 'Software' : 'Physical'}
                                </Badge>
                                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                                  {stepIcon}
                                  <span className="hidden xs:inline">Step {currentStep}: </span>
                                  <span className="truncate max-w-[120px] sm:max-w-none">{stepName}</span>
                                </Badge>
                              </div>
                              <CardTitle className="text-base sm:text-lg leading-tight mb-2 line-clamp-2">
                                {draft.idea_prompt ? 
                                  (draft.idea_prompt.length > 100 ? 
                                    `${draft.idea_prompt.substring(0, 100)}...` : 
                                    draft.idea_prompt
                                  ) : 
                                  'Untitled Patent Application'
                                }
                              </CardTitle>
                              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{new Date(draft.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 flex-shrink-0" />
                                  <span>{new Date(draft.created_at).toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}</span>
                                </div>
                                {draft.patentability_score && (
                                  <div className="flex items-center gap-1">
                                    <BarChart3 className="h-3 w-3 flex-shrink-0" />
                                    <span>{Math.round(draft.patentability_score * 100)}%</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => resumeDraft(draft.id)}
                                className="flex items-center gap-2 text-xs sm:text-sm"
                              >
                                <Play className="h-3 w-3" />
                                <span className="hidden xs:inline">Resume</span>
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
                        <CardContent className="pt-0 p-4 sm:p-6">
                          <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                              <span>Progress: Step {currentStep} of 7</span>
                            </div>
                            <div className="w-full xs:w-24 bg-muted rounded-full h-2">
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