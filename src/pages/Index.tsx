import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { ArrowRight, Check } from 'lucide-react';
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
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageSEO.Home />
      <PublicHeader />
      
      {/* Hero Section - Editorial, confident */}
      <section className="section-spacing">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="max-w-3xl">
            {/* Eyebrow */}
            <p className="text-muted-foreground text-sm mb-6 tracking-wide uppercase">
              Patent Application Platform
            </p>
            
            {/* Headline - Large, confident */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-medium text-foreground leading-[1.1] tracking-tight mb-6">
              Patent applications,{' '}
              <span className="font-serif text-foreground/80">reimagined</span>
            </h1>
            
            {/* Subheadline - Clear value */}
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl">
              Generate USPTO-ready patent documents with AI-guided drafting. 
              Professional quality at a fraction of traditional costs.
            </p>

            {/* CTA - Clean, confident */}
            <div className="flex flex-col sm:flex-row gap-4 mb-16">
              <Button 
                size="lg"
                onClick={() => handleAuthNav('signup')}
                className="group"
              >
                {user ? 'Go to Dashboard' : 'Start Application'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate('/demo')}
              >
                View Demo
              </Button>
            </div>

            {/* Trust indicators - Minimal */}
            <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <span>USPTO-compliant formatting</span>
              <span>Prior art analysis included</span>
              <span>Secure & confidential</span>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="divider" />
      </div>

      {/* How It Works - Chapter-like sections */}
      <section className="section-spacing">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          {/* Section header */}
          <div className="max-w-2xl mb-16">
            <p className="text-muted-foreground text-sm mb-4 tracking-wide uppercase">
              Process
            </p>
            <h2 className="text-3xl sm:text-4xl font-medium text-foreground tracking-tight mb-4">
              From idea to filing
            </h2>
            <p className="text-muted-foreground text-lg">
              A structured approach to patent documentation that ensures comprehensive coverage.
            </p>
          </div>

          {/* Steps - Editorial layout */}
          <div className="grid lg:grid-cols-3 gap-12 lg:gap-8">
            {/* Step 1 */}
            <div className="space-y-4">
              <div className="text-muted-foreground/50 text-sm font-medium">01</div>
              <h3 className="text-xl font-medium text-foreground">AI Interview</h3>
              <p className="text-muted-foreground leading-relaxed">
                Our system conducts a thorough interview to understand your invention, 
                extracting technical details and identifying novel aspects.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-4">
              <div className="text-muted-foreground/50 text-sm font-medium">02</div>
              <h3 className="text-xl font-medium text-foreground">Prior Art Analysis</h3>
              <p className="text-muted-foreground leading-relaxed">
                Comprehensive search across patent databases to identify similar inventions 
                and assess the novelty of your claims.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-4">
              <div className="text-muted-foreground/50 text-sm font-medium">03</div>
              <h3 className="text-xl font-medium text-foreground">Document Generation</h3>
              <p className="text-muted-foreground leading-relaxed">
                Professional patent application with all required sections, formatted 
                for USPTO submission. Ready for filing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="divider" />
      </div>

      {/* Pricing Section - Clean, transparent */}
      <section className="section-spacing">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          {/* Section header */}
          <div className="max-w-2xl mb-16">
            <p className="text-muted-foreground text-sm mb-4 tracking-wide uppercase">
              Pricing
            </p>
            <h2 className="text-3xl sm:text-4xl font-medium text-foreground tracking-tight mb-4">
              Transparent pricing
            </h2>
            <p className="text-muted-foreground text-lg">
              No hidden fees. No hourly billing. Clear value for your investment.
            </p>
          </div>

          {/* Pricing cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl">
            {/* Patent Application */}
            <div className="p-8 rounded-xl border border-border bg-card/50">
              <div className="mb-6">
                <h3 className="text-lg font-medium text-foreground mb-2">Patent Application</h3>
                <p className="text-muted-foreground text-sm">
                  Complete AI-guided patent drafting
                </p>
              </div>
              
              <div className="mb-8">
                <span className="text-4xl font-medium text-foreground">{PATENT_APPLICATION_PRICE_DISPLAY}</span>
                <span className="text-muted-foreground ml-2">one-time</span>
              </div>

              <ul className="space-y-3 mb-8">
                {[
                  'AI-guided interview process',
                  'Comprehensive prior art search',
                  'Full patent draft (all sections)',
                  'DOCX/PDF export for filing',
                  'Unlimited revisions'
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-muted-foreground text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full" 
                size="lg"
                onClick={() => handleAuthNav('signup')}
              >
                {user ? 'Go to Dashboard' : 'Get Started'}
              </Button>
            </div>

            {/* Check & See */}
            <div className="p-8 rounded-xl border border-border/50 bg-background">
              <div className="mb-6">
                <h3 className="text-lg font-medium text-foreground mb-2">Check & See</h3>
                <p className="text-muted-foreground text-sm">
                  Prior art search subscription
                </p>
              </div>
              
              <div className="mb-8">
                <span className="text-4xl font-medium text-foreground">{CHECK_AND_SEE_PRICE_DISPLAY}</span>
                <span className="text-muted-foreground ml-2">/month</span>
              </div>

              <ul className="space-y-3 mb-8">
                {[
                  'Unlimited patent searches',
                  'Similarity analysis reports',
                  'Global patent database access',
                  'AI-powered novelty assessment',
                  'Cancel anytime'
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-muted-foreground text-sm">
                    <Check className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                variant="outline"
                className="w-full" 
                size="lg"
                onClick={() => handleAuthNav('signup')}
              >
                {user ? 'Go to Dashboard' : 'Start Searching'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="divider" />
      </div>

      {/* Testimonials - Minimal, credible */}
      <section className="section-spacing">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          {/* Section header */}
          <div className="max-w-2xl mb-16">
            <p className="text-muted-foreground text-sm mb-4 tracking-wide uppercase">
              Testimonials
            </p>
            <h2 className="text-3xl sm:text-4xl font-medium text-foreground tracking-tight">
              Trusted by inventors
            </h2>
          </div>

          {/* Testimonials grid */}
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote: "PatentBot AI cut my patent drafting time by 80%. The AI interview process really helped me articulate my invention clearly.",
                name: "Sarah M.",
                title: "Software Engineer"
              },
              {
                quote: "The prior art search saved me from filing a patent that already existed. Worth every penny for the Check & See subscription.",
                name: "David K.",
                title: "Startup Founder"
              },
              {
                quote: "Professional quality drafts at a fraction of the cost. My patent attorney was impressed with the thoroughness.",
                name: "Jennifer L.",
                title: "Medical Device Inventor"
              }
            ].map((testimonial, i) => (
              <div key={i} className="space-y-6">
                <p className="text-foreground/80 leading-relaxed">
                  "{testimonial.quote}"
                </p>
                <div>
                  <div className="font-medium text-foreground text-sm">{testimonial.name}</div>
                  <div className="text-muted-foreground text-sm">{testimonial.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Confident, not aggressive */}
      <section className="section-spacing bg-card/30">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-medium text-foreground tracking-tight mb-4">
            Ready to protect your innovation?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            Join inventors using AI to create professional patent applications.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              onClick={() => handleAuthNav('signup')}
              className="group"
            >
              {user ? 'Go to Dashboard' : 'Get Started'}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer - Clean, minimal */}
      <footer className="py-8 border-t border-border/30">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {getCurrentYear()} PatentBot AI
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
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