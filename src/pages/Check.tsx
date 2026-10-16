import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuthenticatedPatentData } from '@/hooks/usePatentData';
import { Search, ArrowLeft, Sparkles, Lock, Zap, CheckCircle, Loader2, History } from 'lucide-react';
import { formatDateShort } from '@/lib/dateUtils';
import { getEdgeErrorMessage } from '@/lib/edgeError';
import { useAdminStatus } from '@/hooks/useAdminStatus';

interface SearchHistoryRow {
  id: string;
  query: string;
  patent_type: string | null;
  results_count: number;
  results: any;
  created_at: string;
}
import { EmbeddedStripeCheckout } from '@/components/EmbeddedStripeCheckout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PriorArtDisplay from '@/components/PriorArtDisplay';
import { PageSEO } from '@/components/SEO';
import { STRIPE_CHECK_AND_SEE_PRICE_ID, FREE_SEARCHES_LIMIT, CHECK_AND_SEE_PRICE } from '@/lib/pricingConstants';
import { trackPriorArtSearch } from '@/hooks/useFunnelTracking';

const Check = () => {
  // Use centralized data hook - single source of truth
  const { 
    subscription, 
    searchCredits, 
    loading, 
    isAuthenticated,
    refetch 
  } = useAuthenticatedPatentData();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [searching, setSearching] = useState(false);
  const [priorArtResults, setPriorArtResults] = useState<any[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [localFreeSearches, setLocalFreeSearches] = useState<number | null>(null);
  const [searchKeywords, setSearchKeywords] = useState<string[]>([]);
  const [history, setHistory] = useState<SearchHistoryRow[]>([]);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [readingSite, setReadingSite] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id));
  }, []);
  const adminStatus = useAdminStatus(currentUserId);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Past searches are saved so a paid search is never lost on refresh
  const loadHistory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('prior_art_searches')
      .select('id, query, patent_type, results_count, results, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) {
      console.error('Error loading search history:', error);
      return;
    }
    setHistory((data as unknown as SearchHistoryRow[]) ?? []);
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadHistory();
  }, [isAuthenticated, loadHistory]);

  const openHistoryEntry = (entry: SearchHistoryRow) => {
    setSearchQuery(entry.query);
    setPriorArtResults(Array.isArray(entry.results) ? entry.results : []);
    setSearchKeywords([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Derived state from centralized hook; admins and free grants always have unlimited access
  const hasSubscription = adminStatus.canBypassPaywall || subscription?.status === 'active' || subscription?.status === 'trialing';

  const handleReadWebsite = async (override?: string): Promise<{ title: string; description: string } | null> => {
    let url = (override ?? websiteUrl).trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    setReadingSite(true);
    try {
      const { data, error } = await supabase.functions.invoke('crawl-url-content', { body: { url } });
      if (error) {
        const parsed = await getEdgeErrorMessage(error, 'Could not read that website.');
        throw new Error(parsed.message);
      }
      const content: string = (data?.content || '').replace(/\s+/g, ' ').trim();
      if (!content) throw new Error('No readable text was found on that website.');
      let title = searchQuery.trim();
      if (!title) {
        try { title = new URL(url).hostname.replace(/^www\./, ''); } catch { title = url; }
        setSearchQuery(title);
      }
      const description = content.slice(0, 3000);
      setSearchDescription(description);
      return { title, description };
    } catch (e: any) {
      toast({ title: 'Website could not be read', description: e.message, variant: 'destructive' });
      return null;
    } finally {
      setReadingSite(false);
    }
  };
  const freeSearchesRemaining = localFreeSearches ?? searchCredits?.free_searches_remaining ?? FREE_SEARCHES_LIMIT;

  // Auth is enforced by ProtectedRoute wrapper; no internal redirect needed.

  const [searchParams] = useSearchParams();
  const [autoRan, setAutoRan] = useState(false);
  useEffect(() => {
    const u = searchParams.get('url');
    if (!u || autoRan || loading || adminStatus.loading) return;
    setAutoRan(true);
    setWebsiteUrl(u);
    (async () => {
      const read = await handleReadWebsite(u);
      if (read) await handleSearch(read.title, read.description);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, autoRan, loading, adminStatus.loading]);

  const handleSearch = async (titleOverride?: string, descOverride?: string) => {
    const qTitle = titleOverride ?? searchQuery;
    const qDesc = descOverride ?? searchDescription;
    if (!qTitle.trim()) {
      toast({
        title: "Search query required",
        description: "Please enter a patent idea or description to search.",
        variant: "destructive",
      });
      return;
    }

    setSearching(true);
    setPriorArtResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('search-prior-art-enhanced', {
        body: {
          ideaTitle: qTitle,
          ideaDescription: qDesc || qTitle,
        }
      });

      if (error) {
        const parsed = await getEdgeErrorMessage(error, 'Failed to search prior art. Please try again.');
        if (parsed.requiresSubscription) {
          toast({
            title: "Subscription Required",
            description: `You've used all ${FREE_SEARCHES_LIMIT} free searches. Subscribe to continue!`,
            variant: "destructive",
          });
          setShowCheckout(true);
          return;
        }
        throw new Error(parsed.message);
      }

      if (data?.results) {
        setPriorArtResults(data.results);
        setSearchKeywords(data.keywords_used || []);
        
        // Track successful prior art search
        trackPriorArtSearch(qTitle);
        
        // Update remaining searches locally for immediate feedback
        if (data.search_credits_remaining !== 'unlimited') {
          setLocalFreeSearches(data.search_credits_remaining);
        }

        // Persist the search so the user can come back to results they paid for
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: saveError } = await supabase
            .from('prior_art_searches')
            .insert({
              user_id: user.id,
              query: qTitle,
              results_count: data.results.length,
              results: data.results,
            } as any);
          if (saveError) {
            console.error('Error saving search history:', saveError);
          } else {
            loadHistory();
          }
        }
      }
    } catch (error: any) {
      console.error('Search error:', error);
      toast({
        title: "Search failed",
        description: error.message || "Failed to search prior art. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  if (loading || adminStatus.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PageSEO.Check />
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary/10 rounded-lg">
                  <Search className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Check & See</h1>
                  <p className="text-sm text-muted-foreground">
                    Search for existing patents before you file
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-5xl">
        {!hasSubscription && freeSearchesRemaining === 0 ? (
          /* Subscription Required */
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Lock className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-3xl font-bold text-foreground">Subscription Required</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Get unlimited patent searches with our Check & See subscription. 
                Search before you file to save time and money.
              </p>
            </div>

            <Card className="max-w-md mx-auto shadow-card border-primary/20">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl text-foreground">Check & See Plan</CardTitle>
                <CardDescription>Unlimited prior patent searches</CardDescription>
                <div className="text-4xl font-bold mt-4 text-primary">
                  ${CHECK_AND_SEE_PRICE}
                  <span className="text-base font-normal text-muted-foreground block mt-1">per month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm text-foreground">Unlimited searches</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm text-foreground">AI-powered analysis</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm text-foreground">USPTO & Google Patents</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm text-foreground">Cancel anytime</span>
                  </div>
                </div>
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => setShowCheckout(true)}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Subscribe Now - ${CHECK_AND_SEE_PRICE}/month
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Search Interface with Free Trial Banner */
          <div className="space-y-8">
            {!hasSubscription && freeSearchesRemaining > 0 && (
              <Card className="bg-gradient-to-r from-accent/10 to-secondary/10 border-accent/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent/20 rounded-lg">
                        <Sparkles className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Free Trial Active 🎉</h3>
                        <p className="text-sm text-muted-foreground">
                          {freeSearchesRemaining} of {FREE_SEARCHES_LIMIT} free searches remaining
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowCheckout(true)}
                    >
                      Subscribe for Unlimited
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {hasSubscription && (
              <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">✨ Unlimited Searches Active</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-secondary" />
                  Search Prior Patents
                </CardTitle>
                <CardDescription>
                  Enter your invention idea to search for existing patents and assess novelty
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Company or product website (optional)</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., yourcompany.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      disabled={searching || readingSite}
                    />
                    <Button variant="outline" onClick={() => handleReadWebsite()} disabled={!websiteUrl.trim() || readingSite || searching}>
                      {readingSite ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Read site'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Reads the website and fills in what the product does. Edit the description to focus on what is new about it.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Invention Title</label>
                  <Input
                    placeholder="e.g., Smart Home Energy Management System"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={searching}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Description (Optional)</label>
                  <Textarea
                    placeholder="Provide additional details about your invention..."
                    value={searchDescription}
                    onChange={(e) => setSearchDescription(e.target.value)}
                    disabled={searching}
                    className="min-h-[100px]"
                  />
                </div>
                <Button 
                  onClick={() => handleSearch()}
                  disabled={searching || !searchQuery.trim()}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {searching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search Prior Art
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {priorArtResults.length > 0 && (
              <PriorArtDisplay 
                priorArt={priorArtResults} 
                searchKeywords={searchKeywords}
                onRetrySearch={handleSearch}
              />
            )}

            {history.length > 0 && (
              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="h-4 w-4" />
                    Your past searches
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Tap any search to reopen its results — no new credit is used.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {history.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => openHistoryEntry(entry)}
                      className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium truncate">{entry.query}</p>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDateShort(entry.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {entry.results_count} {entry.results_count === 1 ? 'result' : 'results'}
                      </p>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {!searching && priorArtResults.length === 0 && searchQuery && (
              <Card className="shadow-card text-center p-12">
                <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No results yet</h3>
                <p className="text-muted-foreground">
                  Click "Search Prior Art" to find existing patents related to your invention.
                </p>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Stripe Checkout Modal */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Subscribe to Check & See</DialogTitle>
          </DialogHeader>
          <EmbeddedStripeCheckout
            priceId={STRIPE_CHECK_AND_SEE_PRICE_ID}
            planType="check_and_see"
            mode="subscription"
            onSuccess={() => {
              setShowCheckout(false);
              refetch(); // Refetch centralized data
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Check;
