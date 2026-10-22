import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Scale, Loader2, AlertTriangle, CheckCircle, Shield, Target, Eye, Zap, Lightbulb
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getEdgeErrorMessage } from '@/lib/edgeError';

const toScore = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n))) : 0;
};

// The analysis comes from an LLM - normalise it so missing fields can't crash the render
const normalizeAnalysis = (raw: any): FullAnalysis => ({
  overallScore: toScore(raw?.overallScore),
  overallGrade: typeof raw?.overallGrade === 'string' ? raw.overallGrade : '?',
  claims: (Array.isArray(raw?.claims) ? raw.claims : []).map((c: any, i: number) => ({
    claimNumber: Number(c?.claimNumber) || i + 1,
    claimText: String(c?.claimText || ''),
    type: String(c?.type || 'claim'),
    scores: {
      breadth: toScore(c?.scores?.breadth),
      specificity: toScore(c?.scores?.specificity),
      enforceability: toScore(c?.scores?.enforceability),
      novelty: toScore(c?.scores?.novelty),
      clarity: toScore(c?.scores?.clarity),
    },
    vulnerabilities: Array.isArray(c?.vulnerabilities) ? c.vulnerabilities : [],
    suggestedRewrite: c?.suggestedRewrite || undefined,
    strategicNotes: c?.strategicNotes || undefined,
  })),
  portfolioRecommendations: Array.isArray(raw?.portfolioRecommendations) ? raw.portfolioRecommendations : [],
  examinerPrediction: {
    likelyRejections: Array.isArray(raw?.examinerPrediction?.likelyRejections) ? raw.examinerPrediction.likelyRejections : [],
    suggestedPreemptiveAmendments: Array.isArray(raw?.examinerPrediction?.suggestedPreemptiveAmendments) ? raw.examinerPrediction.suggestedPreemptiveAmendments : [],
  },
});

interface ClaimScore {
  breadth: number;
  specificity: number;
  enforceability: number;
  novelty: number;
  clarity: number;
}

interface ClaimVulnerability {
  type: string;
  risk: string;
  explanation: string;
}

interface ClaimAnalysis {
  claimNumber: number;
  claimText: string;
  type: string;
  scores: ClaimScore;
  vulnerabilities: ClaimVulnerability[];
  suggestedRewrite?: string;
  strategicNotes?: string;
}

interface FullAnalysis {
  overallScore: number;
  overallGrade: string;
  claims: ClaimAnalysis[];
  portfolioRecommendations: string[];
  examinerPrediction: {
    likelyRejections: string[];
    suggestedPreemptiveAmendments: string[];
  };
}

interface ClaimStrengthAnalyzerProps {
  claimsContent: string;
  priorArt?: any[];
  inventionContext?: string;
}

const SCORE_LABELS: Record<keyof ClaimScore, { label: string; icon: React.ReactNode }> = {
  breadth: { label: 'Breadth', icon: <Target className="w-3 h-3" /> },
  specificity: { label: 'Precision', icon: <Eye className="w-3 h-3" /> },
  enforceability: { label: 'Enforce', icon: <Shield className="w-3 h-3" /> },
  novelty: { label: 'Novelty', icon: <Zap className="w-3 h-3" /> },
  clarity: { label: 'Clarity', icon: <Lightbulb className="w-3 h-3" /> },
};

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
};

const getProgressColor = (score: number) => {
  if (score >= 80) return '[&>div]:bg-green-500';
  if (score >= 60) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-red-500';
};

const getRiskColor = (risk: string) => {
  if (risk === 'high') return 'bg-red-100 text-red-700';
  if (risk === 'medium') return 'bg-amber-100 text-amber-700';
  return 'bg-blue-100 text-blue-700';
};

const getGradeColor = (grade: string) => {
  switch (grade) {
    case 'A': return 'bg-green-500 text-white';
    case 'B': return 'bg-blue-500 text-white';
    case 'C': return 'bg-amber-500 text-white';
    case 'D': return 'bg-orange-500 text-white';
    default: return 'bg-red-500 text-white';
  }
};

