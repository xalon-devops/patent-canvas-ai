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
  FileText
} from 'lucide-react';
import { formatMonthYear } from '@/lib/dateUtils';

interface PriorArtResult {
  id: string;
  title: string;
  publication_number: string;
  summary: string;
  similarity_score: number;
  url: string;
  created_at: string;
  overlap_claims?: string[];
  difference_claims?: string[];
}

interface PriorArtDisplayProps {
  priorArt: PriorArtResult[];
  isSearching?: boolean;
  onRetrySearch?: () => void;
}

export default function PriorArtDisplay({ priorArt, isSearching = false, onRetrySearch }: PriorArtDisplayProps) {
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  const getSimilarityColor = (score: number) => {
    if (score > 0.8) return 'text-red-600 bg-red-50';
    if (score > 0.6) return 'text-orange-600 bg-orange-50';
    if (score > 0.4) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getSimilarityIcon = (score: number) => {
    if (score > 0.8) return <AlertTriangle className="w-4 h-4" />;
    if (score > 0.6) return <TrendingUp className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const getRiskLevel = (score: number) => {
    if (score > 0.8) return 'High Risk';
    if (score > 0.6) return 'Medium Risk';
    if (score > 0.4) return 'Low Risk';
    return 'Minimal Risk';
  };

  if (isSearching) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 animate-spin text-primary" />
            Searching Prior Art
          </CardTitle>
          <CardDescription>
            AI is analyzing patent databases for similar inventions...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={33} className="h-2" />
            <div className="text-sm text-muted-foreground">
              • Querying USPTO database...
              <br />
              • Analyzing Lens.org patents...
              <br />
              • Running similarity analysis...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (priorArt.length === 0) {
    return (
      <Card className="border-dashed border-2 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            No Conflicting Prior Art Found
          </CardTitle>
          <CardDescription>
            Great news! No patents were found that significantly overlap with your invention.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              This is a positive indicator for patentability. However, remember that:
            </p>
            <ul className="mt-2 text-xs text-green-700 list-disc list-inside space-y-1">
              <li>Patent searches are not 100% comprehensive</li>
              <li>Professional patent attorney review is recommended</li>
              <li>USPTO examination may uncover additional prior art</li>
            </ul>
          </div>
          {onRetrySearch && (
            <Button onClick={onRetrySearch} variant="outline" size="sm">
              <Search className="w-4 h-4 mr-1" />
              Retry Search
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <AlertTriangle className="w-5 h-5" />
            Prior Art Analysis Results
          </CardTitle>
          <CardDescription>
            Found {priorArt.length} potentially relevant patents. Review carefully for overlap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {priorArt.filter(p => p.similarity_score > 0.8).length}
              </div>
              <div className="text-xs text-red-700">High Risk</div>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {priorArt.filter(p => p.similarity_score > 0.6 && p.similarity_score <= 0.8).length}
              </div>
              <div className="text-xs text-orange-700">Medium Risk</div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {priorArt.filter(p => p.similarity_score <= 0.6).length}
              </div>
              <div className="text-xs text-green-700">Low Risk</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {priorArt.map((result) => (
          <Card key={result.id} className="border transition-all hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-lg leading-tight">{result.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <FileText className="w-4 h-4" />
                    Patent {result.publication_number}
                    <Calendar className="w-4 h-4 ml-2" />
                    {formatMonthYear(result.created_at)}
                  </CardDescription>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <Badge className={`px-3 py-1 ${getSimilarityColor(result.similarity_score)}`}>
                    <div className="flex items-center gap-1">
                      {getSimilarityIcon(result.similarity_score)}
                      {Math.round(result.similarity_score * 100)}% Similar
                    </div>
                  </Badge>
                  <div className="text-xs font-medium">
                    {getRiskLevel(result.similarity_score)}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground leading-relaxed">
                {result.summary}
              </div>

              {result.overlap_claims && result.overlap_claims.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="font-medium text-red-800 text-sm mb-2">⚠️ Potential Overlaps:</div>
                  <ul className="space-y-1">
                    {result.overlap_claims.map((claim, index) => (
                      <li key={index} className="text-xs text-red-700 flex items-start gap-2">
                        <span className="text-red-500 mt-1">•</span>
                        <span>{claim}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.difference_claims && result.difference_claims.length > 0 && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-medium text-green-800 text-sm mb-2">✅ Key Differences:</div>
                  <ul className="space-y-1">
                    {result.difference_claims.map((claim, index) => (
                      <li key={index} className="text-xs text-green-700 flex items-start gap-2">
                        <span className="text-green-500 mt-1">•</span>
                        <span>{claim}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                {result.url && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(result.url, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    View Patent
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setExpandedResult(
                    expandedResult === result.id ? null : result.id
                  )}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  {expandedResult === result.id ? 'Hide' : 'Show'} Details
                </Button>
              </div>

              {expandedResult === result.id && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium">Publication Number:</span> {result.publication_number}
                    </div>
                    <div>
                      <span className="font-medium">Similarity Score:</span> {(result.similarity_score * 100).toFixed(1)}%
                    </div>
                    <div>
                      <span className="font-medium">Full Abstract:</span>
                      <p className="mt-1 text-muted-foreground leading-relaxed">{result.summary}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {onRetrySearch && (
        <Card className="border-dashed">
          <CardContent className="p-4 text-center">
            <Button onClick={onRetrySearch} variant="outline">
              <Search className="w-4 h-4 mr-1" />
              Run New Search
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}