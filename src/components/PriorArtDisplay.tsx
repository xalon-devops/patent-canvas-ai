import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle, 
  Search,
  Eye,
  TrendingUp,
  Calendar,
  FileText,
  Building2,
  Database,
  Brain,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { formatDate, formatMonthYear } from '@/lib/dateUtils';
import { motion, AnimatePresence } from 'framer-motion';

interface PriorArtResult {
  id: string;
  title: string;
  publication_number: string;
  summary: string;
  similarity_score: number;
  semantic_score?: number;
  keyword_score?: number;
  url: string;
  created_at?: string;
  patent_date?: string;
  assignee?: string;
  source?: string;
  overlap_claims?: string[];
  difference_claims?: string[];
}

interface PriorArtDisplayProps {
  priorArt: PriorArtResult[];
  isSearching?: boolean;
  onRetrySearch?: () => void;
  searchKeywords?: string[];
}

export default function PriorArtDisplay({ 
  priorArt, 
  isSearching = false, 
  onRetrySearch,
  searchKeywords = []
}: PriorArtDisplayProps) {
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getSimilarityColor = (score: number) => {
    if (score >= 0.8) return 'bg-red-500 text-white';
    if (score >= 0.6) return 'bg-orange-500 text-white';
    if (score >= 0.4) return 'bg-yellow-500 text-black';
    return 'bg-green-500 text-white';
  };

  const getSimilarityBorder = (score: number) => {
    if (score >= 0.8) return 'border-l-4 border-l-red-500';
    if (score >= 0.6) return 'border-l-4 border-l-orange-500';
    if (score >= 0.4) return 'border-l-4 border-l-yellow-500';
    return 'border-l-4 border-l-green-500';
  };

  const getRiskLevel = (score: number) => {
    if (score >= 0.8) return { label: 'High Risk', icon: AlertTriangle, color: 'text-red-600' };
    if (score >= 0.6) return { label: 'Medium Risk', icon: TrendingUp, color: 'text-orange-600' };
    if (score >= 0.4) return { label: 'Low Risk', icon: Eye, color: 'text-yellow-600' };
    return { label: 'Minimal', icon: CheckCircle, color: 'text-green-600' };
  };

  const getSourceIcon = (source?: string) => {
    if (source === 'USPTO' || source === 'patentsview') return '🇺🇸';
    if (source === 'Lens.org' || source === 'google_patents') return '🌐';
    return '📄';
  };

  if (isSearching) {
    return (
      <Card className="border-primary/20 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 animate-pulse text-primary" />
            Searching Patent Databases
          </CardTitle>
          <CardDescription>
            AI is analyzing multiple patent databases for similar inventions...
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            <Progress value={45} className="h-2" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Database className="w-4 h-4 text-blue-500 animate-pulse" />
                <span>Querying USPTO...</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Database className="w-4 h-4 text-green-500 animate-pulse" />
                <span>Searching Lens.org...</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Brain className="w-4 h-4 text-purple-500 animate-pulse" />
                <span>AI Analysis...</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (priorArt.length === 0) {
    return (
      <Card className="border-2 border-dashed border-green-300 bg-gradient-to-br from-green-50/50 to-emerald-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-6 h-6" />
            Excellent News! No Significant Prior Art Found
          </CardTitle>
          <CardDescription className="text-green-600">
            Our AI search across USPTO and Lens.org found no patents that significantly overlap with your invention.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-green-100/50 rounded-lg border border-green-200">
            <p className="text-sm text-green-800 font-medium mb-2">
              ✨ This is a strong indicator of patentability!
            </p>
            <ul className="text-xs text-green-700 space-y-1">
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>No high-similarity patents detected in major databases</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Your invention appears to be novel in the searched domains</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <span>Professional patent attorney review is still recommended</span>
              </li>
            </ul>
          </div>
          {onRetrySearch && (
            <Button onClick={onRetrySearch} variant="outline" size="sm" className="gap-2">
              <Search className="w-4 h-4" />
              Search Again with Different Terms
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const highRiskCount = priorArt.filter(p => p.similarity_score >= 0.8).length;
  const mediumRiskCount = priorArt.filter(p => p.similarity_score >= 0.6 && p.similarity_score < 0.8).length;
  const lowRiskCount = priorArt.filter(p => p.similarity_score < 0.6).length;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="bg-gradient-to-br from-background to-muted/30 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Prior Art Analysis Complete
              </CardTitle>
              <CardDescription className="mt-1">
                Found {priorArt.length} relevant patents across USPTO & Lens.org
              </CardDescription>
            </div>
            {onRetrySearch && (
              <Button onClick={onRetrySearch} variant="outline" size="sm" className="gap-2">
                <Search className="w-4 h-4" />
                Re-search
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl text-center border border-red-200 dark:border-red-800">
              <div className="text-3xl font-bold text-red-600">{highRiskCount}</div>
              <div className="text-xs text-red-700 dark:text-red-400 font-medium">High Risk</div>
              <div className="text-[10px] text-red-500 mt-1">≥80% similar</div>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-xl text-center border border-orange-200 dark:border-orange-800">
              <div className="text-3xl font-bold text-orange-600">{mediumRiskCount}</div>
              <div className="text-xs text-orange-700 dark:text-orange-400 font-medium">Medium Risk</div>
              <div className="text-[10px] text-orange-500 mt-1">60-79% similar</div>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-xl text-center border border-green-200 dark:border-green-800">
              <div className="text-3xl font-bold text-green-600">{lowRiskCount}</div>
              <div className="text-xs text-green-700 dark:text-green-400 font-medium">Low Risk</div>
              <div className="text-[10px] text-green-500 mt-1">&lt;60% similar</div>
            </div>
          </div>

          {searchKeywords && searchKeywords.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs text-muted-foreground mb-2">Search keywords used:</div>
              <div className="flex flex-wrap gap-1">
                {searchKeywords.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results List */}
      <div className="space-y-4">
        {priorArt.map((result, index) => {
          const risk = getRiskLevel(result.similarity_score);
          const isExpanded = expandedResults.has(result.id);
          
          return (
            <motion.div
              key={result.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`transition-all hover:shadow-lg ${getSimilarityBorder(result.similarity_score)}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base leading-tight line-clamp-2">
                        {result.title}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span className="font-mono bg-muted px-2 py-0.5 rounded">
                          {result.publication_number}
                        </span>
                        {result.source && (
                          <span className="flex items-center gap-1">
                            {getSourceIcon(result.source)} {result.source}
                          </span>
                        )}
                        {result.patent_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatMonthYear(result.patent_date)}
                          </span>
                        )}
                        {result.assignee && result.assignee !== 'Unknown' && (
                          <span className="flex items-center gap-1 truncate max-w-[150px]">
                            <Building2 className="w-3 h-3" />
                            {result.assignee}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Badge className={`px-3 py-1 ${getSimilarityColor(result.similarity_score)}`}>
                        {Math.round(result.similarity_score * 100)}% Match
                      </Badge>
                      <div className={`text-xs font-medium flex items-center gap-1 ${risk.color}`}>
                        <risk.icon className="w-3 h-3" />
                        {risk.label}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {result.summary}
                  </p>

                  {/* Score breakdown */}
                  {(result.semantic_score !== undefined || result.keyword_score !== undefined) && (
                    <div className="flex items-center gap-4 text-xs">
                      {result.semantic_score !== undefined && result.semantic_score > 0 && (
                        <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/30 px-2 py-1 rounded">
                          <Brain className="w-3 h-3 text-purple-500" />
                          <span className="text-purple-700 dark:text-purple-300">
                            Semantic: {Math.round(result.semantic_score * 100)}%
                          </span>
                        </div>
                      )}
                      {result.keyword_score !== undefined && result.keyword_score > 0 && (
                        <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded">
                          <FileText className="w-3 h-3 text-blue-500" />
                          <span className="text-blue-700 dark:text-blue-300">
                            Keyword: {Math.round(result.keyword_score * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expandable Analysis */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 pt-4 border-t"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {result.overlap_claims && result.overlap_claims.length > 0 && (
                            <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                              <div className="font-medium text-red-800 dark:text-red-300 text-sm mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Potential Overlaps
                              </div>
                              <ul className="space-y-1.5">
                                {result.overlap_claims.map((claim, idx) => (
                                  <li key={idx} className="text-xs text-red-700 dark:text-red-400 flex items-start gap-2">
                                    <span className="text-red-500 mt-1 flex-shrink-0">•</span>
                                    <span>{claim}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {result.difference_claims && result.difference_claims.length > 0 && (
                            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                              <div className="font-medium text-green-800 dark:text-green-300 text-sm mb-2 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                Your Differentiators
                              </div>
                              <ul className="space-y-1.5">
                                {result.difference_claims.map((claim, idx) => (
                                  <li key={idx} className="text-xs text-green-700 dark:text-green-400 flex items-start gap-2">
                                    <span className="text-green-500 mt-1 flex-shrink-0">✓</span>
                                    <span>{claim}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="p-3 bg-muted/50 rounded-lg">
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div><span className="font-medium">Full Abstract:</span></div>
                            <p className="leading-relaxed">{result.summary}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => toggleExpanded(result.id)}
                      className="gap-2"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          Hide Analysis
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          View Analysis
                        </>
                      )}
                    </Button>
                    {result.url && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => window.open(result.url, '_blank')}
                        className="gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Patent
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