export default function ClaimStrengthAnalyzer({ claimsContent, priorArt, inventionContext }: ClaimStrengthAnalyzerProps) {
  const [analysis, setAnalysis] = useState<FullAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedClaim, setExpandedClaim] = useState<number | null>(null);
  const { toast } = useToast();

  const analyze = async () => {
    if (!claimsContent || claimsContent.length < 30) {
      toast({ title: 'Not enough content', description: 'Claims section needs more content to analyze.', variant: 'destructive' });
      return;
    }

    setIsAnalyzing(true);
    try {
      // Send a compact payload: plain-text claims, top prior art only
      const plainClaims = claimsContent
        .replace(/<\/\s*(p|div|li)\s*>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .slice(0, 30000);
      const compactPriorArt = (priorArt || []).slice(0, 5).map((p: any) => ({
        title: p?.title,
        publication_number: p?.publication_number,
        similarity_score: p?.similarity_score,
        summary: typeof p?.summary === 'string' ? p.summary.slice(0, 500) : undefined,
      }));
      const { data, error } = await supabase.functions.invoke('analyze-claims', {
        body: { claims: plainClaims, priorArt: compactPriorArt, inventionContext: inventionContext?.slice(0, 4000) }
      });
      if (error) throw new Error((await getEdgeErrorMessage(error, 'Analysis failed')).message);
      if (!data?.success) throw new Error(data?.error || 'Analysis failed');
      setAnalysis(normalizeAnalysis(data.analysis));
    } catch (e: any) {
      toast({ title: 'Analysis failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!analysis) {
    return (
      <Button onClick={analyze} variant="outline" size="sm" disabled={isAnalyzing || !claimsContent} className="gap-1.5 text-xs">
        {isAnalyzing ? <><Loader2 className="h-3 w-3 animate-spin" />Analyzing Claims…</> : <><Scale className="h-3 w-3" />Analyze Claim Strength</>}
      </Button>
    );
  }

  return (
    <Card className="border-primary/20 animate-in slide-in-from-top-2 duration-200">
      <CardHeader className="p-3 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            Claim Strength Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={`text-sm font-bold px-2 ${getGradeColor(analysis.overallGrade)}`}>
              {analysis.overallGrade} · {analysis.overallScore}/100
            </Badge>
            <Button variant="ghost" size="sm" onClick={analyze} disabled={isAnalyzing} className="h-6 text-[10px]">
              {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Re-analyze'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="max-h-[400px] overflow-y-auto">
          <div className="space-y-3">
            {/* Per-claim analysis */}
            {analysis.claims.map((claim, i) => (
              <div key={i} className="bg-muted/30 rounded-md p-2.5 space-y-2">
                <div
                  className="flex flex-wrap items-center justify-between gap-1 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedClaim === i}
                  onClick={() => setExpandedClaim(expandedClaim === i ? null : i)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedClaim(expandedClaim === i ? null : i); } }}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] px-1.5">
                      Claim {claim.claimNumber} · {claim.type}
                    </Badge>
                    <span className={`text-xs font-bold ${getScoreColor(
                      Math.round(Object.values(claim.scores).reduce((a, b) => a + b, 0) / 5)
                    )}`}>
                      {Math.round(Object.values(claim.scores).reduce((a, b) => a + b, 0) / 5)}/100
                    </span>
                  </div>
                  {claim.vulnerabilities.length > 0 && (
                    <Badge className={getRiskColor(claim.vulnerabilities[0]?.risk || 'low')} >
                      <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                      {claim.vulnerabilities.length} issue{claim.vulnerabilities.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>

                {/* Score bars */}
                <div className="grid grid-cols-5 gap-1.5">
                  {(Object.entries(claim.scores) as [keyof ClaimScore, number][]).map(([key, val]) => (
                    <div key={key} className="text-center">
                      <div className="flex items-center justify-center gap-0.5 mb-0.5">
                        {SCORE_LABELS[key].icon}
                        <span className="text-[9px] text-muted-foreground">{SCORE_LABELS[key].label}</span>
                      </div>
                      <Progress value={val} className={`h-1 ${getProgressColor(val)}`} />
                      <span className={`text-[9px] font-medium ${getScoreColor(val)}`}>{val}</span>
                    </div>
                  ))}
                </div>

                {/* Expanded details */}
                {expandedClaim === i && (
                  <div className="space-y-2 pt-1 border-t border-border/50">
                    {claim.vulnerabilities.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground mb-1">Vulnerabilities:</p>
                        {claim.vulnerabilities.map((v, vi) => (
                          <div key={vi} className="flex items-start gap-1.5 mb-1">
                            <Badge className={`${getRiskColor(v.risk)} text-[9px] px-1 py-0 flex-shrink-0`}>{v.type}</Badge>
                            <span className="text-[10px] text-muted-foreground">{v.explanation}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {claim.suggestedRewrite && (
                      <div>
                        <p className="text-[10px] font-medium text-primary mb-1">Suggested Rewrite:</p>
                        <p className="text-[10px] bg-primary/5 p-2 rounded border border-primary/10 italic">{claim.suggestedRewrite}</p>
                      </div>
                    )}
                    {claim.strategicNotes && (
                      <p className="text-[10px] text-muted-foreground">💡 {claim.strategicNotes}</p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Examiner Prediction */}
            {analysis.examinerPrediction && (
              <div className="bg-destructive/5 rounded-md p-2.5">
                <p className="text-xs font-medium flex items-center gap-1.5 mb-1.5">
                  <Shield className="w-3 h-3 text-destructive" />
                  Examiner Prediction
                </p>
                {analysis.examinerPrediction.likelyRejections.map((r, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground mb-0.5">⚠️ {r}</p>
                ))}
                {analysis.examinerPrediction.suggestedPreemptiveAmendments.map((a, i) => (
                  <p key={i} className="text-[10px] text-primary mt-1">✅ {a}</p>
                ))}
              </div>
            )}

            {/* Portfolio Recommendations */}
            {analysis.portfolioRecommendations?.length > 0 && (
              <div className="bg-accent/5 rounded-md p-2.5">
                <p className="text-xs font-medium flex items-center gap-1.5 mb-1.5">
                  <Lightbulb className="w-3 h-3 text-accent" />
                  Strategic Recommendations
                </p>
                {analysis.portfolioRecommendations.map((r, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground mb-0.5">→ {r}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
