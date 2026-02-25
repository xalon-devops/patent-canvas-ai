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

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
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
      staggerChildren: 0.08,
      delayChildren: 0.05
    }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
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
    { value: '90%', label: 'Lower Cost' },
    { value: '<48h', label: 'First Draft' },
    { value: '7', label: 'Sections' },
    { value: '∞', label: 'Revisions' }
  ];

  const steps = [
    {
      icon: FileText,
      number: '01',
      title: 'Describe Your Invention',
      description: 'Our AI conducts a structured technical interview — extracting novel aspects, prior art differentiators, and claim-worthy features.'
    },
    {
      icon: Search,
      number: '02',
      title: 'Automated Prior Art Search',
      description: 'Semantic search across USPTO, EPO, and WIPO databases identifies overlapping patents and scores novelty before drafting.'
    },
    {
      icon: Award,
      number: '03',
      title: 'Export USPTO-Formatted Draft',
      description: 'All 7 sections generated as a professional DOCX you can file directly or hand to your attorney for review.'
    }
  ];

  const benefits = [
    {
      icon: Clock,
      title: 'Draft in Hours, Not Weeks',
      description: 'Complete your first patent draft in under 48 hours. Our AI interview captures technical details efficiently.'
    },
    {
      icon: DollarSign,
      title: '$1,000 Flat Fee',
      description: 'One price for the entire application. No hourly billing. Traditional firms charge $8K–$15K for the same output.'
    },
    {
      icon: Search,
      title: 'Know Before You File',
      description: 'Run unlimited prior art searches ($9.99/mo) to understand your competitive landscape before committing.'
    }
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <PageSEO.Home />
      <PublicHeader />
      
      {/* ===== HERO ===== */}
      <section className="relative hero-gradient overflow-hidden">
        <div className="orb orb-primary w-[600px] h-[600px] -top-40 -right-40 float" />
        <div className="orb orb-accent w-[500px] h-[500px] top-1/2 -left-60 float" style={{ animationDelay: '-3s' }} />
        
        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pt-36 pb-32 sm:pt-44 sm:pb-40 lg:pt-52 lg:pb-48">
          <motion.div 
            className="max-w-4xl mx-auto text-center"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div 
              className="inline-flex items-center gap-2 badge-outline mb-8"
              variants={fadeInUp}
              transition={{ duration: 0.5 }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pro Se Patent Drafting Assistant</span>
            </motion.div>
            
            <motion.h1 
              className="text-4xl sm:text-5xl lg:text-7xl font-bold text-foreground leading-[1.08] tracking-[-0.04em] mb-6"
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
            
            <motion.p 
              className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-12 max-w-2xl mx-auto"
              variants={fadeInUp}
              transition={{ duration: 0.6 }}
            >
              AI-assisted drafting tool that generates all 7 USPTO sections — Abstract, Claims, Description & more — for a $1,000 flat fee.
            </motion.p>

            <motion.div 
              className="flex flex-col sm:flex-row gap-3 justify-center mb-16"
              variants={fadeInUp}
              transition={{ duration: 0.6 }}
            >
              <Button 
                size="lg"
                className="btn-dark group text-base px-8 py-6 h-auto rounded-2xl"
                onClick={() => handleAuthNav('signup')}
              >
                {user ? 'Go to Dashboard' : 'Start Free Invention Interview'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="text-base px-8 py-6 h-auto rounded-2xl border-border bg-card hover:bg-muted/50"
                onClick={() => navigate('/check')}
              >
                <Search className="h-4 w-4" />
                Run 3 Free Prior Art Searches
              </Button>
            </motion.div>

            <motion.div 
              className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground"
              variants={fadeInUp}
              transition={{ duration: 0.6 }}
            >
              {[
                { icon: Shield, text: 'USPTO-formatted output' },
                { icon: Lock, text: 'AES-256 encrypted' },
                { icon: Scale, text: 'Pro se drafting tool' },
                { icon: Zap, text: 'Draft in <48 hours' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <item.icon className="w-4 h-4 text-primary" />
                  <span>{item.text}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* ===== STATS ===== */}
      <section className="relative -mt-16 z-20">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <motion.div 
            className="glass-strong rounded-2xl p-8 sm:p-10 grid grid-cols-2 md:grid-cols-4 gap-8"
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
                transition={{ duration: 0.4, delay: index * 0.08 }}
              >
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="section-spacing-sm relative">
        <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8">
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <p className="badge-outline mb-4">How It Works</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-[-0.03em] mb-4">
              From idea to <span className="text-gradient">filed draft</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              A structured approach that mirrors how patent attorneys work.
            </p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
          >
            {steps.map((step, index) => (
              <motion.div 
                key={index}
                className="feature-card !p-6 sm:!p-8"
                variants={fadeInUp}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="flex items-center gap-4 mb-5">
                  <span className="text-3xl font-bold text-primary/20 tracking-tighter">{step.number}</span>
                  <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center">
                    <step.icon className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="section-spacing relative">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        
        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8">
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <p className="badge-outline mb-4">Pricing</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-[-0.03em] mb-5">
              Transparent, <span className="text-gradient">simple pricing</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              No hidden fees. No hourly billing.
            </p>
          </motion.div>

          <motion.div 
            className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
          >
            {/* Patent Application */}
            <motion.div 
              className="pricing-card-featured"
              variants={fadeInUp}
              transition={{ duration: 0.6 }}
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="badge-premium">Most Popular</span>
              </div>
              
              <div className="mb-8 pt-2">
                <h3 className="text-xl font-bold text-foreground mb-1">Patent Application</h3>
                <p className="text-muted-foreground text-sm">Complete AI-guided patent drafting</p>
              </div>
              
              <div className="mb-8">
                <span className="text-5xl font-bold text-foreground tracking-tight">{PATENT_APPLICATION_PRICE_DISPLAY}</span>
                <span className="text-muted-foreground ml-2 text-sm">one-time</span>
              </div>

              <ul className="space-y-3.5 mb-10">
                {[
                  'AI-guided interview process',
                  'Comprehensive prior art search',
                  'Full patent draft (all sections)',
                  'DOCX/PDF export for filing',
                  'Unlimited revisions'
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-foreground text-sm">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full btn-dark h-12 text-sm rounded-xl" 
                onClick={() => handleAuthNav('signup')}
              >
                {user ? 'Go to Dashboard' : 'Start Invention Interview'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>

            {/* Check & See */}
            <motion.div 
              className="pricing-card"
              variants={fadeInUp}
              transition={{ duration: 0.6, delay: 0.08 }}
            >
              <div className="mb-8">
                <h3 className="text-xl font-bold text-foreground mb-1">Check & See</h3>
                <p className="text-muted-foreground text-sm">Prior art search subscription</p>
              </div>
              
              <div className="mb-8">
                <span className="text-5xl font-bold text-foreground tracking-tight">{CHECK_AND_SEE_PRICE_DISPLAY}</span>
                <span className="text-muted-foreground ml-2 text-sm">/month</span>
              </div>

              <ul className="space-y-3.5 mb-10">
                {[
                  'Unlimited patent searches',
                  'Similarity analysis reports',
                  'Global patent database access',
                  'AI-powered novelty assessment',
                  'Cancel anytime'
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-muted-foreground text-sm">
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                variant="outline"
                className="w-full h-12 text-sm rounded-xl border-border hover:bg-muted/50" 
                onClick={() => handleAuthNav('signup')}
              >
                {user ? 'Go to Dashboard' : 'Run Free Prior Art Search'}
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ===== COMPARISON ===== */}
      <section className="section-spacing-sm relative">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <p className="badge-outline mb-4">Compare</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-[-0.03em] mb-4">
              PatentBot vs <span className="text-gradient">Traditional Firms</span>
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="overflow-hidden rounded-2xl border border-border bg-card"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 sm:p-4 text-muted-foreground font-medium uppercase tracking-wider text-[10px] sm:text-xs">Feature</th>
                  <th className="p-3 sm:p-4 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-foreground flex items-center justify-center">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-background" />
                      </div>
                      <span className="font-semibold text-foreground text-[10px] sm:text-xs">PatentBot</span>
                    </div>
                  </th>
                  <th className="p-3 sm:p-4 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-muted flex items-center justify-center">
                        <Award className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                      </div>
                      <span className="font-medium text-muted-foreground text-[10px] sm:text-xs">Traditional</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Cost', pb: '$1,000', pbSub: 'flat fee', trad: '$8K–$15K+', tradSub: 'hourly' },
                  { label: 'First Draft', pb: '24h', trad: '2–4 wks' },
                  { label: 'Prior Art', pb: 'Included', pbCheck: true, trad: '$1.5K–$3K extra' },
                  { label: 'Revisions', pb: 'Unlimited', pbCheck: true, trad: '$200–$500/hr' },
                  { label: 'USPTO Format', pbCheck: true, tradCheck: true },
                  { label: '24/7 Access', pbCheck: true, trad: 'Business hrs' },
                ].map((row, i) => (
                  <tr key={i} className={`border-b border-border/40 ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                    <td className="p-3 sm:p-4 font-medium text-foreground">{row.label}</td>
                    <td className="p-3 sm:p-4 text-center">
                      {row.pbCheck && !row.pb ? (
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                          <Check className="w-3 h-3 text-primary" />
                        </div>
                      ) : row.pbCheck && row.pb ? (
                        <div className="inline-flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                            <Check className="w-3 h-3 text-primary" />
                          </div>
                          <span className="font-semibold text-foreground">{row.pb}</span>
                        </div>
                      ) : (
                        <>
                          <span className="text-lg sm:text-xl font-bold text-gradient">{row.pb}</span>
                          {row.pbSub && <span className="block text-[9px] sm:text-xs text-muted-foreground">{row.pbSub}</span>}
                        </>
                      )}
                    </td>
                    <td className="p-3 sm:p-4 text-center">
                      {row.tradCheck ? (
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center mx-auto">
                          <Check className="w-3 h-3 text-muted-foreground" />
                        </div>
                      ) : (
                        <>
                          <span className={`${row.tradSub ? 'text-lg sm:text-xl font-bold' : ''} text-muted-foreground`}>{row.trad}</span>
                          {row.tradSub && <span className="block text-[9px] sm:text-xs text-muted-foreground">{row.tradSub}</span>}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="p-6 bg-muted/30 border-t border-border/40 text-center">
              <p className="text-muted-foreground mb-4 text-sm">
                Save up to <span className="font-bold text-foreground">90%</span> compared to traditional patent firms
              </p>
              <Button 
                className="btn-dark rounded-xl"
                onClick={() => handleAuthNav('signup')}
              >
                {user ? 'Go to Dashboard' : 'Start Drafting — $1,000'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== WHY PATENTBOT ===== */}
      <section id="features" className="section-spacing relative">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-16"
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
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-[-0.03em] mb-5">
              Built for <span className="text-gradient">inventors who file</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Everything you need to draft a professional patent application.
            </p>
          </motion.div>

          <motion.div 
            className="grid md:grid-cols-3 gap-5"
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
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="feature-icon">
                  <benefit.icon />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{benefit.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== SECURITY ===== */}
      <section className="section-spacing-sm relative bg-muted/30">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <p className="badge-outline mb-4">
              <Lock className="w-3.5 h-3.5 mr-1.5" />
              Security
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-[-0.03em] mb-4">
              Your invention data is <span className="text-gradient">never exposed</span>
            </h2>
          </motion.div>

          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
          >
            {[
              { icon: Lock, title: 'AES-256 Encryption', desc: 'Data encrypted at rest and in transit' },
              { icon: Shield, title: 'SOC 2 Infrastructure', desc: 'Hosted on compliant cloud providers' },
              { icon: Eye, title: 'No AI Training', desc: 'Your data is never used to train models' },
              { icon: Scale, title: 'Delete Anytime', desc: 'Full data ownership and control' },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="bg-card border border-border rounded-2xl p-5 text-center"
                style={{ boxShadow: 'var(--shadow-xs)' }}
                variants={scaleIn}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center mx-auto mb-3">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold text-foreground text-sm mb-1">{item.title}</h4>
                <p className="text-muted-foreground text-xs leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="section-spacing relative">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <motion.div 
            className="text-center max-w-3xl mx-auto mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <p className="badge-outline mb-4">
              <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
              FAQ
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-[-0.03em] mb-4">
              Frequently asked questions
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <Accordion type="single" collapsible className="space-y-3">
              {[
                { q: 'What types of patents can PatentBot help with?', a: 'PatentBot specializes in utility patents, which cover new and useful processes, machines, manufactures, and compositions of matter. This includes software patents, mechanical inventions, chemical compositions, and business methods.' },
                { q: 'How long does it take to generate a patent application?', a: 'Most patent applications are generated within 24-48 hours after completing the AI interview process. The interview itself typically takes 30-60 minutes depending on the complexity of your invention.' },
                { q: 'Do I still need a patent attorney?', a: 'While PatentBot generates professional-quality patent applications, we recommend having a registered patent attorney or agent review your application before filing. Our output is designed to give attorneys a strong starting point, reducing their billable hours significantly.' },
                { q: 'What is included in the prior art search?', a: 'Our prior art search covers the USPTO, EPO, WIPO, and major international patent databases. We use AI-powered semantic search to identify similar inventions, analyze claim overlap, and provide a novelty assessment with similarity scores.' },
                { q: 'Is my invention idea kept confidential?', a: 'Absolutely. Your invention details are encrypted (AES-256) and stored securely. We never share your information with third parties. All data is stored on SOC 2 compliant infrastructure and you can delete your data at any time.' },
                { q: 'What format will my patent application be in?', a: 'Your patent application is generated in USPTO-compliant format and can be downloaded as both DOCX and PDF files. The document includes all required sections: title, abstract, background, summary, detailed description, claims, and drawing descriptions.' },
                { q: 'Can I make revisions after the draft is generated?', a: 'Yes! Unlimited revisions are included with every patent application. You can edit any section directly in our editor, request AI-powered enhancements, or regenerate specific sections.' },
              ].map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="bg-card border border-border rounded-2xl px-6 data-[state=open]:shadow-card transition-shadow">
                  <AccordionTrigger className="text-left text-foreground font-semibold hover:no-underline py-5 text-sm sm:text-base">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-5 leading-relaxed text-sm">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="section-spacing relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
        <div className="orb orb-primary w-[500px] h-[500px] top-0 left-1/2 -translate-x-1/2 pulse-glow" />
        
        <motion.div 
          className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-[-0.03em] mb-5">
            Start your patent draft today
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Free account includes 3 prior art searches. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              className="btn-dark group text-base px-8 py-6 h-auto rounded-2xl"
              onClick={() => handleAuthNav('signup')}
            >
              {user ? 'Go to Dashboard' : 'Start Free Invention Interview'}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button 
              variant="ghost"
              className="text-muted-foreground hover:text-foreground text-base px-8 py-6 h-auto rounded-2xl group"
              onClick={() => navigate('/check')}
            >
              <Search className="w-4 h-4" />
              Check Patentability Free
            </Button>
          </div>
        </motion.div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-12 border-t border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
            <img 
              src="https://i.ibb.co/nsLWZ3sr/Patent-Bot-Logo-1.png" 
              alt="PatentBot AI" 
              className="h-7 w-auto"
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
          
          <div className="border-t border-border/40 pt-6">
            <p className="text-[11px] text-muted-foreground/60 text-center max-w-4xl mx-auto leading-relaxed">
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
