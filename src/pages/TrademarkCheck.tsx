import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PageSEO } from '@/components/SEO';
import { ProtectedHeader } from '@/components/ProtectedHeader';
import {
  Search, ArrowLeft, Shield, AlertTriangle, CheckCircle, ExternalLink,
  Loader2, Tag, Building2, Calendar, ChevronDown, ChevronUp, Globe
} from 'lucide-react';
import {
  TRADEMARK_SEARCH_PRICE_DISPLAY_MO,
  FREE_SEARCHES_LIMIT,
} from '@/lib/pricingConstants';

interface TrademarkResult {
  id?: string;
  mark_name: string;
  registration_number: string | null;
  serial_number: string | null;
  status: string;
  owner: string;
  filing_date: string | null;
  registration_date: string | null;
  nice_classes: string[];
  goods_services: string | null;
  similarity_score: number;
  conflict_analysis: string[];
  differentiation_points: string[];
  source: string;
  url: string | null;
}

const NICE_CLASS_OPTIONS = [
  { value: '009', label: 'Class 9 — Software, Electronics' },
  { value: '025', label: 'Class 25 — Clothing' },
  { value: '035', label: 'Class 35 — Advertising, Business' },
  { value: '041', label: 'Class 41 — Education, Entertainment' },
  { value: '042', label: 'Class 42 — Technology, SaaS' },
  { value: '043', label: 'Class 43 — Food Services' },
];

