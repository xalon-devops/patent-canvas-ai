import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { ArrowRight, Check, Sparkles, Shield, Zap, FileText, Search, Clock, DollarSign, Award, ChevronRight, HelpCircle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PageSEO } from '@/components/SEO';
import { getCurrentYear } from '@/lib/dateUtils';
import PublicHeader from '@/components/PublicHeader';
import { motion } from 'framer-motion';
import { 
  PATENT_APPLICATION_PRICE_DISPLAY, 
  CHECK_AND_SEE_PRICE_DISPLAY
} from '@/lib/pricingConstants';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 }
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 }
};

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

  const stats = [
    { value: '90%', label: 'Cost Savings' },
    { value: '24h', label: 'First Draft' },
    { value: '100%', label: 'USPTO Format' },
    { value: '∞', label: 'Revisions' }
  ];

  const steps = [
    {
      icon: FileText,
      number: '1',
      title: 'AI Interview',
      description: 'Our intelligent system conducts a thorough interview to understand your invention, extracting technical details and identifying novel aspects automatically.'
    },
    {
      icon: Search,
      number: '2',
      title: 'Prior Art Analysis',
      description: 'Comprehensive search across global patent databases to identify similar inventions and assess the novelty of your claims before drafting.'
    },
    {
      icon: Award,
      number: '3',
      title: 'Document Generation',
      description: 'Professional patent application with all required sections, properly formatted for USPTO submission. Download and file with confidence.'
    }
  ];

  const benefits = [
    {
      icon: Clock,
      title: 'Save Time',
      description: 'Complete your first draft in hours instead of weeks. Our AI interview captures technical details efficiently.'
    },
    {
      icon: DollarSign,
      title: 'Reduce Costs',
      description: 'A single flat fee for your entire application. No hourly billing, no surprise charges. Save up to 90%.'
    },
    {
      icon: Search,
      title: 'Stay Informed',
      description: 'Search prior art before you invest. Understand your competitive landscape and refine your claims.'
    }
  ];

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
          <motion.div 
            className="max-w-4xl mx-auto text-center"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* Badge */}
            <motion.div 
              className="inline-flex items-center gap-2 badge-outline mb-8"
              variants={fadeInUp}
              transition={{ duration: 0.5 }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI-Powered Patent Platform</span>
            </motion.div>
            
            {/* Headline */}
            <motion.h1 
              className="text-4xl sm:text-5xl lg:text-7xl font-bold text-foreground leading-[1.1] tracking-tight mb-6"
              variants={fadeInUp}
              transition={{ duration: 0.6 }}
            >
              Patent applications,{' '}
              <span className="text-gradient font-serif italic">reimagined</span>
            </motion.h1>
            
            {/* Subheadline */}
            <motion.p 
              className="text-lg sm:text-xl lg:text-2xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto"
              variants={fadeInUp}
              transition={{ duration: 0.6 }}
            >
              Generate USPTO-ready patent documents with AI-guided drafting. 
              Professional quality at a fraction of traditional costs.
            </motion.p>

            {/* CTA buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
              variants={fadeInUp}
              transition={{ duration: 0.6 }}
            >
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
            </motion.div>

            {/* Trust indicators */}
            <motion.div 
              className="flex flex-wrap justify-center gap-6 sm:gap-10 text-sm text-muted-foreground"
              variants={fadeInUp}
              transition={{ duration: 0.6 }}
            >
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
            </motion.div>
          </motion.div>
        </div>

        {/* Gradient fade to next section */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Stats Section */}
      <section className="relative -mt-16 z-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <motion.div 
            className="glass-strong rounded-3xl p-8 sm:p-12 grid grid-cols-2 md:grid-cols-4 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {stats.map((stat, index) => (
              <motion.div 
                key={index}
                className="stat-card"
                variants={scaleIn}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section-spacing relative">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          {/* Section header */}
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-20"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <p className="badge-outline mb-4">How It Works</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-6">
              From idea to filing in <span className="text-gradient">three steps</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              A streamlined approach to patent documentation that ensures comprehensive coverage and professional quality.
            </p>
          </motion.div>

          {/* Steps - Cards with icons */}
          <motion.div 
            className="grid lg:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
          >
            {steps.map((step, index) => (
              <motion.div 
                key={index}
                className="feature-card group"
                variants={fadeInUp}
                transition={{ duration: 0.5, delay: index * 0.15 }}
              >
                <div className="feature-icon">
                  <step.icon />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold text-primary bg-primary/10 rounded-full w-6 h-6 flex items-center justify-center">{step.number}</span>
                  <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="section-spacing relative bg-muted/30">
        {/* Background pattern */}
        <div className="absolute inset-0 grid-pattern opacity-50" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8">
          {/* Section header */}
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-20"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <p className="badge-outline mb-4">Pricing</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-6">
              Transparent, <span className="text-gradient">simple pricing</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              No hidden fees. No hourly billing. Clear value for your investment.
            </p>
          </motion.div>

          {/* Pricing cards */}
          <motion.div 
            className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
          >
            {/* Patent Application - Featured */}
            <motion.div 
              className="relative group"
              variants={fadeInUp}
              transition={{ duration: 0.6 }}
            >
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
            </motion.div>

            {/* Check & See */}
            <motion.div 
              className="bg-card rounded-3xl p-8 sm:p-10 border border-border/60 h-full card-hover"
              variants={fadeInUp}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
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
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Comparison Table Section */}
      <section className="section-spacing-sm relative">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <p className="badge-outline mb-4">Compare</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-4">
              PatentBot vs <span className="text-gradient">Traditional Firms</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              See how much you can save in time and money.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="overflow-hidden rounded-3xl border border-border/60 bg-card"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left p-6 text-muted-foreground font-medium text-sm uppercase tracking-wider">Feature</th>
                    <th className="p-6 text-center">
                      <div className="inline-flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-foreground">PatentBot</span>
                      </div>
                    </th>
                    <th className="p-6 text-center">
                      <div className="inline-flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                          <Award className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <span className="font-medium text-muted-foreground">Traditional Firm</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/40">
                    <td className="p-6 font-medium text-foreground">Patent Application Cost</td>
                    <td className="p-6 text-center">
                      <span className="text-2xl font-bold text-gradient">$1,000</span>
                      <span className="block text-xs text-muted-foreground mt-1">flat fee</span>
                    </td>
                    <td className="p-6 text-center">
                      <span className="text-2xl font-bold text-muted-foreground">$8,000–$15,000+</span>
                      <span className="block text-xs text-muted-foreground mt-1">hourly billing</span>
                    </td>
                  </tr>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <td className="p-6 font-medium text-foreground">Time to First Draft</td>
                    <td className="p-6 text-center">
                      <span className="text-2xl font-bold text-gradient">24 hours</span>
                    </td>
                    <td className="p-6 text-center">
                      <span className="text-2xl font-bold text-muted-foreground">2–4 weeks</span>
                    </td>
                  </tr>
                  <tr className="border-b border-border/40">
                    <td className="p-6 font-medium text-foreground">Prior Art Search</td>
                    <td className="p-6 text-center">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-semibold text-foreground">Included</span>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <span className="text-muted-foreground">$1,500–$3,000 extra</span>
                    </td>
                  </tr>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <td className="p-6 font-medium text-foreground">Revisions</td>
                    <td className="p-6 text-center">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-semibold text-foreground">Unlimited</span>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <span className="text-muted-foreground">$200–$500/hour</span>
                    </td>
                  </tr>
                  <tr className="border-b border-border/40">
                    <td className="p-6 font-medium text-foreground">USPTO-Ready Format</td>
                    <td className="p-6 text-center">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center mx-auto">
                        <Check className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </td>
                  </tr>
                  <tr className="bg-muted/20">
                    <td className="p-6 font-medium text-foreground">24/7 Availability</td>
                    <td className="p-6 text-center">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      <span className="text-muted-foreground text-sm">Business hours only</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bottom CTA */}
            <div className="p-6 bg-gradient-to-r from-primary/5 to-accent/5 border-t border-border/40 text-center">
              <p className="text-muted-foreground mb-4">
                Save up to <span className="font-bold text-foreground">90%</span> compared to traditional patent firms
              </p>
              <Button 
                className="btn-gradient"
                onClick={() => handleAuthNav('signup')}
              >
                {user ? 'Go to Dashboard' : 'Get Started Now'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why PatentBot - Features */}
      <section className="section-spacing relative">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          {/* Section header */}
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-20"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 badge-outline mb-4">
              <span>Why</span>
              <img 
                src="https://i.ibb.co/nsLWZ3sr/Patent-Bot-Logo-1.png" 
                alt="PatentBot" 
                className="h-5 w-auto"
              />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-6">
              Built for <span className="text-gradient">inventors</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Everything you need to protect your intellectual property, without the complexity.
            </p>
          </motion.div>

          {/* Benefits grid */}
          <motion.div 
            className="grid md:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
          >
            {benefits.map((benefit, index) => (
              <motion.div 
                key={index}
                className="feature-card"
                variants={fadeInUp}
                transition={{ duration: 0.5, delay: index * 0.15 }}
              >
                <div className="feature-icon">
                  <benefit.icon />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{benefit.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="section-spacing relative bg-muted/20">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          {/* Section header */}
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <p className="badge-outline mb-4">
              <HelpCircle className="w-3.5 h-3.5 mr-1" />
              FAQ
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-6">
              Frequently asked <span className="text-gradient">questions</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Everything you need to know about our patent application process.
            </p>
          </motion.div>

          {/* FAQ Accordion */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <Accordion type="single" collapsible className="space-y-4">
              <AccordionItem value="item-1" className="bg-card border border-border/60 rounded-2xl px-6 data-[state=open]:shadow-lg transition-shadow">
                <AccordionTrigger className="text-left text-foreground font-semibold hover:no-underline py-6">
                  What types of patents can PatentBot help with?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">
                  PatentBot specializes in utility patents, which cover new and useful processes, machines, manufactures, and compositions of matter. This includes software patents, mechanical inventions, chemical compositions, and business methods. We currently focus on provisional and non-provisional utility patent applications for the USPTO.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="bg-card border border-border/60 rounded-2xl px-6 data-[state=open]:shadow-lg transition-shadow">
                <AccordionTrigger className="text-left text-foreground font-semibold hover:no-underline py-6">
                  How long does it take to generate a patent application?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">
                  Most patent applications are generated within 24-48 hours after completing the AI interview process. The interview itself typically takes 30-60 minutes depending on the complexity of your invention. You can complete it in multiple sessions if needed.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="bg-card border border-border/60 rounded-2xl px-6 data-[state=open]:shadow-lg transition-shadow">
                <AccordionTrigger className="text-left text-foreground font-semibold hover:no-underline py-6">
                  Do I still need a patent attorney?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">
                  While PatentBot generates professional-quality patent applications, we recommend having a registered patent attorney or agent review your application before filing, especially for complex inventions or if you're new to the patent process. Our output is designed to give attorneys a strong starting point, potentially reducing their billable hours significantly.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="bg-card border border-border/60 rounded-2xl px-6 data-[state=open]:shadow-lg transition-shadow">
                <AccordionTrigger className="text-left text-foreground font-semibold hover:no-underline py-6">
                  What is included in the prior art search?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">
                  Our prior art search covers the USPTO database, EPO (European Patent Office), WIPO (World Intellectual Property Organization), and major international patent databases. We use AI-powered semantic search to identify similar inventions, analyze claim overlap, and provide a novelty assessment with similarity scores for each result.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5" className="bg-card border border-border/60 rounded-2xl px-6 data-[state=open]:shadow-lg transition-shadow">
                <AccordionTrigger className="text-left text-foreground font-semibold hover:no-underline py-6">
                  Is my invention idea kept confidential?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">
                  Absolutely. Your invention details are encrypted and stored securely. We never share your information with third parties, and our systems are designed with attorney-client privilege standards in mind. All data is stored on SOC 2 compliant infrastructure and you can delete your data at any time.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6" className="bg-card border border-border/60 rounded-2xl px-6 data-[state=open]:shadow-lg transition-shadow">
                <AccordionTrigger className="text-left text-foreground font-semibold hover:no-underline py-6">
                  What format will my patent application be in?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">
                  Your patent application is generated in USPTO-compliant format and can be downloaded as both DOCX and PDF files. The document includes all required sections: title, abstract, background, summary, detailed description, claims, and drawing descriptions. The formatting follows USPTO guidelines so you can file directly or share with your attorney.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7" className="bg-card border border-border/60 rounded-2xl px-6 data-[state=open]:shadow-lg transition-shadow">
                <AccordionTrigger className="text-left text-foreground font-semibold hover:no-underline py-6">
                  Can I make revisions after the draft is generated?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6 leading-relaxed">
                  Yes! Unlimited revisions are included with every patent application. You can edit any section directly in our editor, request AI-powered enhancements, or regenerate specific sections based on new information. Your application is never "locked" — iterate as much as you need before filing.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-spacing relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-background" />
        <div className="orb orb-primary w-[500px] h-[500px] top-0 left-1/2 -translate-x-1/2 pulse-glow" />
        
        <motion.div 
          className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          transition={{ duration: 0.6 }}
        >
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
        </motion.div>
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