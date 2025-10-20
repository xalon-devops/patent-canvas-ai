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
  Sparkles
} from 'lucide-react';

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
      navigate('/auth');
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
          priceId: 'price_1QV6gYFNwHcT0mL0YhCz5aBJ', // Replace with your actual Stripe price ID
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
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-primary rounded-lg blur-lg opacity-20"></div>
                  <div className="relative rounded-lg p-2">
                    <img 
                      src="https://i.ibb.co/wrhwtf5P/Patent-Bot-AI-Logo-Transparent.png" 
                      alt="PatentBot AI Logo" 
                      className="h-8 w-auto"
                    />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                    PatentBot AI™ Pricing
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Choose the plan that's right for you
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

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
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Plan */}
          <Card className="relative shadow-card border-0 bg-card/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-8">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle className="text-2xl">Free Trial</CardTitle>
              <CardDescription>
                Get started with basic patent tools
              </CardDescription>
              <div className="text-3xl font-bold mt-4">
                $0
                <span className="text-base font-normal text-muted-foreground">/forever</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">1 patent application</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Basic AI assistance</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Standard templates</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Email support</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full mt-6"
                disabled={!user}
                onClick={() => navigate('/dashboard')}
              >
                Current Plan
              </Button>
            </CardContent>
          </Card>

          {/* Premium Plan */}
          <Card className="relative shadow-elegant border-0 bg-gradient-primary text-primary-foreground overflow-hidden">
            <div className="absolute inset-0 bg-gradient-glow opacity-10"></div>
            <div className="absolute top-4 right-4">
              <Badge className="bg-white/20 text-white border-white/30">
                <Crown className="h-3 w-3 mr-1" />
                Recommended
              </Badge>
            </div>
            <CardHeader className="text-center pb-8 relative">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">Premium</CardTitle>
              <CardDescription className="text-primary-foreground/80">
                Professional patent applications with AI
              </CardDescription>
              <div className="text-3xl font-bold mt-4 text-white">
                $49
                <span className="text-base font-normal text-primary-foreground/80">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 relative">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-white" />
                  <span className="text-sm text-white">Unlimited patent applications</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-white" />
                  <span className="text-sm text-white">Advanced AI (GPT-4o)</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-white" />
                  <span className="text-sm text-white">USPTO-compliant formatting</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-white" />
                  <span className="text-sm text-white">Prior art search (Lens.org API)</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-white" />
                  <span className="text-sm text-white">DOCX & PDF exports</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-white" />
                  <span className="text-sm text-white">Legal-grade claims drafting</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-white" />
                  <span className="text-sm text-white">Priority support</span>
                </div>
              </div>
              {isPremium ? (
                <Button 
                  variant="secondary" 
                  className="w-full mt-6 bg-white/20 text-white border-white/30 hover:bg-white/30"
                  disabled
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Current Plan
                </Button>
              ) : (
                <Button 
                  variant="secondary" 
                  className="w-full mt-6 bg-white/20 text-white border-white/30 hover:bg-white/30 hover:shadow-glow transition-smooth"
                  onClick={handleUpgrade}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Upgrade to Premium
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Features Comparison */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-center mb-8">Why Choose Premium?</h3>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="text-center p-6 shadow-card border-0 bg-card/80 backdrop-blur-sm">
              <Bot className="h-12 w-12 text-primary mx-auto mb-4" />
              <h4 className="font-semibold mb-2">Advanced AI</h4>
              <p className="text-sm text-muted-foreground">
                GPT-4o powered patent drafting with legal expertise and USPTO compliance
              </p>
            </Card>
            <Card className="text-center p-6 shadow-card border-0 bg-card/80 backdrop-blur-sm">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h4 className="font-semibold mb-2">Legal Quality</h4>
              <p className="text-sm text-muted-foreground">
                Professional-grade patent applications that meet legal standards
              </p>
            </Card>
            <Card className="text-center p-6 shadow-card border-0 bg-card/80 backdrop-blur-sm">
              <FileText className="h-12 w-12 text-primary mx-auto mb-4" />
              <h4 className="font-semibold mb-2">Complete Process</h4>
              <p className="text-sm text-muted-foreground">
                From idea to filed patent with prior art search and export tools
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
                  Join thousands of inventors who trust PatentBot AI™ for their patent applications.
                </p>
                <Button 
                  variant="gradient" 
                  size="lg"
                  onClick={() => navigate('/auth')}
                >
                  Get Started Free
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Pricing;