export default function TrademarkCheck() {
  const [markName, setMarkName] = useState('');
  const [markDescription, setMarkDescription] = useState('');
  const [markUrl, setMarkUrl] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [results, setResults] = useState<TrademarkResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState<number | string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!markName.trim()) {
      toast({ title: 'Enter a trademark', description: 'Please enter the trademark name to search.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setResults([]);
    setHasSearched(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/auth'); return; }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-trademarks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            mark_name: markName.trim(),
            mark_description: markDescription.trim() || undefined,
            mark_url: markUrl.trim() || undefined,
            nice_classes: selectedClasses.length > 0 ? selectedClasses : undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402) {
          toast({ title: 'No credits remaining', description: 'Subscribe to continue searching.', variant: 'destructive' });
          return;
        }
        throw new Error(data.error || 'Search failed');
      }

      setResults(data.results || []);
      setCreditsRemaining(data.search_credits_remaining);

      toast({
        title: `Found ${data.results_found || 0} potential conflicts`,
        description: data.results_found > 0
          ? 'Review the results below for potential trademark conflicts.'
          : 'No conflicting marks found. This is a positive sign!',
      });
    } catch (error: any) {
      console.error('Trademark search error:', error);
      toast({ title: 'Search failed', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getSimilarityColor = (score: number) => {
    if (score >= 0.7) return 'text-red-500';
    if (score >= 0.4) return 'text-amber-500';
    return 'text-green-500';
  };

  const getSimilarityLabel = (score: number) => {
    if (score >= 0.7) return 'High Risk';
    if (score >= 0.4) return 'Medium Risk';
    return 'Low Risk';
  };

  const getRiskBadge = (score: number) => {
    if (score >= 0.7) return <Badge variant="destructive">High Risk</Badge>;
    if (score >= 0.4) return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Medium Risk</Badge>;
    return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Low Risk</Badge>;
  };

  const toggleClass = (cls: string) => {
    setSelectedClasses(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );
  };

  const highRisk = results.filter(r => r.similarity_score >= 0.7).length;
  const medRisk = results.filter(r => r.similarity_score >= 0.4 && r.similarity_score < 0.7).length;
  const lowRisk = results.filter(r => r.similarity_score < 0.4).length;

  return (
    <div className="min-h-screen bg-background">
      <PageSEO.Check />

      {/* Header */}
      <header className="border-b border-border bg-card/95 backdrop-blur-xl sticky top-0 z-50" style={{ boxShadow: 'var(--shadow-xs)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-3 sm:py-4 gap-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="text-muted-foreground">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <div className="h-5 w-px bg-border hidden sm:block" />
              <h1 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                Trademark Search
              </h1>
            </div>
            {creditsRemaining !== null && (
              <Badge variant="outline" className="text-xs">
                {creditsRemaining === 'unlimited' ? '∞ searches' : `${creditsRemaining} free searches left`}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Search Form */}
        <Card className="mb-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Search for Conflicting Trademarks
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter your proposed trademark to check for existing conflicts in the USPTO database.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Trademark Name *</label>
              <Input
                value={markName}
                onChange={e => setMarkName(e.target.value)}
                placeholder='e.g. "TechNova", "BrightPath Solutions"'
                className="text-base"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Website / URL (optional)</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={markUrl}
                  onChange={e => setMarkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="text-base pl-9"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Link to your brand's website or product page for context.</p>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Description (optional)</label>
              <Textarea
                value={markDescription}
                onChange={e => setMarkDescription(e.target.value)}
                placeholder="Describe the goods or services associated with this mark..."
                rows={2}
                className="resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nice Classification (optional)</label>
              <div className="flex flex-wrap gap-2">
                {NICE_CLASS_OPTIONS.map(cls => (
                  <Badge
                    key={cls.value}
                    variant={selectedClasses.includes(cls.value) ? 'default' : 'outline'}
                    className="cursor-pointer transition-colors text-xs py-1 px-2.5"
                    onClick={() => toggleClass(cls.value)}
                  >
                    {cls.label}
                  </Badge>
                ))}
              </div>
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading || !markName.trim()}
              className="w-full btn-dark h-11 rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching USPTO & trademark databases...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Search Trademarks
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <Card className="mb-6">
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-foreground font-medium">Searching trademark databases...</p>
              <p className="text-sm text-muted-foreground mt-1">Checking USPTO TESS, phonetic variants, and similar marks</p>
            </CardContent>
          </Card>
        )}

        {/* Results Summary */}
        {!loading && results.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <Card className="border-red-500/20 bg-red-500/5">
                <CardContent className="py-4 text-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-500">{highRisk}</p>
                  <p className="text-xs text-muted-foreground">High Risk</p>
                </CardContent>
              </Card>
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="py-4 text-center">
                  <Shield className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-amber-500">{medRisk}</p>
                  <p className="text-xs text-muted-foreground">Medium Risk</p>
                </CardContent>
              </Card>
              <Card className="border-green-500/20 bg-green-500/5">
                <CardContent className="py-4 text-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-500">{lowRisk}</p>
                  <p className="text-xs text-muted-foreground">Low Risk</p>
                </CardContent>
              </Card>
            </div>

            {/* Results List */}
            <div className="space-y-3">
              {results.map((result, idx) => (
                <Card
                  key={idx}
                  className="overflow-hidden transition-all hover:shadow-card cursor-pointer"
                  onClick={() => setExpandedResult(expandedResult === idx ? null : idx)}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-foreground text-base">
                            {result.mark_name}
                          </h3>
                          {getRiskBadge(result.similarity_score)}
                          {result.status && (
                            <Badge variant="outline" className="text-[10px]">
                              {result.status}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {result.owner && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {result.owner}
                            </span>
                          )}
                          {result.registration_number && (
                            <span>Reg #{result.registration_number}</span>
                          )}
                          {result.filing_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {result.filing_date}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <p className={`text-lg font-bold ${getSimilarityColor(result.similarity_score)}`}>
                            {Math.round(result.similarity_score * 100)}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">similarity</p>
                        </div>
                        {expandedResult === idx ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {result.goods_services && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {result.goods_services}
                      </p>
                    )}

                    {result.nice_classes?.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {result.nice_classes.map((cls, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                            Class {cls}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Expanded Details */}
                    {expandedResult === idx && (
                      <div className="mt-4 pt-4 border-t border-border space-y-3">
                        {result.conflict_analysis?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1.5">
                              ⚠️ Potential Conflicts
                            </h4>
                            <ul className="space-y-1">
                              {result.conflict_analysis.map((c, i) => (
                                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                                  {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.differentiation_points?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-green-500 uppercase tracking-wider mb-1.5">
                              ✓ Differentiators
                            </h4>
                            <ul className="space-y-1">
                              {result.differentiation_points.map((d, i) => (
                                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                                  <CheckCircle className="h-3.5 w-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                                  {d}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.url && (
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View on USPTO
                          </a>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* No results message */}
        {!loading && hasSearched && results.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No Conflicts Found!</h3>
              <p className="text-sm text-muted-foreground">
                No conflicting trademarks were found for "{markName}". This is a positive sign for registration,
                but we still recommend consulting a trademark attorney.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Legal Disclaimer */}
        <div className="mt-8 text-center">
          <p className="text-[11px] text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            This trademark search tool is provided as a preliminary research aid only. It is not a substitute for a comprehensive
            trademark clearance opinion from a licensed attorney. Results may not include all conflicting marks. Always consult a
            trademark attorney before filing an application with the USPTO.
          </p>
        </div>
      </main>
    </div>
  );
}
