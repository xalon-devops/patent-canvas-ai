import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getEdgeErrorMessage } from '@/lib/edgeError';
import { 
  BarChart3, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Shield,
  Lightbulb,
  FileText,
  ArrowRight,
  Loader2,
  Award,
  Target,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SessionData {
  sessionId: string;
  patentType: string;
  ideaTitle: string;
  ideaDescription: string;
  aiQuestions?: Array<{question: string; answer: string}>;
  priorArtResults?: any[];
}

interface PatentabilityAssessmentProps {
  sessionData: SessionData;
  /** score is 0-100, or null when the user skips a failed assessment */
  onComplete: (score: number | null, analysis: string) => void;
}

interface AssessmentCriterion {
  name: string;
  score: number;
  maxScore: number;
  description: string;
  analysis: string;
  icon: React.ElementType | string;
}

// Map icon names from API to actual components
const iconMap: Record<string, React.ElementType> = {
  Lightbulb,
  Target,
  Zap,
  Award,
  Shield,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  FileText,
};

const getIconComponent = (icon: React.ElementType | string): React.ElementType => {
  if (typeof icon === 'string') {
    return iconMap[icon] || Lightbulb;
  }
  return icon;
};

const PatentabilityAssessment: React.FC<PatentabilityAssessmentProps> = ({ 
  sessionData, 
  onComplete 
}) => {
  const [loading, setLoading] = useState(true);
  const [criteria, setCriteria] = useState<AssessmentCriterion[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const [analysis, setAnalysis] = useState('');
  const [currentCriterionIndex, setCurrentCriterionIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const { toast } = useToast();

  useEffect(() => {
    mountedRef.current = true;
    performAssessment();
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clampScore = (n: unknown) => {
    const v = Number(n);
    if (Number.isNaN(v)) return 0;
    return Math.round(Math.min(100, Math.max(0, v)));
  };

  const performAssessment = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Call the enhanced analyze-patentability function
      const { data, error } = await supabase.functions.invoke('analyze-patentability', {
        body: { 
          session_id: sessionData.sessionId
        }
      });

      if (error) {
        console.error('Patentability analysis error:', error);
        throw new Error((await getEdgeErrorMessage(error, 'Failed to analyze patentability')).message);
      }

      if (!data?.success || !data.analysis) {
        throw new Error(data?.error || 'The patentability analysis returned no results.');
      }

      const result = data.analysis;
      const parsedCriteria: AssessmentCriterion[] = (Array.isArray(result.criteria) ? result.criteria : []).map((c: any) => ({
        name: String(c?.name || 'Criterion'),
        score: clampScore(c?.score),
        maxScore: Number(c?.maxScore) > 0 ? Number(c.maxScore) : 100,
        description: String(c?.description || ''),
        analysis: String(c?.analysis || ''),
        icon: c?.icon || 'Lightbulb',
      }));

      if (!mountedRef.current) return;
      setCriteria(parsedCriteria);
      setOverallScore(clampScore(result.overall_score));
      setAnalysis(String(result.summary || ''));

      // Animate through criteria
      animateCriteria(parsedCriteria);
    } catch (error: any) {
      if (!mountedRef.current) return;
      setLoadError(error.message || 'Failed to analyze patentability');
      toast({
        title: "Error performing assessment",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const animateCriteria = async (criteriaList: AssessmentCriterion[]) => {
    for (let i = 0; i < criteriaList.length; i++) {
      if (!mountedRef.current) return;
      setCurrentCriterionIndex(i);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 55) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 85) return 'bg-green-500';
    if (score >= 70) return 'bg-blue-500';
    if (score >= 55) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleContinue = () => {
    toast({
      title: "Assessment Complete",
      description: "Moving to decision point...",
      variant: "default",
    });
    onComplete(overallScore, analysis);
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6"
      >
        <div className="flex items-center justify-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary animate-pulse" />
          <Shield className="w-6 h-6 text-primary/60 animate-bounce" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Analyzing Patentability...</h3>
          <p className="text-muted-foreground">
            Evaluating your invention against USPTO criteria for novelty, non-obviousness, and utility
          </p>
        </div>
        <div className="space-y-3">
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <motion.div 
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: '85%' }}
              transition={{ duration: 2, ease: "easeInOut" }}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Analyzing technical merit and patent landscape...
          </div>
        </div>
      </motion.div>
    );
  }

  if (loadError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6"
      >
        <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">We couldn't complete the patentability assessment</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">{loadError}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={performAssessment} className="gap-2">
            <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : 'hidden'}`} />
            Try Again
          </Button>
          <Button variant="outline" onClick={() => onComplete(null, '')}>
            Skip Assessment
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <BarChart3 className="w-8 h-8 text-primary" />
          <Shield className="w-6 h-6 text-primary/70" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Patentability Assessment</h2>
        <p className="text-muted-foreground">
          AI-powered analysis of your invention's patent potential
        </p>
      </div>

      {/* Overall Score */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/15 border-primary/20">
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <div className="text-5xl sm:text-6xl font-bold">
              <span className={getScoreColor(overallScore)}>{overallScore}</span>
              <span className="text-2xl text-muted-foreground">/100</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">
                {overallScore >= 85 ? 'Excellent' : 
                 overallScore >= 70 ? 'Good' : 
                 overallScore >= 55 ? 'Moderate' : 'Challenging'} Patent Potential
              </h3>
              <div className="w-full bg-muted/50 rounded-full h-3 overflow-hidden">
                <motion.div 
                  className={`h-full rounded-full ${getScoreBgColor(overallScore)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${overallScore}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Criteria */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Detailed Assessment Criteria
        </h3>
        
        {criteria.map((criterion, index) => {
          const IconComponent = getIconComponent(criterion.icon);
          const isVisible = index <= currentCriterionIndex;
          
          return (
            <AnimatePresence key={criterion.name}>
              {isVisible && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <IconComponent className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{criterion.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{criterion.description}</p>
                          </div>
                        </div>
                        <Badge className={`flex-shrink-0 ${getScoreBgColor(criterion.score)}`}>
                          {criterion.score}/{criterion.maxScore}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <Progress value={(criterion.score / criterion.maxScore) * 100} className="h-2" />
                        <p className="text-sm text-muted-foreground">{criterion.analysis}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          );
        })}
      </div>

      {/* Analysis Summary */}
      <Card className="bg-gradient-to-br from-background/80 to-muted/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            AI Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-line text-sm leading-relaxed">
            {analysis}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-end pt-6">
        <Button 
          onClick={handleContinue}
          className="gap-2 bg-gradient-to-r from-primary to-primary/80"
        >
          View Options
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
};

export default PatentabilityAssessment;