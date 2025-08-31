import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Play, ArrowRight, Sparkles, X, FileText, Search, Zap, Shield, CheckCircle, Clock, Users, Star, Brain, Atom } from 'lucide-react';
import PatentCanvas from '@/components/PatentCanvas';
import PriorArtDisplay from '@/components/PriorArtDisplay';

const Demo = () => {
  const [currentPhase, setCurrentPhase] = useState<'intro' | 'demo' | 'outro'>('intro');
  const [demoStep, setDemoStep] = useState(0);
  const [typewriterText, setTypewriterText] = useState('');
  const [showCTA, setShowCTA] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const navigate = useNavigate();

  const introText = "What if your apps could patent themselves with AI?";
  const outroText = "Join 10,000+ inventors who've protected their innovations with AI";

  const demoSteps = [
    { title: "Login & Dashboard", duration: 2000 },
    { title: "AI Interview Process", duration: 3000 },
    { title: "Enhanced Prior Art Search", duration: 4000 },
    { title: "Live Patent Generation", duration: 5000 },
    { title: "Review & Export", duration: 3000 }
  ];

  // Mock data for enhanced components
  const mockPatentSections = [
    { id: '1', section_type: 'abstract', content: 'A revolutionary AI-powered system for automated patent application generation through code repository analysis...', is_user_edited: false, created_at: new Date().toISOString() },
    { id: '2', section_type: 'background', content: 'The field of patent law has traditionally required extensive manual documentation...', is_user_edited: false, created_at: new Date().toISOString() },
    { id: '3', section_type: 'summary', content: 'The present invention provides a novel approach to automated patent generation...', is_user_edited: false, created_at: new Date().toISOString() },
    { id: '4', section_type: 'claims', content: '1. A computer-implemented method for generating patent applications...', is_user_edited: false, created_at: new Date().toISOString() },
    { id: '5', section_type: 'description', content: 'The detailed description of the invention includes comprehensive technical specifications...', is_user_edited: false, created_at: new Date().toISOString() }
  ];

  const mockPriorArt = [
    {
      id: "1",
      title: "Automated Software Documentation Generation System",
      publication_number: "US11234567B2",
      summary: "A machine learning system for analyzing source code and generating technical documentation with natural language processing capabilities.",
      similarity_score: 0.23,
      url: "https://patents.google.com/patent/US11234567B2/en",
      publication_date: "2023-01-15",
      filing_date: "2021-08-20",
      created_at: new Date().toISOString()
    },
    {
      id: "2",
      title: "AI-Driven Code Analysis for Patent Prior Art Search",
      publication_number: "US10987654B1", 
      summary: "System and method for using artificial intelligence to analyze patent databases and identify relevant prior art for software inventions.",
      similarity_score: 0.18,
      url: "https://patents.google.com/patent/US10987654B1/en",
      publication_date: "2022-11-30",
      filing_date: "2020-05-12",
      created_at: new Date().toISOString()
    },
    {
      id: "3",
      title: "Natural Language Processing for Legal Document Generation",
      publication_number: "US10456789B2",
      summary: "A natural language processing system for automated generation of legal documents including patent applications and claims.",
      similarity_score: 0.15,
      url: "https://patents.google.com/patent/US10456789B2/en", 
      publication_date: "2022-07-08",
      filing_date: "2019-12-03",
      created_at: new Date().toISOString()
    }
  ];

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
            timeoutId = setTimeout(() => typeCharacter(index + 1), 50);
          } else if (currentPhase === 'intro') {
            // After intro is done, start demo phase
            setTimeout(() => {
              setCurrentPhase('demo');
              setTypewriterText('');
            }, 1000);
          } else if (currentPhase === 'outro') {
            // Show CTA after outro is done
            setTimeout(() => setShowCTA(true), 1000);
          }
        }
      };

      timeoutId = setTimeout(() => typeCharacter(0), 500);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [currentPhase]);

  // Demo sequence phases
  useEffect(() => {
    let phaseTimeout: NodeJS.Timeout;
    let stepTimeout: NodeJS.Timeout;

    if (currentPhase === 'demo') {
      const runDemoSequence = () => {
        let currentStep = 0;
        
        const nextStep = () => {
          if (currentStep < demoSteps.length) {
            setDemoStep(currentStep);
            
            // Start patent generation animation on step 3
            if (currentStep === 3) {
              setIsGenerating(true);
              setCurrentSectionIndex(0);
              
              // Animate sections filling up
              const sectionInterval = setInterval(() => {
                setCurrentSectionIndex(prev => {
                  if (prev < mockPatentSections.length - 1) {
                    return prev + 1;
                  } else {
                    clearInterval(sectionInterval);
                    setIsGenerating(false);
                    return prev;
                  }
                });
              }, 800);
            }
            
            stepTimeout = setTimeout(() => {
              currentStep++;
              nextStep();
            }, demoSteps[currentStep]?.duration || 4000);
          } else {
            setCurrentPhase('outro');
          }
        };
        
        nextStep();
      };
      
      runDemoSequence();
    } else if (currentPhase === 'outro' && showCTA) {
      // After outro + CTA, restart the loop
      phaseTimeout = setTimeout(() => {
        setCurrentPhase('intro');
        setTypewriterText('');
        setShowCTA(false);
        setDemoStep(0);
        setIsGenerating(false);
        setCurrentSectionIndex(0);
      }, 4000);
    }

    return () => {
      if (phaseTimeout) clearTimeout(phaseTimeout);
      if (stepTimeout) clearTimeout(stepTimeout);
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
      {/* Logo and Branding - Only show during intro and outro */}
      {(currentPhase === 'intro' || currentPhase === 'outro') && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-40">
          <div className="flex items-center justify-center mb-8 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center shadow-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">
                PatentBot AI™
              </h1>
            </div>
          </div>
        </div>
      )}

      {/* Close Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClose}
        className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 hover:text-white"
      >
        <X className="h-5 w-5" />
      </Button>

      {/* Demo Background */}
      <div className="absolute inset-0">
        {currentPhase === 'demo' ? (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-background to-primary/10 flex items-center justify-center p-4">
            <div className="relative w-full max-w-7xl mx-auto h-full">
              {/* Browser Window */}
              <div className="bg-card rounded-xl shadow-2xl overflow-hidden h-full animate-scale-in border border-border/50">
                {/* Browser Header */}
                <div className="bg-muted h-10 flex items-center px-4 gap-2 border-b border-border">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-xs text-muted-foreground bg-background/50 px-3 py-1 rounded-md">
                      patentbot.ai/{demoStep === 0 ? 'dashboard' : demoStep === 1 ? 'interview' : demoStep === 2 ? 'search' : demoStep === 3 ? 'generate' : 'export'}
                    </div>
                    {/* Mini logo in browser header during demo */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-4 h-4 bg-gradient-to-br from-primary to-primary/60 rounded flex items-center justify-center">
                        <Brain className="h-2.5 w-2.5 text-white" />
                      </div>
                      <span className="font-medium">PatentBot AI™</span>
                    </div>
                  </div>
                </div>
                
                {/* Demo Content */}
                <div className="p-6 h-full bg-background overflow-auto">
                  {/* Step 0: Dashboard */}
                  {demoStep === 0 && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold text-foreground">Welcome to PatentBot AI™</h1>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          10,247 patents filed
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gradient-primary p-6 rounded-lg text-white animate-slide-in-right">
                          <FileText className="h-8 w-8 mb-3" />
                          <h3 className="text-xl font-semibold mb-2">File New Patent</h3>
                          <p className="text-sm opacity-90 mb-4">AI-powered patent drafting in minutes</p>
                          <div className="bg-white/20 px-4 py-2 rounded text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                              <span className="animate-pulse">Starting new application...</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-card p-6 rounded-lg border animate-slide-in-right text-card-foreground" style={{ animationDelay: '0.3s' }}>
                          <Search className="h-8 w-8 mb-3 text-primary" />
                          <h3 className="text-xl font-semibold mb-2">Check & See</h3>
                          <p className="text-sm text-muted-foreground mb-4">Search existing patents</p>
                          <div className="text-sm text-primary">$9.99/month</div>
                        </div>
                      </div>
                      
                      <div className="bg-card p-4 rounded-lg border text-card-foreground">
                        <h4 className="font-semibold mb-3">Recent Applications</h4>
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <div className="flex-1">
                                <div className="h-3 bg-muted rounded w-2/3"></div>
                              </div>
                              <div className="text-xs text-muted-foreground">Filed</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Step 1: AI Interview */}
                  {demoStep === 1 && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold mb-2 text-foreground">AI Patent Interview</h2>
                        <p className="text-muted-foreground">Tell us about your invention</p>
                      </div>
                      
                      <div className="max-w-4xl mx-auto space-y-4">
                        <div className="bg-primary/10 p-4 rounded-lg border-l-4 border-primary">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-bold">
                              AI
                            </div>
                            <div className="flex-1">
                              <p className="mb-2">What type of invention would you like to patent?</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-background p-3 rounded border hover:border-primary transition-colors">
                                  <Zap className="h-5 w-5 text-primary mb-1" />
                                  <div className="font-medium">Software/Algorithm</div>
                                </div>
                                <div className="bg-primary/20 p-3 rounded border border-primary">
                                  <Shield className="h-5 w-5 text-primary mb-1" />
                                  <div className="font-medium">Device/Hardware</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-muted/50 p-4 rounded-lg animate-slide-in-right" style={{ animationDelay: '0.5s' }}>
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-secondary-foreground text-sm font-bold">
                              U
                            </div>
                            <div className="flex-1">
                              <div className="bg-background p-3 rounded">
                                <div className="animate-pulse">I've invented a mobile app that automatically generates patent applications by analyzing code repositories...</div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-primary/10 p-4 rounded-lg border-l-4 border-primary animate-slide-in-right" style={{ animationDelay: '1s' }}>
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-bold">
                              AI
                            </div>
                            <div className="flex-1">
                              <div className="space-y-2">
                                <p>Fascinating! An AI-powered patent generator for software...</p>
                                <div className="flex items-center gap-2 text-sm">
                                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                                  <span className="animate-pulse">Analyzing GitHub integration capabilities...</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Step 2: Enhanced Prior Art Search */}
                  {demoStep === 2 && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2 text-foreground">Enhanced Prior Art Search</h2>
                        <p className="text-muted-foreground">AI-powered search across 120M+ patents with similarity scoring</p>
                      </div>
                      
                      <div className="bg-card p-6 rounded-lg border">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="flex items-center gap-2">
                            <Atom className="h-5 w-5 text-primary animate-spin" />
                            <Search className="h-4 w-4 text-primary/60" />
                          </div>
                          <span className="font-medium">Analyzing patent landscape with AI...</span>
                          <div className="ml-auto bg-gradient-to-r from-primary/20 to-secondary/20 text-primary px-3 py-1 rounded-full text-xs font-medium">
                            Processing complete
                          </div>
                        </div>
                        
                        <PriorArtDisplay 
                          priorArt={mockPriorArt}
                          isSearching={false}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Step 3: Live Patent Generation */}
                  {demoStep === 3 && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2 text-foreground flex items-center justify-center gap-3">
                          <Brain className="h-7 w-7 text-primary animate-pulse" />
                          Live Patent Generation
                        </h2>
                        <p className="text-muted-foreground">Watch AI craft your professional patent application in real-time</p>
                      </div>
                      
                      <div className="max-w-5xl mx-auto">
                        <PatentCanvas
                          sections={mockPatentSections.slice(0, currentSectionIndex + 1)}
                          onUpdateSection={async () => {}}
                          onRegenerateSection={async () => {}}
                          isGenerating={isGenerating}
                        />
                        
                        {isGenerating && (
                          <div className="mt-6 bg-gradient-to-r from-primary/10 to-secondary/10 p-4 rounded-lg border border-primary/20">
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                              </div>
                              <span className="text-sm font-medium text-primary">
                                AI is analyzing your invention and crafting professional patent language...
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Step 4: Review & Export */}
                  {demoStep === 4 && (
                    <div className="space-y-6 animate-fade-in">
                      <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2 text-foreground">Patent Application Complete</h2>
                        <p className="text-muted-foreground">Review and file your professional patent</p>
                      </div>
                      
                      <div className="bg-gradient-primary p-6 rounded-lg text-primary-foreground animate-scale-in">
                        <div className="flex items-center gap-3 mb-4">
                          <CheckCircle className="h-8 w-8" />
                          <div>
                            <h3 className="text-xl font-semibold">Patent Application Ready!</h3>
                            <p className="opacity-90">Professional 47-page patent application generated</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-white/20 p-3 rounded">
                            <div className="text-2xl font-bold">47</div>
                            <div className="text-xs opacity-80">Pages</div>
                          </div>
                          <div className="bg-white/20 p-3 rounded">
                            <div className="text-2xl font-bold">23</div>
                            <div className="text-xs opacity-80">Claims</div>
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <Button className="bg-white text-primary hover:bg-white/90">
                            <FileText className="h-4 w-4 mr-2" />
                            Download DOCX
                          </Button>
                          <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                            File with USPTO
                          </Button>
                        </div>
                      </div>
                      
                      <div className="bg-card p-6 rounded-lg border text-card-foreground">
                        <h4 className="font-semibold mb-4">What's Included</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Complete patent application</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Professional formatting</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Prior art analysis</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>USPTO-ready format</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-900 to-black flex items-center justify-center p-8">
            <div className="text-center max-w-4xl mx-auto">
              {/* Typewriter Text */}
              {(currentPhase === 'intro' || currentPhase === 'outro') && (
                <div className="h-24 flex items-center justify-center mb-8">
                  <p className="text-xl md:text-2xl text-white/90 max-w-4xl leading-relaxed min-h-[3rem] animate-fade-in">
                    {typewriterText}
                    <span className="animate-pulse text-primary">|</span>
                  </p>
                </div>
              )}

              {/* CTA Button */}
              {showCTA && (
                <div className="mt-8 space-y-6 animate-scale-in">
                  {/* Social Proof */}
                  <div className="flex items-center justify-center gap-6 text-white/80 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                        ))}
                      </div>
                      <span>4.9/5 rating</span>
                    </div>
                    <div className="w-px h-4 bg-white/30"></div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>10,000+ patents filed</span>
                    </div>
                    <div className="w-px h-4 bg-white/30"></div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span>$50M+ IP protected</span>
                    </div>
                  </div>

                  {/* Testimonial */}
                  <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-gradient-primary rounded-full"></div>
                      <div>
                        <div className="font-medium text-white text-sm">Sarah Chen</div>
                        <div className="text-white/70 text-xs">Tech Startup Founder</div>
                      </div>
                    </div>
                    <p className="text-white/90 text-sm italic">
                      "PatentBot AI helped me file my first patent in just 2 hours. What would have taken months with a law firm cost me $1,000 and was done the same day."
                    </p>
                  </div>
                  
                  <Button
                    variant="default"
                    size="lg"
                    onClick={handleSignUp}
                    className="text-lg h-16 px-12 bg-gradient-primary text-white hover:scale-105 transition-all duration-300"
                  >
                    <Sparkles className="h-5 w-5 mr-2" />
                    Start Your Patent Journey Now
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                  
                  <div className="text-white/70 text-sm space-y-1">
                    <p className="font-medium">✨ Get started in under 60 seconds</p>
                    <p>💳 Only pay $1,000 when you're ready to file</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Demo Phase Progress */}
      {currentPhase === 'demo' && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-black/40 backdrop-blur-md rounded-lg px-6 py-4 animate-slide-in-right">
            <div className="flex items-center gap-3 text-white mb-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Live Demo: {demoSteps[demoStep]?.title}</span>
            </div>
            <div className="flex gap-1">
              {demoSteps.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1 w-8 rounded-full transition-all duration-300 ${
                    i === demoStep ? 'bg-primary' : i < demoStep ? 'bg-green-500' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-40">
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
  );
};

export default Demo;