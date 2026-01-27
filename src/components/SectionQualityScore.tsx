import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Lightbulb, 
  Shield, 
  Loader2,
  BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QualityIssue {
  severity: 'high' | 'medium' | 'low';
  issue: string;
  suggestion: string;
}

interface QualityAnalysis {
  score: number;
  grade: string;
  strengths: string[];
  issues: QualityIssue[];
  usptoCompliance: {
    compliant: boolean;
    missingElements: string[];
    recommendations: string[];
  };
}

interface SectionQualityScoreProps {
  sectionType: string;
  content: string;
}

const getGradeColor = (grade: string) => {
  switch (grade) {
    case 'A': return 'text-green-600 bg-green-100';
    case 'B': return 'text-blue-600 bg-blue-100';
    case 'C': return 'text-amber-600 bg-amber-100';
    case 'D': return 'text-orange-600 bg-orange-100';
    case 'F': return 'text-red-600 bg-red-100';
    default: return 'text-muted-foreground bg-muted';
  }
};

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'high': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'medium': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'low': return <Lightbulb className="h-4 w-4 text-blue-500" />;
    default: return <Lightbulb className="h-4 w-4" />;
  }
};

export default function SectionQualityScore({ sectionType, content }: SectionQualityScoreProps) {
  const [analysis, setAnalysis] = useState<QualityAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const analyzeQuality = async () => {
    if (!content || content.length < 20) {
      toast({
        title: "Not enough content",
        description: "Please add more content before analyzing quality.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-section-quality', {
        body: { section_type: sectionType, content }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Analysis failed');

      setAnalysis(data.analysis);
    } catch (error: any) {
      console.error('Quality analysis error:', error);
      toast({
        title: "Analysis failed",
        description: error.message || "Could not analyze section quality",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!analysis) {
    return (
      <Button
        onClick={analyzeQuality}
        variant="outline"
        size="sm"
        disabled={isAnalyzing || !content}
        className="gap-2"
      >
        {isAnalyzing ? (
          <><Loader2 className="h-4 w-4 animate-spin" />Analyzing...</>
        ) : (
          <><BarChart3 className="h-4 w-4" />Check Quality</>
        )}
      </Button>
    );
  }

  return (
    <Card className="mt-4 border-primary/20 animate-in slide-in-from-top-2 duration-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            USPTO Quality Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={`text-lg font-bold px-3 ${getGradeColor(analysis.grade)}`}>
              {analysis.grade}
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={analyzeQuality}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>Quality Score</span>
            <span className="font-medium">{analysis.score}/100</span>
          </div>
          <Progress 
            value={analysis.score} 
            className={`h-2 ${analysis.score >= 80 ? '[&>div]:bg-green-500' : analysis.score >= 60 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'}`} 
          />
        </div>

        <ScrollArea className="h-[250px]">
          <div className="space-y-4 pr-3">
            {/* Strengths */}
            {analysis.strengths.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Strengths
                </h4>
                <ul className="space-y-1">
                  {analysis.strengths.map((strength, i) => (
                    <li key={i} className="text-xs text-muted-foreground pl-4 list-disc">
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issues */}
            {analysis.issues.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-amber-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Issues to Address
                </h4>
                <div className="space-y-2">
                  {analysis.issues.map((issue, i) => (
                    <div key={i} className="p-2 bg-muted/50 rounded-md">
                      <div className="flex items-start gap-2">
                        {getSeverityIcon(issue.severity)}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{issue.issue}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            💡 {issue.suggestion}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* USPTO Compliance */}
            <div>
              <h4 className="text-xs font-medium mb-2 flex items-center gap-1">
                <Shield className="h-3 w-3" /> 
                USPTO Compliance
                <Badge variant={analysis.usptoCompliance.compliant ? "default" : "destructive"} className="text-xs ml-1">
                  {analysis.usptoCompliance.compliant ? 'Compliant' : 'Needs Work'}
                </Badge>
              </h4>
              
              {analysis.usptoCompliance.missingElements.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground mb-1">Missing Elements:</p>
                  <ul className="space-y-0.5">
                    {analysis.usptoCompliance.missingElements.map((el, i) => (
                      <li key={i} className="text-xs text-red-600 pl-4 list-disc">{el}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {analysis.usptoCompliance.recommendations.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Recommendations:</p>
                  <ul className="space-y-0.5">
                    {analysis.usptoCompliance.recommendations.map((rec, i) => (
                      <li key={i} className="text-xs text-primary pl-4 list-disc">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
