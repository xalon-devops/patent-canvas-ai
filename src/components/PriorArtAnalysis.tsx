import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  FileText, 
  ExternalLink, 
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Eye,
  Loader2,
  BarChart3,
  Shield,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatMonthYear } from '@/lib/dateUtils';

interface SessionData {
  sessionId: string;
  patentType: string;
  ideaTitle: string;
  ideaDescription: string;
  aiQuestions?: Array<{question: string; answer: string}>;
}

interface PriorArtResult {
  id: string;
  title: string;
  publication_number: string;
  summary: string;
  similarity_score: number;
  semantic_score?: number;
  keyword_score?: number;
  assignee?: string;
  patent_date?: string;
  url: string;
  overlap_claims: string[];
  difference_claims: string[];
  source?: string;
}

interface PriorArtAnalysisProps {
  sessionData: SessionData;
  onComplete: (results: PriorArtResult[]) => void;
}

const PriorArtAnalysis: React.FC<PriorArtAnalysisProps> = ({ 
  sessionData, 
  onComplete 
}) => {
  const [results, setResults] = useState<PriorArtResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(true);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    searchPriorArt();
  }, []);

  const searchPriorArt = async () => {
    setAnalyzing(true);
    try {
      const qaContext = (sessionData.aiQuestions || [])
        .map(q => `${q.question} ${q.answer || ''}`)
        .join(' ');
      const context = `${sessionData.ideaTitle} ${sessionData.ideaDescription} ${qaContext}`.slice(0, 4000);

      // Trigger backend search with real patent databases (Perplexity, Lens.org, Google Patents)
      const { error: invokeError } = await supabase.functions.invoke('search-prior-art-enhanced', {
        body: {
          session_id: sessionData.sessionId,
          search_query: context,
          patent_type: sessionData.patentType,
        },
      });
      if (invokeError) throw invokeError;

      // Then fetch stored results for this session
      const { data: rows, error: fetchErr } = await supabase
        .from('prior_art_results')
        .select('id, title, publication_number, summary, similarity_score, semantic_score, keyword_score, assignee, patent_date, url, overlap_claims, difference_claims, source, created_at')
        .eq('session_id', sessionData.sessionId)
        .order('similarity_score', { ascending: false });

      if (!fetchErr && rows && rows.length > 0) {
        const mapped: PriorArtResult[] = rows.map((r: any) => ({
          id: r.id,
          title: r.title || 'Untitled',
          publication_number: r.publication_number || '',
          summary: r.summary || '',
          similarity_score: r.similarity_score ?? 0,
          semantic_score: r.semantic_score ?? 0,
          keyword_score: r.keyword_score ?? 0,
          assignee: r.assignee || 'Unknown',
          patent_date: r.patent_date,
          url: r.url || '#',
          overlap_claims: r.overlap_claims || [],
          difference_claims: r.difference_claims || [],
          source: r.source || 'patentsview',
        }));
        setResults(mapped);
        return;
      }

      // If we got here, no results from database - show message instead of mock data
      toast({
        title: "Limited prior art found",
        description: "The patent search found minimal existing patents. This could indicate strong novelty!",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: 'Error searching prior art',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const getSimilarityColor = (score: number): string => {
    if (score >= 0.8) return 'bg-red-500';
    if (score >= 0.6) return 'bg-yellow-500';
    if (score >= 0.4) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getSimilarityLabel = (score: number): string => {
    if (score >= 0.8) return 'High Risk';
    if (score >= 0.6) return 'Medium Risk';
    if (score >= 0.4) return 'Low Risk';
    return 'Minimal Risk';
  };

  const getRiskIcon = (score: number) => {
    if (score >= 0.8) return <AlertTriangle className="w-4 h-4" />;
    if (score >= 0.6) return <Eye className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const handleContinue = () => {
    toast({
      title: "Prior Art Analysis Complete",
      description: "Moving to patentability assessment...",
      variant: "default",
    });
    onComplete(results);
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6"
      >
        <div className="flex items-center justify-center gap-3">
          <Search className="w-8 h-8 text-primary animate-pulse" />
          <FileText className="w-6 h-6 text-primary/60 animate-bounce" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Searching Prior Art...</h3>
          <p className="text-muted-foreground">
            Analyzing USPTO database, Google Patents, and international patent databases
          </p>
        </div>
        <div className="space-y-3">
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <motion.div 
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: '75%' }}
              transition={{ duration: 3, ease: "easeInOut" }}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Searching thousands of patent records...
          </div>
        </div>
      </motion.div>
    );
  }

  const highRiskCount = results.filter(r => r.similarity_score >= 0.8).length;
  const mediumRiskCount = results.filter(r => r.similarity_score >= 0.6 && r.similarity_score < 0.8).length;
  const lowRiskCount = results.filter(r => r.similarity_score < 0.6).length;

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
          <Search className="w-8 h-8 text-primary" />
          <BarChart3 className="w-6 h-6 text-primary/70" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Prior Art Analysis Results</h2>
        <p className="text-muted-foreground">
          We found {results.length} relevant patents in our comprehensive search
        </p>
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={searchPriorArt} disabled={analyzing} className="gap-2">
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Re-run with latest answers
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-foreground">{results.length}</div>
            <div className="text-sm text-muted-foreground">Patents Found</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-red-500/50">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-red-500">{highRiskCount}</div>
            <div className="text-sm text-muted-foreground">High Risk</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-yellow-500/50">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-yellow-500">{mediumRiskCount}</div>
            <div className="text-sm text-muted-foreground">Medium Risk</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-green-500/50">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-500">{lowRiskCount}</div>
            <div className="text-sm text-muted-foreground">Low Risk</div>
          </CardContent>
        </Card>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Patent Analysis Results
        </h3>
        
        {results.map((result, index) => (
          <motion.div
            key={result.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" 
                  onClick={() => setSelectedResult(selectedResult === result.id ? null : result.id)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2 mb-2">
                      {result.title}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="font-mono">{result.publication_number}</span>
                      {result.assignee && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">{result.assignee}</span>
                      )}
                      {result.patent_date && (
                        <span className="text-xs">{formatMonthYear(result.patent_date)}</span>
                      )}
                      <Badge className={getSimilarityColor(result.similarity_score)}>
                        {getRiskIcon(result.similarity_score)}
                        <span className="ml-1">{getSimilarityLabel(result.similarity_score)}</span>
                      </Badge>
                      <span className="font-semibold">{(result.similarity_score * 100).toFixed(0)}% match</span>
                    </div>
                    {(result.semantic_score || result.keyword_score) && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {result.semantic_score > 0 && (
                          <span>🧠 Semantic: {(result.semantic_score * 100).toFixed(0)}%</span>
                        )}
                        {result.keyword_score > 0 && (
                          <span>🔑 Keyword: {(result.keyword_score * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(result.url, '_blank');
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {result.summary}
                </p>
                
                <AnimatePresence>
                  {selectedResult === result.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 pt-4 border-t"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            Overlapping Claims
                          </h4>
                          <ul className="space-y-1 text-xs">
                            {result.overlap_claims.map((claim, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <div className="w-1 h-1 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                                {claim}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            Your Advantages
                          </h4>
                          <ul className="space-y-1 text-xs">
                            {result.difference_claims.map((claim, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <div className="w-1 h-1 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                                {claim}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Analysis Summary */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Intelligent Prior Art Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Search Quality
              </h4>
              {results.some(r => r.semantic_score && r.semantic_score > 0) ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>AI Semantic Search:</span>
                    <Badge variant="outline" className="bg-green-50">✓ Active</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Using advanced AI embeddings for semantic similarity matching + keyword analysis
                  </p>
                </div>
              ) : (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Keyword Search:</span>
                    <Badge variant="outline">Active</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Using traditional keyword matching (AI semantic search not available)
                  </p>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Risk Assessment
              </h4>
              <div className="text-xs space-y-1">
                {highRiskCount > 0 ? (
                  <p className="text-red-600 font-medium">
                    ⚠️ {highRiskCount} high-similarity patent{highRiskCount > 1 ? 's' : ''} found
                  </p>
                ) : mediumRiskCount > 0 ? (
                  <p className="text-yellow-600 font-medium">
                    ⚡ {mediumRiskCount} moderate-similarity patent{mediumRiskCount > 1 ? 's' : ''} found
                  </p>
                ) : (
                  <p className="text-green-600 font-medium">
                    ✓ No high-similarity conflicts detected
                  </p>
                )}
                <p className="text-muted-foreground mt-1">
                  {highRiskCount > 0
                    ? 'Focus claims on your unique technical differentiators shown below'
                    : mediumRiskCount > 0
                    ? 'Strong patent potential - emphasize your novel features'
                    : 'Excellent patentability outlook - clear technical differentiation'
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t space-y-2">
            <h4 className="font-semibold text-sm">Key Recommendations:</h4>
            <ul className="text-xs space-y-1 text-muted-foreground">
              {highRiskCount > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>Review high-risk patents carefully and highlight your technical innovations in the claims</span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Your unique technical implementation details are critical for differentiation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Backend architecture ({results[0]?.difference_claims.filter(c => c.includes('database') || c.includes('function')).length || 0} unique features detected) strengthens your claims</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>{highRiskCount === 0 ? 'Strong position for broad claims' : 'Consider narrow, technically specific claims'}</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-end pt-6">
        <Button 
          onClick={handleContinue}
          className="gap-2 bg-gradient-to-r from-primary to-primary/80"
        >
          Continue to Assessment
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
};

export default PriorArtAnalysis;