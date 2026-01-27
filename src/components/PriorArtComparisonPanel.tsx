import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, CheckCircle, ExternalLink, Scale, FileText } from 'lucide-react';

interface PriorArtResult {
  id: string;
  title: string;
  publication_number?: string;
  summary?: string;
  similarity_score: number;
  url?: string;
  overlap_claims?: string[];
  difference_claims?: string[];
}

interface PriorArtComparisonPanelProps {
  priorArt: PriorArtResult[];
  sectionType: string;
  sectionContent: string;
}

const getSectionRelevantOverlaps = (priorArt: PriorArtResult[], sectionType: string): PriorArtResult[] => {
  // Filter prior art that has overlap claims relevant to this section type
  return priorArt
    .filter(pa => pa.similarity_score > 0.3)
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, 3);
};

export default function PriorArtComparisonPanel({ 
  priorArt, 
  sectionType, 
  sectionContent 
}: PriorArtComparisonPanelProps) {
  const relevantPriorArt = getSectionRelevantOverlaps(priorArt, sectionType);
  
  if (relevantPriorArt.length === 0) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="py-8 text-center">
          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
          <p className="text-sm text-muted-foreground">
            No significant prior art overlap detected for this section
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Scale className="h-4 w-4 text-amber-600" />
          Prior Art Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {relevantPriorArt.map((pa, index) => (
              <div 
                key={pa.id} 
                className="p-3 bg-background rounded-lg border shadow-sm"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-medium truncate" title={pa.title}>
                      {pa.title}
                    </h4>
                    {pa.publication_number && (
                      <span className="text-xs text-muted-foreground">
                        {pa.publication_number}
                      </span>
                    )}
                  </div>
                  <Badge 
                    variant={pa.similarity_score > 0.7 ? "destructive" : pa.similarity_score > 0.5 ? "secondary" : "outline"}
                    className="text-xs shrink-0"
                  >
                    {Math.round(pa.similarity_score * 100)}%
                  </Badge>
                </div>

                {/* Overlapping aspects */}
                {pa.overlap_claims && pa.overlap_claims.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1 mb-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      <span className="text-xs font-medium text-amber-700">Overlaps</span>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-0.5 pl-4">
                      {pa.overlap_claims.slice(0, 2).map((claim, i) => (
                        <li key={i} className="list-disc">{claim}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Differentiating aspects */}
                {pa.difference_claims && pa.difference_claims.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1 mb-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span className="text-xs font-medium text-green-700">Your Differentiators</span>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-0.5 pl-4">
                      {pa.difference_claims.slice(0, 2).map((claim, i) => (
                        <li key={i} className="list-disc">{claim}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {pa.url && (
                  <a 
                    href={pa.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View Patent <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            <FileText className="h-3 w-3 inline mr-1" />
            AI has incorporated these differentiators into your draft
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
