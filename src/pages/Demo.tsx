import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Play, ArrowRight, Sparkles, X } from 'lucide-react';

const Demo = () => {
  const [currentPhase, setCurrentPhase] = useState<'intro' | 'demo' | 'outro'>('intro');
  const [typewriterText, setTypewriterText] = useState('');
  const [showCTA, setShowCTA] = useState(false);
  const navigate = useNavigate();

  const introText = "What if you could transform your ideas into professional patents with just one click?";
  const outroText = "Ready to turn your innovation into intellectual property?";

  // Typewriter effect
  useEffect(() => {
    let currentText = '';
    let targetText = '';
    let timeoutId: NodeJS.Timeout;

    if (currentPhase === 'intro') {
      targetText = introText;
    } else if (currentPhase === 'outro') {
      targetText = outroText;
    }

    if (targetText) {
      const typeCharacter = (index: number) => {
        if (index <= targetText.length) {
          currentText = targetText.slice(0, index);
          setTypewriterText(currentText);
          
          if (index < targetText.length) {
            timeoutId = setTimeout(() => typeCharacter(index + 1), 80);
          } else if (currentPhase === 'intro') {
            // After intro is done, start demo phase
            setTimeout(() => {
              setCurrentPhase('demo');
              setTypewriterText('');
            }, 2000);
          } else if (currentPhase === 'outro') {
            // Show CTA after outro is done
            setTimeout(() => setShowCTA(true), 1000);
          }
        }
      };

      timeoutId = setTimeout(() => typeCharacter(0), 1000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [currentPhase]);

  // Demo sequence phases
  useEffect(() => {
    let phaseTimeout: NodeJS.Timeout;

    if (currentPhase === 'demo') {
      // Demo phase lasts 8 seconds, then moves to outro
      phaseTimeout = setTimeout(() => {
        setCurrentPhase('outro');
      }, 8000);
    } else if (currentPhase === 'outro' && showCTA) {
      // After outro + CTA, restart the loop
      phaseTimeout = setTimeout(() => {
        setCurrentPhase('intro');
        setTypewriterText('');
        setShowCTA(false);
      }, 5000);
    }

    return () => {
      if (phaseTimeout) clearTimeout(phaseTimeout);
    };
  }, [currentPhase, showCTA]);

  const handleSignUp = () => {
    navigate('/auth');
  };

  const handleClose = () => {
    navigate('/');
  };

  return (
    <div className="fixed inset-0 bg-black z-50 overflow-hidden">
      {/* Close Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClose}
        className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 hover:text-white"
      >
        <X className="h-5 w-5" />
      </Button>

      {/* Video Background */}
      <div className="absolute inset-0">
        {currentPhase === 'demo' ? (
          // Simulated demo sequence - in production, replace with actual video
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-background to-primary/10 flex items-center justify-center">
            <div className="relative w-4/5 h-4/5 max-w-6xl mx-auto">
              {/* Simulated browser window */}
              <div className="bg-card rounded-lg shadow-2xl overflow-hidden h-full animate-scale-in">
                <div className="bg-muted h-8 flex items-center px-4 gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <div className="text-xs text-muted-foreground ml-4">patentbot.ai/dashboard</div>
                </div>
                
                {/* Animated demo content */}
                <div className="p-8 h-full bg-gradient-subtle animate-fade-in">
                  <div className="space-y-6">
                    <div className="animate-slide-in-right" style={{ animationDelay: '0.5s' }}>
                      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-card p-4 rounded-lg shadow-card">
                          <div className="w-8 h-8 bg-primary rounded mb-2"></div>
                          <div className="h-3 bg-muted rounded mb-2"></div>
                          <div className="h-2 bg-muted/60 rounded"></div>
                        </div>
                        <div className="bg-card p-4 rounded-lg shadow-card">
                          <div className="w-8 h-8 bg-secondary rounded mb-2"></div>
                          <div className="h-3 bg-muted rounded mb-2"></div>
                          <div className="h-2 bg-muted/60 rounded"></div>
                        </div>
                        <div className="bg-card p-4 rounded-lg shadow-card">
                          <div className="w-8 h-8 bg-accent rounded mb-2"></div>
                          <div className="h-3 bg-muted rounded mb-2"></div>
                          <div className="h-2 bg-muted/60 rounded"></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="animate-slide-in-right" style={{ animationDelay: '2s' }}>
                      <div className="bg-card p-6 rounded-lg shadow-elegant">
                        <h3 className="text-lg font-semibold mb-4">Create New Patent</h3>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                            <div className="h-2 bg-muted rounded flex-1"></div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                            <div className="h-2 bg-muted rounded flex-1"></div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-primary rounded-full animate-pulse"></div>
                            <div className="h-2 bg-muted rounded flex-1"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="animate-slide-in-right" style={{ animationDelay: '4s' }}>
                      <div className="bg-gradient-primary p-6 rounded-lg text-primary-foreground">
                        <h3 className="text-lg font-semibold mb-2">Patent Generated!</h3>
                        <p className="text-sm opacity-90">Your professional patent application is ready for review and filing.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Static background for intro/outro
          <div className="w-full h-full bg-gradient-to-br from-black via-primary/10 to-black"></div>
        )}
      </div>

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

      {/* Content Overlay */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
        {/* Logo */}
        <div className="mb-8 animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-primary rounded-2xl blur-xl opacity-40"></div>
            <div className="relative bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
              <img 
                src="https://i.ibb.co/Q32kGjnt/Patent-Bot-AI-Logo-Transparent.png" 
                alt="PatentBot AI Logo"
                className="h-16 w-auto"
              />
            </div>
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-8 animate-fade-in">
          <span className="bg-gradient-primary bg-clip-text text-transparent">
            PatentBot AI™
          </span>
        </h1>

        {/* Typewriter Text */}
        {(currentPhase === 'intro' || currentPhase === 'outro') && (
          <div className="h-24 flex items-center justify-center mb-8">
            <p className="text-xl md:text-2xl text-white/90 max-w-4xl leading-relaxed min-h-[3rem] animate-fade-in">
              {typewriterText}
              <span className="animate-pulse text-primary">|</span>
            </p>
          </div>
        )}

        {/* Demo Phase Content */}
        {currentPhase === 'demo' && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
            <div className="bg-black/40 backdrop-blur-md rounded-lg px-6 py-3 animate-slide-in-bottom">
              <div className="flex items-center gap-3 text-white">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Live Demo in Progress...</span>
              </div>
            </div>
          </div>
        )}

        {/* CTA Button */}
        {showCTA && (
          <div className="mt-8 space-y-4 animate-scale-in">
            <Button
              variant="gradient"
              size="lg"
              onClick={handleSignUp}
              className="text-lg h-16 px-12 shadow-glow hover:shadow-2xl hover:scale-105 transition-all duration-300"
            >
              <Sparkles className="h-5 w-5" />
              Start Your Patent Journey Now
              <ArrowRight className="h-5 w-5" />
            </Button>
            
            <p className="text-white/70 text-sm">
              Join thousands of inventors protecting their innovations
            </p>
          </div>
        )}

        {/* Progress Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="flex gap-2">
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
              currentPhase === 'intro' ? 'bg-primary' : 'bg-white/30'
            }`}></div>
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
              currentPhase === 'demo' ? 'bg-primary' : 'bg-white/30'
            }`}></div>
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
              currentPhase === 'outro' ? 'bg-primary' : 'bg-white/30'
            }`}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Demo;