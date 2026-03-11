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
        <CardContent className="py-3 text-center">
          <CheckCircle className="h-4 w-4 mx-auto mb-1 text-green-500" />
          <p className="text-[10px] text-muted-foreground">
            No significant prior art overlap detected
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-amber-200 bg-amber-50/30">
      <CardHeader className="p-2 sm:p-3 pb-1">
        <CardTitle className="text-xs flex items-center gap-1.5">
          <Scale className="h-3 w-3 text-amber-600" />
          Prior Art Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-3 pt-0">
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-1.5">
            {relevantPriorArt.map((pa) => (
              <div 
                key={pa.id} 
                className="px-1.5 py-1 bg-background rounded border"
              >
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[11px] font-medium truncate" title={pa.title}>
                      {pa.title}
                    </h4>
                    {pa.publication_number && (
                      <span className="text-[10px] text-muted-foreground">
                        {pa.publication_number}
                      </span>
                    )}
                  </div>
                  <Badge 
                    variant={pa.similarity_score > 0.7 ? "destructive" : pa.similarity_score > 0.5 ? "secondary" : "outline"}
                    className="text-[9px] px-1 py-0 shrink-0"
                  >
                    {Math.round(pa.similarity_score * 100)}%
                  </Badge>
                </div>

                {pa.overlap_claims && pa.overlap_claims.length > 0 && (
                  <div className="mb-0.5">
                    <div className="flex items-center gap-0.5 mb-0.5">
                      <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />
                      <span className="text-[10px] font-medium text-amber-700">Overlaps</span>
                    </div>
                    <ul className="text-[10px] text-muted-foreground space-y-0 pl-3">
                      {pa.overlap_claims.slice(0, 2).map((claim, i) => (
                        <li key={i} className="list-disc line-clamp-1">{claim}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {pa.difference_claims && pa.difference_claims.length > 0 && (
                  <div className="mb-0.5">
                    <div className="flex items-center gap-0.5 mb-0.5">
                      <CheckCircle className="h-2.5 w-2.5 text-green-500" />
                      <span className="text-[10px] font-medium text-green-700">Differentiators</span>
                    </div>
                    <ul className="text-[10px] text-muted-foreground space-y-0 pl-3">
                      {pa.difference_claims.slice(0, 2).map((claim, i) => (
                        <li key={i} className="list-disc line-clamp-1">{claim}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {pa.url && (
                  <a 
                    href={pa.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                  >
                    View <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="mt-1.5 pt-1.5 border-t">
          <p className="text-[10px] text-muted-foreground">
            <FileText className="h-2.5 w-2.5 inline mr-0.5" />
            Differentiators incorporated into your draft
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
