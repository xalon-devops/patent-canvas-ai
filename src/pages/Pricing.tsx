import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { 
  Check, 
  Crown, 
  Zap, 
  Shield, 
  FileText, 
  Bot,
  ArrowLeft,
  Sparkles,
  Search
} from 'lucide-react';
import { PageSEO } from '@/components/SEO';
import { getCurrentYear } from '@/lib/dateUtils';
import { 
  PATENT_APPLICATION_PRICE_DISPLAY, 
  CHECK_AND_SEE_PRICE_DISPLAY, 
  STRIPE_CHECK_AND_SEE_PRICE_ID 
} from '@/lib/pricingConstants';
import { PublicHeader } from '@/components/PublicHeader';

const Pricing = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserSubscription(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserSubscription = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setUserSubscription(data);
    } catch (error: any) {
      console.error('Error checking subscription:', error);
    }
  };

  const handleUpgrade = async () => {
    if (!user) {
      navigate('/auth?tab=signup');
      return;
    }

    setLoading(true);
    
    try {
      toast({
        title: "Redirecting to checkout...",
        description: "Please wait while we prepare your subscription.",
      });

      // Create Stripe checkout session
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId: STRIPE_CHECK_AND_SEE_PRICE_ID,
          planType: 'premium'
        }
      });

      if (error) {
        console.error('Error creating checkout session:', error);
        toast({
          title: "Checkout Error",
          description: "Failed to create checkout session. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (data?.url) {
        // Redirect to Stripe Checkout in new tab
        window.open(data.url, '_blank');
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Error during upgrade:', error);
      toast({
        title: "Upgrade Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isPremium = userSubscription?.status === 'active' && userSubscription?.plan !== 'free';

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PageSEO.Pricing />
      <PublicHeader />

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">
            Professional Patent Applications
            <span className="block text-lg font-normal text-muted-foreground mt-2">
              AI-powered patent drafting with legal-grade quality
            </span>
          </h2>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Patent Application - $1,000 One-Time */}
          <Card className="relative shadow-elegant border-0 bg-gradient-primary text-primary-foreground overflow-hidden">
            <div className="absolute inset-0 bg-gradient-glow opacity-10"></div>
            <div className="absolute top-4 right-4">
              <Badge className="bg-white/20 text-white border-white/30">
                <Crown className="h-3 w-3 mr-1" />
                Most Popular
              </Badge>
            </div>
            <CardHeader className="text-center pb-8 relative">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">Patent Application</CardTitle>
              <CardDescription className="text-primary-foreground/80">
                Complete AI-guided patent filing
              </CardDescription>
              <div className="text-4xl font-bold mt-4 text-white">
                {PATENT_APPLICATION_PRICE_DISPLAY}
                <span className="text-base font-normal text-primary-foreground/80 block mt-1">One-time payment</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 relative">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-white" />
                  <span className="text-sm text-white">AI-guided patent interview</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-white" />
                  <span className="text-sm text-white">Prior art search & analysis</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-white" />
                  <span className="text-sm text-white">Patentability assessment</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-white" />
                  <span className="text-sm text-white">Full patent draft (all sections)</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-white" />
                  <span className="text-sm text-white">USPTO-ready formatting</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-white" />
                  <span className="text-sm text-white">Export to DOCX & PDF</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-white" />
                  <span className="text-sm text-white">Claims drafting assistance</span>
                </div>
              </div>
              <Button 
                variant="secondary" 
                className="w-full mt-6 bg-white/20 text-white border-white/30 hover:bg-white/30 hover:shadow-glow transition-smooth"
                onClick={() => user ? navigate('/new-application') : navigate('/auth?tab=signup')}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {user ? 'Start New Application' : 'Get Started'}
              </Button>
            </CardContent>
          </Card>

          {/* Check & See Subscription - $9.99/month */}
          <Card className="relative shadow-elegant border border-primary/20 bg-card overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent"></div>
            <div className="absolute top-4 right-4">
              <Badge className="bg-primary/10 text-primary border-primary/30">
                <Sparkles className="h-3 w-3 mr-1" />
                7-Day Free Trial
              </Badge>
            </div>
            <CardHeader className="text-center pb-8 relative">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl text-foreground">Check & See</CardTitle>
              <CardDescription className="text-muted-foreground">
                Unlimited prior patent searches
              </CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-primary">{CHECK_AND_SEE_PRICE_DISPLAY}</span>
                <span className="text-base font-normal text-muted-foreground block mt-1">per month after trial</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 relative">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm text-foreground">Unlimited patent searches</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm text-foreground">AI-powered similarity analysis</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm text-foreground">USPTO & Google Patents search</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm text-foreground">Detailed overlap analysis</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm text-foreground">Search before you file</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm text-foreground">Cancel anytime</span>
                </div>
              </div>
              {isPremium ? (
                <Button 
                  variant="outline" 
                  className="w-full mt-6"
                  disabled
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Current Plan
                </Button>
              ) : (
                <Button 
                  variant="gradient"
                  className="w-full mt-6"
                  onClick={() => user ? navigate('/check') : navigate('/auth?tab=signup')}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Start Free Trial
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Features Comparison */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-center mb-8">Why PatentBot AI?</h3>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="text-center p-6 shadow-card border-0 bg-card/80 backdrop-blur-sm">
              <Bot className="h-12 w-12 text-primary mx-auto mb-4" />
              <h4 className="font-semibold mb-2">AI-Guided Drafting</h4>
              <p className="text-sm text-muted-foreground">
                Structured interview process that captures every technical detail of your invention
              </p>
            </Card>
            <Card className="text-center p-6 shadow-card border-0 bg-card/80 backdrop-blur-sm">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h4 className="font-semibold mb-2">USPTO Format</h4>
              <p className="text-sm text-muted-foreground">
                Documents formatted to USPTO specifications, ready for your attorney review
              </p>
            </Card>
            <Card className="text-center p-6 shadow-card border-0 bg-card/80 backdrop-blur-sm">
              <FileText className="h-12 w-12 text-primary mx-auto mb-4" />
              <h4 className="font-semibold mb-2">Prior Art Search</h4>
              <p className="text-sm text-muted-foreground">
                Search patent databases before you file to assess novelty and avoid conflicts
              </p>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        {!user && (
          <div className="text-center mt-12">
            <Card className="max-w-2xl mx-auto shadow-elegant border-0 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-8">
                <h3 className="text-xl font-semibold mb-4">
                  Ready to protect your innovation?
                </h3>
                <p className="text-muted-foreground mb-6">
                  Start with 3 free prior art searches. No credit card required.
                </p>
                <Button 
                  variant="gradient" 
                  size="lg"
                  onClick={() => navigate('/auth?tab=signup')}
                >
                  Create Free Account
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="py-8 border-t bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            © {getCurrentYear()} PatentBot AI™. Professional patent drafting with AI assistance.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;