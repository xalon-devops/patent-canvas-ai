import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  BookOpen, 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GlossaryTerm {
  term: string;
  definition: string;
  standardTerm: string | null;
  category: string;
  usage: string;
  recommendation: string | null;
}

interface GlossarySummary {
  totalTerms: number;
  needsStandardization: number;
  categories: Record<string, number>;
}

interface PatentGlossaryProps {
  sections: Array<{
    section_type: string;
    content: string;
  }>;
}

const categoryColors: Record<string, string> = {
  'acronym': 'bg-blue-100 text-blue-800',
  'technical': 'bg-purple-100 text-purple-800',
  'legal': 'bg-amber-100 text-amber-800',
  'scientific': 'bg-green-100 text-green-800',
  'industry-specific': 'bg-rose-100 text-rose-800',
};

export default function PatentGlossary({ sections }: PatentGlossaryProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [summary, setSummary] = useState<GlossarySummary | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const extractGlossary = async () => {
    setIsLoading(true);
    
    try {
      // Combine all section content for analysis
      const allContent = sections
        .filter(s => s.content && s.content.length > 20)
        .map(s => `## ${s.section_type.toUpperCase()}\n${s.content}`)
        .join('\n\n');

      if (!allContent) {
        toast.error('No content available to analyze');
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('extract-patent-glossary', {
        body: { content: allContent, sectionType: 'full patent application' }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setTerms(data.terms || []);
      setSummary(data.summary || null);
      setHasAnalyzed(true);

    } catch (error) {
      console.error('Glossary extraction failed:', error);
      toast.error('Failed to extract glossary');
    } finally {
      setIsLoading(false);
    }
  };

  const needsStandardization = terms.filter(t => t.standardTerm);
  const hasRecommendations = terms.filter(t => t.recommendation);

  if (!hasAnalyzed) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500 text-white">
              <BookOpen size={20} />
            </div>
            <div>
              <CardTitle className="text-lg">Patent Glossary</CardTitle>
              <CardDescription>
                Extract and define technical terms from your application
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Analyze your patent application to identify technical terms,<br />
              get definitions, and receive standardization suggestions.
            </p>
            <Button onClick={extractGlossary} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Glossary
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500 text-white">
              <BookOpen size={20} />
            </div>
            <div>
              <CardTitle className="text-lg">Patent Glossary</CardTitle>
              <CardDescription>
                {summary?.totalTerms || 0} terms identified
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={extractGlossary} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="flex flex-wrap gap-2 mt-3">
            {needsStandardization.length > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                <AlertCircle className="w-3 h-3 mr-1" />
                {needsStandardization.length} need standardization
              </Badge>
            )}
            {Object.entries(summary.categories || {}).map(([cat, count]) => (
              <Badge key={cat} variant="secondary" className="text-xs">
                {cat}: {count}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {terms.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">No technical terms requiring attention found.</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <Accordion type="multiple" className="space-y-2">
              {terms.map((term, index) => (
                <AccordionItem 
                  key={index} 
                  value={`term-${index}`}
                  className="border rounded-lg px-3"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2 text-left">
                      <span className="font-semibold">{term.term}</span>
                      <Badge className={`text-xs ${categoryColors[term.category] || 'bg-gray-100 text-gray-800'}`}>
                        {term.category}
                      </Badge>
                      {term.standardTerm && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                          Needs update
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-muted-foreground">Definition:</span>
                        <p className="mt-1">{term.definition}</p>
                      </div>

                      {term.usage && (
                        <div>
                          <span className="font-medium text-muted-foreground">Usage in application:</span>
                          <p className="mt-1 text-muted-foreground italic">"{term.usage}"</p>
                        </div>
                      )}

                      {term.standardTerm && (
                        <div className="p-2 bg-amber-50 rounded-md border border-amber-200">
                          <span className="font-medium text-amber-800">Standardized term:</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-muted-foreground line-through">{term.term}</span>
                            <ArrowRight className="w-4 h-4 text-amber-600" />
                            <span className="font-semibold text-amber-800">{term.standardTerm}</span>
                          </div>
                        </div>
                      )}

                      {term.recommendation && (
                        <div className="p-2 bg-blue-50 rounded-md border border-blue-200">
                          <span className="font-medium text-blue-800">Recommendation:</span>
                          <p className="mt-1 text-blue-700">{term.recommendation}</p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
