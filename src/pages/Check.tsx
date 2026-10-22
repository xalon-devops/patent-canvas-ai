import { ProtectedHeader } from '@/components/ProtectedHeader';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSearchCredits } from '@/hooks/usePatentData';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { Search, ArrowLeft, Sparkles, Lock, Zap, CheckCircle, Loader2, History } from 'lucide-react';
import { formatDateShort } from '@/lib/dateUtils';
import { getEdgeErrorMessage } from '@/lib/edgeError';

import { EmbeddedStripeCheckout } from '@/components/EmbeddedStripeCheckout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PriorArtDisplay from '@/components/PriorArtDisplay';
import ItemActionsMenu from '@/components/ItemActionsMenu';
import { PageSEO } from '@/components/SEO';
import { FREE_SEARCHES_LIMIT, CHECK_AND_SEE_PRICE } from '@/lib/pricingConstants';
import { trackPriorArtSearch } from '@/hooks/useFunnelTracking';

interface SearchHistoryRow {
  id: string;
  query: string;
  title?: string | null;
  patent_type: string | null;
  results_count: number;
  created_at: string;
}

const HISTORY_PAGE = 20;

const Check = () => {
  // Auth + access (admin / subscription) come from the shared context; only credits are fetched here
  const { user, access, refreshAccess } = useUserProfile();
  const userId = user?.id;
  const { credits: searchCredits, loading: creditsLoading, refetch: refetchCredits } = useSearchCredits(userId);
  const loading = creditsLoading || !access.loaded;
  
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
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [openingHistoryId, setOpeningHistoryId] = useState<string | null>(null);
  const [lastSearchRan, setLastSearchRan] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Past searches are saved so a paid search is never lost on refresh.
  // The list loads light columns only; a search's results are fetched when it is opened.
  const loadHistory = useCallback(async (offset = 0) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('prior_art_searches')
      .select('id, query, title, patent_type, results_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + HISTORY_PAGE);
    if (error) {
      console.error('Error loading search history:', error);
      setHistoryError('Your past searches could not be loaded.');
      return;
    }
    setHistoryError(null);
    const rows = (data as unknown as SearchHistoryRow[]) ?? [];
    setHistoryHasMore(rows.length > HISTORY_PAGE);
    const page = rows.slice(0, HISTORY_PAGE);
    setHistory(prev => (offset === 0 ? page : [...prev, ...page.filter(r => !prev.some(p => p.id === r.id))]));
  }, [userId]);

  useEffect(() => {
    loadHistory(0);
  }, [loadHistory]);

  const loadMoreHistory = async () => {
    setHistoryLoadingMore(true);
    try { await loadHistory(history.length); } finally { setHistoryLoadingMore(false); }
  };

  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  const renameSearch = async (id: string, title: string) => {
    const { data, error } = await supabase.from('prior_art_searches').update({ title }).eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('This search could not be found. Refresh and try again.');
    setHistory(h => h.map(x => x.id === id ? { ...x, title } : x));
  };
  // Throws so ItemActionsMenu shows the error inside the confirm dialog
  const deleteSearch = async (id: string) => {
    const { data, error } = await supabase.from('prior_art_searches').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('This search could not be deleted. Refresh and try again.');
    setHistory(h => h.filter(x => x.id !== id));
    if (activeHistoryId === id) { setActiveHistoryId(null); setPriorArtResults([]); }
  };

  const openHistoryEntry = async (entry: SearchHistoryRow) => {
    if (openingHistoryId) return;
    setOpeningHistoryId(entry.id);
    try {
      const { data, error } = await supabase
        .from('prior_art_searches')
        .select('results')
        .eq('id', entry.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('This search is no longer available.');
      setActiveHistoryId(entry.id);
      setSearchQuery(entry.query);
      setSearchDescription('');
      setPriorArtResults(Array.isArray(data.results) ? (data.results as any[]) : []);
      setSearchKeywords([]);
      setLastSearchRan(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      toast({ title: 'Could not open that search', description: e.message, variant: 'destructive' });
    } finally {
      setOpeningHistoryId(null);
    }
  };

  // Admins, free grants and active Check & See subscribers have unlimited searches
  const hasSubscription = access.isAdmin || access.isPaid;

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
      let title: string = data?.invention_title || '';
      if (!title) {
        try { title = new URL(url).hostname.replace(/^www\./, ''); } catch { title = url; }
      }
      setSearchQuery(title);
      const description: string = data?.invention_description || content.slice(0, 3000);
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
    if (!u || autoRan || loading) return;
    setAutoRan(true);
    setWebsiteUrl(u);
    (async () => {
      const read = await handleReadWebsite(u);
      if (read) await handleSearch(read.title, read.description);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, autoRan, loading]);

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
    setActiveHistoryId(null);
    setLastSearchRan(false);

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
          setLocalFreeSearches(0);
          setShowCheckout(true);
          return;
        }
        throw new Error(parsed.message);
      }
      if (data?.success === false) throw new Error(data?.error || 'Failed to search prior art. Please try again.');

      if (Array.isArray(data?.results)) {
        setLastSearchRan(true);
        setPriorArtResults(data.results);
        setSearchKeywords(data.keywords_used || []);
        
        // Track successful prior art search
        trackPriorArtSearch(qTitle);
        
        // Update remaining searches locally for immediate feedback
        if (typeof data.search_credits_remaining === 'number') {
          setLocalFreeSearches(data.search_credits_remaining);
        }

        // Persist the search so the user can come back to results they paid for
        if (userId) {
          const { data: saved, error: saveError } = await supabase
            .from('prior_art_searches')
            .insert({
              user_id: userId,
              query: qTitle.slice(0, 500),
              results_count: data.results.length,
              results: data.results,
            })
            .select('id, query, title, patent_type, results_count, created_at')
            .single();
          if (saveError) {
            console.error('Error saving search history:', saveError);
          } else if (saved) {
            setHistory(h => [saved as SearchHistoryRow, ...h.filter(x => x.id !== saved.id)]);
            setActiveHistoryId(saved.id);
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

  const historySection = (
    <>
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
            {history.map((entry) => {
              const name = entry.title || entry.query;
              const active = activeHistoryId === entry.id;
              return (
                <div
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  aria-busy={openingHistoryId === entry.id}
                  onClick={() => openHistoryEntry(entry)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openHistoryEntry(entry); } }}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {formatDateShort(entry.created_at)} · {entry.results_count} {entry.results_count === 1 ? 'result' : 'results'}
                      {entry.title && entry.title !== entry.query ? ` · ${entry.query}` : ''}
                    </p>
                  </div>
                  {openingHistoryId === entry.id
                    ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                    : active && <span className="text-[11px] font-medium text-primary flex-shrink-0">Viewing</span>}
                  <ItemActionsMenu
                    name={name}
                    itemLabel="search"
                    onRename={(t) => renameSearch(entry.id, t)}
                    onDelete={() => deleteSearch(entry.id)}
                  />
                </div>
              );
            })}
            {historyHasMore && (
              <Button variant="ghost" size="sm" className="w-full" disabled={historyLoadingMore} onClick={loadMoreHistory}>
                {historyLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Show older searches'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {historyError && history.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {historyError}{' '}
          <button type="button" className="underline" onClick={() => loadHistory(0)}>Try again</button>
        </p>
      )}
    </>
  );

  if (loading) {
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
      <ProtectedHeader title="Check & See" />

      <main className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl">
        {!hasSubscription && freeSearchesRemaining === 0 ? (
          /* Subscription Required */
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Lock className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Subscription Required</h2>
              <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
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

            {priorArtResults.length > 0 && (
              <div className="text-left">
                <PriorArtDisplay
                  priorArt={priorArtResults}
                  searchKeywords={searchKeywords}
                  productDescription={searchDescription || searchQuery}
                />
              </div>
            )}

            <div className="text-left space-y-2">{historySection}</div>
          </div>
        ) : (
          /* Search Interface with Free Trial Banner */
          <div className="space-y-8">
            {!hasSubscription && freeSearchesRemaining > 0 && (
              <Card className="bg-gradient-to-r from-accent/10 to-secondary/10 border-accent/30">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                      className="w-full sm:w-auto"
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
                productDescription={searchDescription || searchQuery}
                onRetrySearch={handleSearch}
              />
            )}

            {historySection}

            {searching && (
              <Card className="shadow-card text-center p-8 sm:p-12">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Searching patent databases. This can take up to a minute.</p>
              </Card>
            )}

            {!searching && priorArtResults.length === 0 && searchQuery && (
              <Card className="shadow-card text-center p-8 sm:p-12">
                <Search className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold mb-2">{lastSearchRan ? 'No similar patents found' : 'No results yet'}</h3>
                <p className="text-muted-foreground">
                  {lastSearchRan
                    ? 'We did not find close matches. Try a more specific title or add detail to the description.'
                    : 'Click "Search Prior Art" to find existing patents related to your invention.'}
                </p>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Stripe Checkout Modal */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subscribe to Check & See</DialogTitle>
          </DialogHeader>
          <EmbeddedStripeCheckout
            planType="check_and_see"
            mode="subscription"
            onSuccess={() => {
              setShowCheckout(false);
              refreshAccess();
              refetchCredits();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Check;
