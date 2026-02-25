import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { ArrowRight, Check, Sparkles, Shield, Zap, FileText, Search, Clock, DollarSign, Award, ChevronRight, HelpCircle, Lock, Eye, Scale } from 'lucide-react';
import RotatingText from '@/components/RotatingText';
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
    { value: '90%', label: 'Lower Cost vs Attorneys' },
    { value: '<48h', label: 'First Draft Ready' },
    { value: '7', label: 'USPTO Sections Generated' },
    { value: '∞', label: 'Revisions Included' }
  ];

  const steps = [
    {
      icon: FileText,
      number: '1',
      title: 'Describe Your Invention',
      description: 'Our AI conducts a structured technical interview — extracting novel aspects, prior art differentiators, and claim-worthy features from your description.'
    },
    {
      icon: Search,
      number: '2',
      title: 'Automated Prior Art Search',
      description: 'Semantic search across USPTO, EPO, and WIPO databases identifies overlapping patents and scores novelty before drafting begins.'
    },
    {
      icon: Award,
      number: '3',
      title: 'Export USPTO-Formatted Draft',
      description: 'All 7 sections (Abstract, Claims, Description, Drawings, etc.) generated as a professional DOCX you can file directly or hand to your attorney.'
    }
  ];

  const benefits = [
    {
      icon: Clock,
      title: 'Draft in Hours, Not Weeks',
      description: 'Complete your first patent draft in under 48 hours. Our AI interview captures technical details efficiently — no scheduling, no waiting.'
    },
    {
      icon: DollarSign,
      title: '$1,000 Flat Fee — No Surprises',
      description: 'One price for the entire application. No hourly billing, no retainers. Traditional firms charge $8K–$15K for the same output.'
    },
    {
      icon: Search,
      title: 'Know Before You File',
      description: 'Run unlimited prior art searches ($9.99/mo) to understand your competitive landscape and strengthen your claims before committing.'
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
        
        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pt-32 pb-32 sm:pt-40 sm:pb-40 lg:pt-48 lg:pb-48">
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
              <span>Pro Se Patent Drafting Assistant</span>
            </motion.div>
            
            {/* Headline */}
            <motion.h1 
              className="text-4xl sm:text-5xl lg:text-7xl font-bold text-foreground leading-[1.1] tracking-tight mb-6"
              variants={fadeInUp}
              transition={{ duration: 0.6 }}
            >
              The Smarter Way to{' '}
              <br className="hidden sm:block" />
              <RotatingText
                words={['File Patents', 'Draft Claims', 'Search Prior Art', 'Protect Ideas']}
                interval={2800}
              />
            </motion.h1>
            
            {/* Subheadline */}
            <motion.p 
              className="text-lg sm:text-xl lg:text-2xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto"
              variants={fadeInUp}
              transition={{ duration: 0.6 }}
            >
              AI-assisted drafting tool that generates all 7 USPTO sections — Abstract, Claims, Description & more — for a $1,000 flat fee.
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
                {user ? 'Go to Dashboard' : 'Start Free Invention Interview'}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="glass border-border/50 text-base px-8 py-6 h-auto hover:bg-card/80"
                onClick={() => navigate('/check')}
              >
                <Search className="h-4 w-4" />
                Run 3 Free Prior Art Searches
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
                <span>USPTO-formatted output</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                <span>AES-256 encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-primary" />
                <span>Pro se drafting tool</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span>Draft in &lt;48 hours</span>
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
      <section className="section-spacing-sm relative overflow-hidden">
        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8">
          {/* Section header */}
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-12 sm:mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <p className="badge-outline mb-4">Process</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight mb-4">
              From invention to <span className="text-gradient">filed draft</span> in three steps
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              A structured approach that mirrors how patent attorneys work — at a fraction of the cost.
            </p>
          </motion.div>

          {/* Steps - Clean horizontal layout */}
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
          >
            {steps.map((step, index) => (
              <motion.div 
                key={index}
                className="relative"
                variants={fadeInUp}
                transition={{ duration: 0.5, delay: index * 0.15 }}
              >
                <div className="feature-card h-full !p-6">
                  {/* Step number + Icon row */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {step.number}
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <step.icon className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                  
                  {/* Description */}
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="section-spacing relative bg-muted/30">
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
                  {user ? 'Go to Dashboard' : 'Start Invention Interview'}
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
                {user ? 'Go to Dashboard' : 'Run Free Prior Art Search'}
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
            className="overflow-hidden rounded-2xl border border-border/60 bg-card"
          >
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left p-2.5 sm:p-4 text-muted-foreground font-medium uppercase tracking-wider text-[10px] sm:text-xs">Feature</th>
                  <th className="p-2.5 sm:p-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                      </div>
                      <span className="font-bold text-foreground text-[10px] sm:text-xs">PatentBot</span>
                    </div>
                  </th>
                  <th className="p-2.5 sm:p-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-muted flex items-center justify-center">
                        <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                      </div>
                      <span className="font-medium text-muted-foreground text-[10px] sm:text-xs">Traditional</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/40">
                  <td className="p-2.5 sm:p-4 font-medium text-foreground">Cost</td>
                  <td className="p-2.5 sm:p-4 text-center">
                    <span className="text-base sm:text-xl font-bold text-gradient">$1,000</span>
                    <span className="block text-[9px] sm:text-xs text-muted-foreground">flat fee</span>
                  </td>
                  <td className="p-2.5 sm:p-4 text-center">
                    <span className="text-base sm:text-xl font-bold text-muted-foreground">$8K–$15K+</span>
                    <span className="block text-[9px] sm:text-xs text-muted-foreground">hourly</span>
                  </td>
                </tr>
                <tr className="border-b border-border/40 bg-muted/20">
                  <td className="p-2.5 sm:p-4 font-medium text-foreground">First Draft</td>
                  <td className="p-2.5 sm:p-4 text-center">
                    <span className="text-base sm:text-xl font-bold text-gradient">24h</span>
                  </td>
                  <td className="p-2.5 sm:p-4 text-center">
                    <span className="text-base sm:text-xl font-bold text-muted-foreground">2–4 wks</span>
                  </td>
                </tr>
                <tr className="border-b border-border/40">
                  <td className="p-2.5 sm:p-4 font-medium text-foreground">Prior Art</td>
                  <td className="p-2.5 sm:p-4 text-center">
                    <div className="inline-flex items-center gap-1">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                      <span className="font-semibold text-foreground">Included</span>
                    </div>
                  </td>
                  <td className="p-2.5 sm:p-4 text-center text-muted-foreground">$1.5K–$3K extra</td>
                </tr>
                <tr className="border-b border-border/40 bg-muted/20">
                  <td className="p-2.5 sm:p-4 font-medium text-foreground">Revisions</td>
                  <td className="p-2.5 sm:p-4 text-center">
                    <div className="inline-flex items-center gap-1">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                      <span className="font-semibold text-foreground">Unlimited</span>
                    </div>
                  </td>
                  <td className="p-2.5 sm:p-4 text-center text-muted-foreground">$200–$500/hr</td>
                </tr>
                <tr className="border-b border-border/40">
                  <td className="p-2.5 sm:p-4 font-medium text-foreground">USPTO Format</td>
                  <td className="p-2.5 sm:p-4 text-center">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                  </td>
                  <td className="p-2.5 sm:p-4 text-center">
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <Check className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </td>
                </tr>
                <tr className="bg-muted/20">
                  <td className="p-2.5 sm:p-4 font-medium text-foreground">24/7 Access</td>
                  <td className="p-2.5 sm:p-4 text-center">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                  </td>
                  <td className="p-2.5 sm:p-4 text-center text-muted-foreground text-[10px] sm:text-xs">Business hrs</td>
                </tr>
              </tbody>
            </table>

            {/* Bottom CTA */}
            <div className="p-6 bg-gradient-to-r from-primary/5 to-accent/5 border-t border-border/40 text-center">
              <p className="text-muted-foreground mb-4">
                Save up to <span className="font-bold text-foreground">90%</span> compared to traditional patent firms
              </p>
              <Button 
                className="btn-gradient"
                onClick={() => handleAuthNav('signup')}
              >
                {user ? 'Go to Dashboard' : 'Start Drafting — $1,000'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why PatentBot - Features */}
      <section id="features" className="section-spacing relative">
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
                loading="lazy"
              />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-6">
              Built for <span className="text-gradient">inventors who file</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Everything you need to draft a professional patent application, without the $15K attorney bill.
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

      {/* Security & Privacy Section */}
      <section className="section-spacing-sm relative bg-muted/20">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <p className="badge-outline mb-4">
              <Lock className="w-3.5 h-3.5 mr-1" />
              Security
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-4">
              Your invention data is <span className="text-gradient">never exposed</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Enterprise-grade security from day one.
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
          >
            {[
              { icon: Lock, title: 'AES-256 Encryption', desc: 'All data encrypted at rest and in transit' },
              { icon: Shield, title: 'SOC 2 Infrastructure', desc: 'Hosted on compliant cloud providers' },
              { icon: Eye, title: 'No AI Training', desc: 'Your data is never used to train models' },
              { icon: Scale, title: 'Delete Anytime', desc: 'Full data ownership — remove everything instantly' },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="bg-card border border-border/40 rounded-2xl p-5 text-center"
                variants={scaleIn}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold text-foreground text-sm mb-1">{item.title}</h4>
                <p className="text-muted-foreground text-xs leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="section-spacing relative bg-muted/20">
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
            Start your patent draft today
          </h2>
          <p className="text-muted-foreground text-lg sm:text-xl mb-10 max-w-2xl mx-auto">
            Free account includes 3 prior art searches. No credit card required to explore.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Button 
              className="btn-gradient group text-base px-8 py-6 h-auto"
              onClick={() => handleAuthNav('signup')}
            >
              {user ? 'Go to Dashboard' : 'Start Free Invention Interview'}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button 
              variant="ghost"
              className="text-muted-foreground hover:text-foreground text-base px-8 py-6 h-auto group"
              onClick={() => navigate('/check')}
            >
              <Search className="w-4 h-4" />
              Check Patentability Free
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/30 bg-card/30">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
            <img 
              src="https://i.ibb.co/nsLWZ3sr/Patent-Bot-Logo-1.png" 
              alt="PatentBot AI" 
              className="h-8 w-auto"
              loading="lazy"
            />
            <p className="text-sm text-muted-foreground">
              © {getCurrentYear()} PatentBot AI. All rights reserved.
            </p>
            <div className="flex gap-8 text-sm">
              <span className="link-subtle cursor-pointer" onClick={() => navigate('/demo')}>Demo</span>
              <span className="link-subtle cursor-pointer" onClick={() => navigate('/pricing')}>Pricing</span>
            </div>
          </div>
          
          {/* Legal Disclaimer */}
          <div className="border-t border-border/20 pt-6">
            <p className="text-[11px] text-muted-foreground/70 text-center max-w-4xl mx-auto leading-relaxed">
              <strong>Legal Disclaimer:</strong> PatentBot is an AI-powered drafting assistant — not a law firm and not a substitute for a registered patent attorney or agent. 
              PatentBot does not provide legal advice, legal opinions, or attorney-client privilege. Output is intended as a pro se drafting aid or starting point for 
              attorney review. We strongly recommend having a registered patent attorney or agent review your application before filing with the USPTO. 
              Patent filing outcomes depend on many factors beyond document formatting. All invention data is encrypted (AES-256) and never used to train AI models.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;