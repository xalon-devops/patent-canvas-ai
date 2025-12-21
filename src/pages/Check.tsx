import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuthenticatedPatentData } from '@/hooks/usePatentData';
import { Search, ArrowLeft, Sparkles, Lock, Zap, CheckCircle, Loader2 } from 'lucide-react';
import { EmbeddedStripeCheckout } from '@/components/EmbeddedStripeCheckout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PriorArtDisplay from '@/components/PriorArtDisplay';
import { PageSEO } from '@/components/SEO';
import { STRIPE_CHECK_AND_SEE_PRICE_ID, FREE_SEARCHES_LIMIT, CHECK_AND_SEE_PRICE } from '@/lib/pricingConstants';

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
  const navigate = useNavigate();
  const { toast } = useToast();

  // Derived state from centralized hook
  const hasSubscription = subscription?.status === 'active';
  const freeSearchesRemaining = localFreeSearches ?? searchCredits?.free_searches_remaining ?? FREE_SEARCHES_LIMIT;

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [loading, isAuthenticated, navigate]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
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
          ideaTitle: searchQuery,
          ideaDescription: searchDescription || searchQuery,
        }
      });

      if (error) {
        if (error.message?.includes('subscription')) {
          toast({
            title: "Subscription Required",
            description: `You've used all ${FREE_SEARCHES_LIMIT} free searches. Subscribe to continue!`,
            variant: "destructive",
          });
          setShowCheckout(true);
          return;
        }
        throw error;
      }

      if (data?.results) {
        setPriorArtResults(data.results);
        setSearchKeywords(data.keywords_used || []);
        
        // Update remaining searches locally for immediate feedback
        if (data.search_credits_remaining !== 'unlimited') {
          setLocalFreeSearches(data.search_credits_remaining);
        }

        toast({
          title: "🎯 AI Analysis Complete",
          description: `Found ${data.results.length} patents using semantic AI matching across ${data.sources_used?.join(' & ') || 'multiple databases'}.`,
        });
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
                  onClick={handleSearch}
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
