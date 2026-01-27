import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Search, 
  Lightbulb, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle, 
  Sparkles,
  Rocket,
  Shield,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PATENT_APPLICATION_PRICE_DISPLAY, 
  FREE_SEARCHES_LIMIT 
} from '@/lib/pricingConstants';

interface WelcomeWizardProps {
  open: boolean;
  onComplete: () => void | Promise<void>;
  userName?: string;
}

export const WelcomeWizard = ({ open, onComplete, userName }: WelcomeWizardProps) => {
  const [step, setStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const navigate = useNavigate();
  const displayName = userName?.split('@')[0] || 'Inventor';

  const handleAction = async (path: string) => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      await onComplete();
      navigate(path);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleSkip = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      await onComplete();
    } finally {
      setIsCompleting(false);
    }
  };

  const steps = [
    // Step 0: Welcome
    {
      content: (
        <div className="text-center py-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary to-primary/60 rounded-2xl flex items-center justify-center shadow-glow"
          >
            <Sparkles className="h-12 w-12 text-primary-foreground" />
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold mb-3"
          >
            Welcome, {displayName}! 🎉
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground text-lg mb-8 max-w-md mx-auto"
          >
            You're about to protect your innovation with AI-powered patent drafting. Let's get you started in 30 seconds.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 shadow-glow"
              onClick={() => setStep(1)}
              disabled={isCompleting}
            >
              Let's Go!
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="ghost"
              onClick={handleSkip}
              disabled={isCompleting}
            >
              {isCompleting ? 'Saving...' : 'Skip for now'}
            </Button>
          </motion.div>
        </div>
      )
    },
    // Step 1: What brings you here?
    {
      content: (
        <div className="py-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h2 className="text-2xl font-bold mb-2">What brings you to PatentBot?</h2>
            <p className="text-muted-foreground">Choose your path to get personalized guidance</p>
          </motion.div>
          
          <div className="grid gap-4 max-w-lg mx-auto">
            {/* Option 1: Ready to File */}
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => handleAction('/new-application')}
              className="p-5 rounded-xl border-2 border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/20 rounded-xl group-hover:bg-primary/30 transition-colors">
                  <Rocket className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">I'm ready to file a patent</h3>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Recommended</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Start your AI-guided patent application now. Get a complete USPTO-ready draft.
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      15-min process
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      {PATENT_APPLICATION_PRICE_DISPLAY} flat fee
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </motion.button>

            {/* Option 2: Check First */}
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => handleAction('/check')}
              className="p-5 rounded-xl border-2 border-secondary/30 bg-secondary/5 hover:border-secondary hover:bg-secondary/10 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-secondary/20 rounded-xl group-hover:bg-secondary/30 transition-colors">
                  <Search className="h-6 w-6 text-secondary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">I want to check if my idea is new</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Search existing patents first. See if similar inventions already exist.
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-secondary" />
                      {FREE_SEARCHES_LIMIT} free searches
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-secondary" />
                      AI analysis
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-secondary transition-colors" />
              </div>
            </motion.button>

            {/* Option 3: Just Exploring */}
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              onClick={handleSkip}
              disabled={isCompleting}
              className="p-5 rounded-xl border-2 border-muted/30 hover:border-muted-foreground/30 hover:bg-muted/10 transition-all text-left group disabled:opacity-50"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-muted/30 rounded-xl group-hover:bg-muted/50 transition-colors">
                  <Lightbulb className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">
                    {isCompleting ? 'Saving...' : "I'm just exploring for now"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Look around the dashboard, learn about the process, and come back when ready.
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
              </div>
            </motion.button>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 flex justify-center"
          >
            <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </motion.div>
        </div>
      )
    }
  ];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-xl p-0 overflow-hidden bg-gradient-to-b from-card to-card/95 border-primary/20"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        aria-describedby={undefined}
      >
        <VisuallyHidden>
          <DialogTitle>Welcome to PatentBot AI</DialogTitle>
        </VisuallyHidden>
        {/* Progress indicator */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: '0%' }}
            animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="p-6 pt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {steps[step].content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Trust badges */}
        <div className="border-t bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              <span>Secure & Confidential</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              <span>AI-Powered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span>USPTO Format</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
