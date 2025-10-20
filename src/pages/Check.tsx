import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Search, ArrowLeft, Sparkles, Lock, Zap, CheckCircle, Loader2 } from 'lucide-react';
import { EmbeddedStripeCheckout } from '@/components/EmbeddedStripeCheckout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PriorArtDisplay from '@/components/PriorArtDisplay';

const Check = () => {
  const [user, setUser] = useState<User | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [searching, setSearching] = useState(false);
  const [priorArtResults, setPriorArtResults] = useState<any[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuthAndSubscription();
  }, []);

  const checkAuthAndSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate('/auth');
        return;
      }

      setUser(session.user);

      // Check subscription status
      const { data: subData } = await supabase.functions.invoke('check-subscription');
      
      if (subData?.hasSubscription) {
        setHasSubscription(true);
      }
    } catch (error: any) {
      console.error('Error checking subscription:', error);
    } finally {
      setLoading(false);
    }
  };

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
      const { data, error } = await supabase.functions.invoke('search-prior-art', {
        body: {
          ideaTitle: searchQuery,
          ideaDescription: searchDescription || searchQuery,
        }
      });

      if (error) throw error;

      if (data?.results) {
        setPriorArtResults(data.results);
        toast({
          title: "Search complete",
          description: `Found ${data.results.length} potentially related patents.`,
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
        {!hasSubscription ? (
          /* Subscription Required */
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mx-auto">
                <Lock className="h-10 w-10 text-secondary" />
              </div>
              <h2 className="text-3xl font-bold">Subscription Required</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Get unlimited patent searches with our Check & See subscription. 
                Search before you file to save time and money.
              </p>
            </div>

            <Card className="max-w-md mx-auto shadow-card">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Check & See Plan</CardTitle>
                <CardDescription>Unlimited prior patent searches</CardDescription>
                <div className="text-4xl font-bold mt-4 text-secondary">
                  $9.99
                  <span className="text-base font-normal text-muted-foreground block mt-1">per month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-secondary" />
                    <span className="text-sm">Unlimited searches</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-secondary" />
                    <span className="text-sm">AI-powered analysis</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-secondary" />
                    <span className="text-sm">USPTO & Google Patents</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-secondary" />
                    <span className="text-sm">Cancel anytime</span>
                  </div>
                </div>
                <Button 
                  className="w-full bg-secondary hover:bg-secondary/90"
                  onClick={() => setShowCheckout(true)}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Subscribe Now - $9.99/month
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Search Interface */
          <div className="space-y-8">
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
                  className="w-full bg-secondary hover:bg-secondary/90"
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
              <PriorArtDisplay priorArt={priorArtResults} />
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
            priceId={import.meta.env.PROD ? 'price_CHECK_SEE_PROD' : 'price_CHECK_SEE_TEST'}
            planType="check_and_see"
            mode="subscription"
            onSuccess={() => {
              setShowCheckout(false);
              checkAuthAndSubscription();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Check;
