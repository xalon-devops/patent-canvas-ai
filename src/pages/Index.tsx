import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { ArrowRight, Check, Sparkles, Shield, Zap, FileText, Search, Clock, DollarSign, Award, ChevronRight } from 'lucide-react';
import { PageSEO } from '@/components/SEO';
import { getCurrentYear } from '@/lib/dateUtils';
import PublicHeader from '@/components/PublicHeader';
import { 
  PATENT_APPLICATION_PRICE_DISPLAY, 
  CHECK_AND_SEE_PRICE_DISPLAY
} from '@/lib/pricingConstants';

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthNav = (defaultTab: 'signin' | 'signup' = 'signup') => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate(`/auth?tab=${defaultTab}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <PageSEO.Home />
      <PublicHeader />
      
      {/* Hero Section - Premium with depth */}
      <section className="relative hero-gradient overflow-hidden">
        {/* Background orbs for depth */}
        <div className="orb orb-primary w-[600px] h-[600px] -top-40 -right-40 float" />
        <div className="orb orb-accent w-[500px] h-[500px] top-1/2 -left-60 float" style={{ animationDelay: '-2s' }} />
        <div className="orb orb-success w-[400px] h-[400px] bottom-0 right-1/4 float" style={{ animationDelay: '-4s' }} />
        
        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pt-20 pb-32 sm:pt-28 sm:pb-40 lg:pt-36 lg:pb-48">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 badge-outline mb-8 fade-in">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI-Powered Patent Platform</span>
            </div>
            
            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-foreground leading-[1.1] tracking-tight mb-6 slide-up">
              Patent applications,{' '}
              <span className="text-gradient font-serif italic">reimagined</span>
            </h1>
            
            {/* Subheadline */}
            <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto slide-up" style={{ animationDelay: '0.1s' }}>
              Generate USPTO-ready patent documents with AI-guided drafting. 
              Professional quality at a fraction of traditional costs.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 slide-up" style={{ animationDelay: '0.2s' }}>
              <Button 
                size="lg"
                className="btn-gradient group text-base px-8 py-6 h-auto"
                onClick={() => handleAuthNav('signup')}
              >
                {user ? 'Go to Dashboard' : 'Start Your Application'}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="glass border-border/50 text-base px-8 py-6 h-auto hover:bg-card/80"
                onClick={() => navigate('/demo')}
              >
                View Demo
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center gap-6 sm:gap-10 text-sm text-muted-foreground slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span>USPTO-compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" />
                <span>Prior art included</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span>Hours, not weeks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gradient fade to next section */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Stats Section */}
      <section className="relative -mt-16 z-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="glass-strong rounded-3xl p-8 sm:p-12 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="stat-card">
              <div className="stat-value">90%</div>
              <div className="stat-label">Cost Savings</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">24h</div>
              <div className="stat-label">First Draft</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">100%</div>
              <div className="stat-label">USPTO Format</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">∞</div>
              <div className="stat-label">Revisions</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section-spacing relative">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          {/* Section header */}
          <div className="text-center max-w-3xl mx-auto mb-20">
            <p className="badge-outline mb-4">How It Works</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-6">
              From idea to filing in <span className="text-gradient">three steps</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              A streamlined approach to patent documentation that ensures comprehensive coverage and professional quality.
            </p>
          </div>

          {/* Steps - Cards with icons */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="feature-card group">
              <div className="feature-icon">
                <FileText />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-bold text-primary bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center">1</span>
                <h3 className="text-xl font-semibold text-foreground">AI Interview</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Our intelligent system conducts a thorough interview to understand your invention, 
                extracting technical details and identifying novel aspects automatically.
              </p>
            </div>

            {/* Step 2 */}
            <div className="feature-card group">
              <div className="feature-icon">
                <Search />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-bold text-primary bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center">2</span>
                <h3 className="text-xl font-semibold text-foreground">Prior Art Analysis</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Comprehensive search across global patent databases to identify similar inventions 
                and assess the novelty of your claims before drafting.
              </p>
            </div>

            {/* Step 3 */}
            <div className="feature-card group">
              <div className="feature-icon">
                <Award />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-bold text-primary bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center">3</span>
                <h3 className="text-xl font-semibold text-foreground">Document Generation</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Professional patent application with all required sections, properly formatted 
                for USPTO submission. Download and file with confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="section-spacing relative bg-muted/30">
        {/* Background pattern */}
        <div className="absolute inset-0 grid-pattern opacity-50" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8">
          {/* Section header */}
          <div className="text-center max-w-3xl mx-auto mb-20">
            <p className="badge-outline mb-4">Pricing</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-6">
              Transparent, <span className="text-gradient">simple pricing</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              No hidden fees. No hourly billing. Clear value for your investment.
            </p>
          </div>

          {/* Pricing cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Patent Application - Featured */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-500" />
              <div className="relative bg-card rounded-3xl p-8 sm:p-10 border border-primary/20 h-full">
                {/* Popular badge */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="badge-premium">Most Popular</span>
                </div>
                
                <div className="mb-8 pt-2">
                  <h3 className="text-2xl font-bold text-foreground mb-2">Patent Application</h3>
                  <p className="text-muted-foreground">
                    Complete AI-guided patent drafting
                  </p>
                </div>
                
                <div className="mb-8">
                  <span className="text-5xl font-bold text-foreground">{PATENT_APPLICATION_PRICE_DISPLAY}</span>
                  <span className="text-muted-foreground ml-2">one-time</span>
                </div>

                <ul className="space-y-4 mb-10">
                  {[
                    'AI-guided interview process',
                    'Comprehensive prior art search',
                    'Full patent draft (all sections)',
                    'DOCX/PDF export for filing',
                    'Unlimited revisions'
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-foreground">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  className="w-full btn-gradient h-12 text-base" 
                  onClick={() => handleAuthNav('signup')}
                >
                  {user ? 'Go to Dashboard' : 'Get Started'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Check & See */}
            <div className="bg-card rounded-3xl p-8 sm:p-10 border border-border/60 h-full card-hover">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-2">Check & See</h3>
                <p className="text-muted-foreground">
                  Prior art search subscription
                </p>
              </div>
              
              <div className="mb-8">
                <span className="text-5xl font-bold text-foreground">{CHECK_AND_SEE_PRICE_DISPLAY}</span>
                <span className="text-muted-foreground ml-2">/month</span>
              </div>

              <ul className="space-y-4 mb-10">
                {[
                  'Unlimited patent searches',
                  'Similarity analysis reports',
                  'Global patent database access',
                  'AI-powered novelty assessment',
                  'Cancel anytime'
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-muted-foreground">
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                variant="outline"
                className="w-full h-12 text-base border-border/60 hover:bg-muted/50" 
                onClick={() => handleAuthNav('signup')}
              >
                {user ? 'Go to Dashboard' : 'Start Searching'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Why PatentBot - Features */}
      <section className="section-spacing relative">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          {/* Section header */}
          <div className="text-center max-w-3xl mx-auto mb-20">
            <p className="badge-outline mb-4">Why PatentBot</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-6">
              Built for <span className="text-gradient">inventors</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Everything you need to protect your intellectual property, without the complexity.
            </p>
          </div>

          {/* Benefits grid */}
          <div className="grid md:grid-cols-3 gap-8">
            <div className="feature-card">
              <div className="feature-icon">
                <Clock />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Save Time</h3>
              <p className="text-muted-foreground leading-relaxed">
                Complete your first draft in hours instead of weeks. Our AI interview captures technical details efficiently.
              </p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <DollarSign />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Reduce Costs</h3>
              <p className="text-muted-foreground leading-relaxed">
                A single flat fee for your entire application. No hourly billing, no surprise charges. Save up to 90%.
              </p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">
                <Search />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Stay Informed</h3>
              <p className="text-muted-foreground leading-relaxed">
                Search prior art before you invest. Understand your competitive landscape and refine your claims.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-spacing relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-background" />
        <div className="orb orb-primary w-[500px] h-[500px] top-0 left-1/2 -translate-x-1/2 pulse-glow" />
        
        <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-6">
            Ready to protect your invention?
          </h2>
          <p className="text-muted-foreground text-lg sm:text-xl mb-10 max-w-2xl mx-auto">
            Create a free account to explore. 3 prior art searches included at no cost.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              className="btn-gradient group text-base px-8 py-6 h-auto"
              onClick={() => handleAuthNav('signup')}
            >
              {user ? 'Go to Dashboard' : 'Create Free Account'}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button 
              variant="ghost"
              className="text-muted-foreground hover:text-foreground text-base px-8 py-6 h-auto group"
              onClick={() => navigate('/pricing')}
            >
              View Pricing
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/30 bg-card/30">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-foreground">PatentBot AI</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {getCurrentYear()} PatentBot AI. All rights reserved.
            </p>
            <div className="flex gap-8 text-sm">
              <span className="link-subtle cursor-pointer" onClick={() => navigate('/demo')}>Demo</span>
              <span className="link-subtle cursor-pointer" onClick={() => navigate('/pricing')}>Pricing</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;