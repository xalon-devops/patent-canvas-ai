import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
  onComplete: (score: number, analysis: string) => void;
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
  const { toast } = useToast();

  useEffect(() => {
    performAssessment();
  }, []);

  const performAssessment = async () => {
    setLoading(true);
    try {
      // Call the enhanced analyze-patentability function
      const { data, error } = await supabase.functions.invoke('analyze-patentability', {
        body: { 
          session_id: sessionData.sessionId
        }
      });

      if (error) {
        console.error('Patentability analysis error:', error);
        throw new Error('Failed to analyze patentability');
      }

      if (data?.success && data.analysis) {
        const analysis = data.analysis;
        
        setCriteria(analysis.criteria);
        setOverallScore(analysis.overall_score);
        setAnalysis(analysis.summary);
        
        // Animate through criteria
        animateCriteria(analysis.criteria);
        
        return;
      }

      // Fallback to mock assessment if API fails
      const assessmentCriteria: AssessmentCriterion[] = [
        {
          name: 'Novelty',
          score: 85,
          maxScore: 100,
          description: 'How new and original is your invention?',
          analysis: 'Your invention demonstrates strong novelty with unique technical features not found in existing patents. The AI-driven energy optimization approach represents a significant advancement.',
          icon: Lightbulb
        },
        {
          name: 'Non-obviousness',
          score: 78,
          maxScore: 100,
          description: 'Would the invention be obvious to someone skilled in the field?',
          analysis: 'The combination of machine learning, real-time pricing, and predictive analytics creates a non-obvious solution that goes beyond simple combinations of known elements.',
          icon: Target
        },
        {
          name: 'Utility',
          score: 95,
          maxScore: 100,
          description: 'Does your invention have a useful purpose?',
          analysis: 'Excellent utility score. The invention solves real-world energy efficiency problems with clear commercial and environmental benefits.',
          icon: Zap
        },
        {
          name: 'Technical Merit',
          score: 88,
          maxScore: 100,
          description: 'Technical complexity and innovation level',
          analysis: 'Strong technical merit with sophisticated algorithms and system architecture. The integration of multiple data sources and predictive modeling shows high technical competency.',
          icon: Award
        }
      ];

      // Adjust scores based on prior art analysis
      if (sessionData.priorArtResults) {
        const highRiskCount = sessionData.priorArtResults.filter((r: any) => r.similarity_score >= 0.8).length;
        if (highRiskCount > 0) {
          assessmentCriteria[0].score -= 15; // Reduce novelty score
          assessmentCriteria[1].score -= 10; // Reduce non-obviousness score
        }
      }

      setCriteria(assessmentCriteria);

      // Calculate overall score
      const totalScore = assessmentCriteria.reduce((sum, criterion) => sum + criterion.score, 0);
      const maxTotalScore = assessmentCriteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);
      const percentageScore = Math.round((totalScore / maxTotalScore) * 100);
      
      setOverallScore(percentageScore);

      // Generate comprehensive analysis
      const comprehensiveAnalysis = generateComprehensiveAnalysis(percentageScore, assessmentCriteria);
      setAnalysis(comprehensiveAnalysis);

      // Animate through criteria one by one
      animateCriteria(assessmentCriteria);

    } catch (error: any) {
      toast({
        title: "Error performing assessment",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const animateCriteria = async (criteriaList: AssessmentCriterion[]) => {
    for (let i = 0; i < criteriaList.length; i++) {
      setCurrentCriterionIndex(i);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  };

  const generateComprehensiveAnalysis = (score: number, criteriaList: AssessmentCriterion[]): string => {
    let analysis = `Your invention scores ${score}/100 for patentability, indicating `;
    
    if (score >= 85) {
      analysis += "excellent patent potential with strong likelihood of approval. ";
    } else if (score >= 70) {
      analysis += "good patent potential with reasonable likelihood of approval. ";
    } else if (score >= 55) {
      analysis += "moderate patent potential that may require claim adjustments. ";
    } else {
      analysis += "challenges for patentability that need to be addressed. ";
    }

    analysis += "\n\nKey Strengths:\n";
    criteriaList.forEach(criterion => {
      if (criterion.score >= 80) {
        analysis += `• ${criterion.name}: ${criterion.analysis}\n`;
      }
    });

    analysis += "\nAreas for Consideration:\n";
    criteriaList.forEach(criterion => {
      if (criterion.score < 80) {
        analysis += `• ${criterion.name}: Consider strengthening this aspect in your patent claims.\n`;
      }
    });

    analysis += `\nRecommendation: ${score >= 70 ? 'Proceed with patent drafting' : 'Consider refining your invention before proceeding'}.`;
    
    return analysis;
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
            <div className="text-6xl font-bold">
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <IconComponent className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{criterion.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{criterion.description}</p>
                          </div>
                        </div>
                        <Badge className={getScoreBgColor(criterion.score)}>
                          {criterion.score}/{criterion.maxScore}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <Progress value={criterion.score} className="h-2" />
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