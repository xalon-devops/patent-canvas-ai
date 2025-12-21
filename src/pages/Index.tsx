import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Scale, FileText, Brain, Zap, CheckCircle, ArrowRight, Sparkles, Play, Eye } from 'lucide-react';
import { PageSEO } from '@/components/SEO';
import { getCurrentYear } from '@/lib/dateUtils';
import PublicHeader from '@/components/PublicHeader';
import { 
  PATENT_APPLICATION_PRICE_DISPLAY, 
  CHECK_AND_SEE_PRICE_DISPLAY, 
  CHECK_AND_SEE_PRICE_DISPLAY_MO 
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

  // Helper function for navigation - respects logged-in state
  const handleAuthNav = (defaultTab: 'signin' | 'signup' = 'signup') => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate(`/auth?tab=${defaultTab}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PageSEO.Home />
      <PublicHeader />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-5"></div>
        <div className="w-full px-4 sm:px-6 py-12 sm:py-16 lg:py-20 relative">
          <div className="text-center max-w-4xl mx-auto">
            {/* Logo */}
            <div className="flex items-center justify-center mb-4 sm:mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-primary rounded-2xl blur-xl opacity-30"></div>
                <div className="relative bg-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
                  <img 
                    src="https://i.ibb.co/wrhwtf5P/Patent-Bot-AI-Logo-Transparent.png?v=2" 
                    alt="PatentBot AI Logo"
                    className="h-12 sm:h-16 w-auto"
                  />
                </div>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 px-2">
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                AI-Powered Patent Application Generator
              </span>
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground mb-6 sm:mb-8 leading-relaxed px-4">
              Transform your innovative ideas into professional patent applications 
              with AI-powered assistance and intelligent prior art analysis
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-8 sm:mb-12 px-4">
              <Button 
                variant="gradient" 
                size="lg"
                onClick={() => handleAuthNav('signup')}
                className="text-base sm:text-lg h-12 sm:h-14 px-6 sm:px-8 w-full sm:w-auto"
              >
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="truncate">{user ? 'Go to Dashboard' : 'Start Your Patent Journey'}</span>
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button 
                variant="professional" 
                size="lg"
                onClick={() => navigate('/demo')}
                className="text-base sm:text-lg h-12 sm:h-14 px-6 sm:px-8 w-full sm:w-auto"
              >
                <Play className="h-5 w-5" />
                Watch Demo
              </Button>
            </div>

            {/* Trust Indicators - stack on mobile */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-muted-foreground px-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>AI-Powered</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>Professional Grade</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>Secure & Private</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="py-12 sm:py-20 bg-muted/30">
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-elegant border-0 bg-card/80 backdrop-blur-sm overflow-hidden hover:shadow-glow transition-smooth cursor-pointer" onClick={() => navigate('/demo')}>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-primary opacity-5"></div>
                <CardHeader className="text-center pb-6 relative">
                  <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Play className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-2xl md:text-3xl mb-2">
                    See PatentBot AI™ in Action
                  </CardTitle>
                  <CardDescription className="text-lg">
                    Watch our interactive demo and discover how AI transforms your ideas into professional patents
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center relative">
                  <div className="mb-6">
                    {/* Demo features - stack on mobile */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-4">
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>AI-Guided Process</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>Real User Journey</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>2 Minute Demo</span>
                      </div>
                    </div>
                    
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-primary rounded-lg blur-lg opacity-20 group-hover:opacity-30 transition-smooth"></div>
                      <div className="relative bg-muted/20 rounded-lg p-8 border">
                        <div className="flex items-center justify-center gap-3 mb-4">
                          <img 
                            src="https://i.ibb.co/wrhwtf5P/Patent-Bot-AI-Logo-Transparent.png" 
                            alt="PatentBot AI Logo"
                            className="h-8 w-auto"
                          />
                          <span className="text-lg font-semibold">Interactive Demo</span>
                        </div>
                        <p className="text-muted-foreground mb-6">
                          Experience the complete patent application journey from idea to professional filing
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    variant="gradient" 
                    size="lg"
                    onClick={() => navigate('/demo')}
                    className="text-base sm:text-lg h-12 sm:h-14 px-6 sm:px-8 w-full sm:w-auto"
                  >
                    <Eye className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    Watch Demo Now
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-20">
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              How It Works
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Our AI-powered platform guides you through every step of the patent application process
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-5xl mx-auto">
            {/* Step 1 */}
            <Card className="shadow-elegant border-0 bg-card/80 backdrop-blur-sm text-center p-4 sm:p-0">
              <CardHeader className="p-4 sm:p-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Brain className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-lg sm:text-xl">AI Interview</CardTitle>
                <CardDescription className="text-sm">
                  Our AI conducts an intelligent interview to understand your invention thoroughly
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <ul className="text-xs sm:text-sm text-muted-foreground space-y-2 text-left">
                  <li>• Guided questioning process</li>
                  <li>• Technical detail extraction</li>
                  <li>• Innovation mapping</li>
                </ul>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className="shadow-elegant border-0 bg-card/80 backdrop-blur-sm text-center p-4 sm:p-0">
              <CardHeader className="p-4 sm:p-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-lg sm:text-xl">Prior Art Search</CardTitle>
                <CardDescription className="text-sm">
                  Comprehensive patent database search to identify similar inventions and assess novelty
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <ul className="text-xs sm:text-sm text-muted-foreground space-y-2 text-left">
                  <li>• Global patent database access</li>
                  <li>• Similarity analysis</li>
                  <li>• Novelty assessment</li>
                </ul>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card className="shadow-elegant border-0 bg-card/80 backdrop-blur-sm text-center p-4 sm:p-0 sm:col-span-2 md:col-span-1">
              <CardHeader className="p-4 sm:p-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-lg sm:text-xl">PatentBot AI™</CardTitle>
                <CardDescription className="text-sm">
                  Professional patent application generated with editable sections and real-time collaboration
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <ul className="text-xs sm:text-sm text-muted-foreground space-y-2 text-left">
                  <li>• Professional formatting</li>
                  <li>• Editable sections</li>
                  <li>• Ready for filing</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-12 sm:py-20 bg-muted/30">
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Choose the plan that fits your needs. No hidden fees.
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 md:gap-8 md:grid-cols-2 max-w-4xl mx-auto">
            {/* Patent Application */}
            <Card className="shadow-elegant border-2 border-primary/20 bg-card/80 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-primary"></div>
              <CardHeader className="text-center pb-2 p-4 sm:p-6">
                <Badge className="w-fit mx-auto mb-2 bg-primary/10 text-primary text-xs">Most Popular</Badge>
                <CardTitle className="text-xl sm:text-2xl">Patent Application</CardTitle>
                <CardDescription className="text-sm">Full AI-guided patent drafting</CardDescription>
              </CardHeader>
              <CardContent className="text-center p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="mb-4 sm:mb-6">
                  <span className="text-3xl sm:text-5xl font-bold">{PATENT_APPLICATION_PRICE_DISPLAY}</span>
                  <span className="text-sm sm:text-base text-muted-foreground ml-2">one-time</span>
                </div>
                <ul className="text-left space-y-2 sm:space-y-3 mb-4 sm:mb-6 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>AI-guided interview process</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Comprehensive prior art search</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Full patent draft (all sections)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>DOCX/PDF export for filing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Unlimited revisions</span>
                  </li>
                </ul>
                <Button 
                  variant="gradient" 
                  size="lg"
                  onClick={() => handleAuthNav('signup')}
                  className="w-full text-base sm:text-lg h-11 sm:h-12"
                >
                  {user ? 'Go to Dashboard' : 'Start Patent Application'}
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Check & See */}
            <Card className="shadow-elegant border-0 bg-card/80 backdrop-blur-sm">
              <CardHeader className="text-center pb-2 p-4 sm:p-6">
                <CardTitle className="text-xl sm:text-2xl">Check & See</CardTitle>
                <CardDescription className="text-sm">Prior patent search subscription</CardDescription>
              </CardHeader>
              <CardContent className="text-center p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="mb-4 sm:mb-6">
                  <span className="text-3xl sm:text-5xl font-bold">{CHECK_AND_SEE_PRICE_DISPLAY}</span>
                  <span className="text-sm sm:text-base text-muted-foreground ml-2">/month</span>
                </div>
                <ul className="text-left space-y-2 sm:space-y-3 mb-4 sm:mb-6 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Unlimited patent searches</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Similarity analysis reports</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Global patent database access</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>AI-powered novelty assessment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Cancel anytime</span>
                  </li>
                </ul>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => handleAuthNav('signup')}
                  className="w-full text-base sm:text-lg h-11 sm:h-12"
                >
                  {user ? 'Go to Dashboard' : 'Start Searching'}
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-12 sm:py-20">
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              Trusted by Innovators
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              See what our users say about PatentBot AI
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 md:gap-8 sm:grid-cols-2 md:grid-cols-3 max-w-5xl mx-auto">
            <Card className="shadow-elegant border-0 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-0.5 mb-3 sm:mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                    </svg>
                  ))}
                </div>
                <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
                  "PatentBot AI cut my patent drafting time by 80%. The AI interview process really helped me articulate my invention clearly."
                </p>
                <div className="font-semibold text-sm sm:text-base">Sarah M.</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Software Engineer & Inventor</div>
              </CardContent>
            </Card>

            <Card className="shadow-elegant border-0 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-0.5 mb-3 sm:mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                    </svg>
                  ))}
                </div>
                <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
                  "The prior art search saved me from filing a patent that already existed. Worth every penny for the Check & See subscription."
                </p>
                <div className="font-semibold text-sm sm:text-base">David K.</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Startup Founder</div>
              </CardContent>
            </Card>

            <Card className="shadow-elegant border-0 bg-card/80 backdrop-blur-sm sm:col-span-2 md:col-span-1">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-0.5 mb-3 sm:mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                    </svg>
                  ))}
                </div>
                <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
                  "Professional quality drafts at a fraction of the cost. My patent attorney was impressed with the thoroughness."
                </p>
                <div className="font-semibold text-sm sm:text-base">Jennifer L.</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Medical Device Inventor</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 bg-gradient-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-10"></div>
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center relative">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
            Ready to Protect Your Innovation?
          </h2>
          <p className="text-base sm:text-lg text-primary-foreground/80 mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
            Join thousands of inventors using AI to draft professional patent applications
          </p>
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row justify-center px-4">
            <Button 
              variant="secondary"
              size="lg"
              onClick={() => handleAuthNav('signup')}
              className="text-sm sm:text-base h-12 sm:h-14 px-6 sm:px-8 bg-white text-primary hover:bg-white/90 hover:shadow-glow transition-smooth w-full sm:w-auto"
            >
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="truncate">{user ? 'Go to Dashboard' : `Start Patent — ${PATENT_APPLICATION_PRICE_DISPLAY}`}</span>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            </Button>
            <Button 
              variant="secondary"
              size="lg"
              onClick={() => handleAuthNav('signup')}
              className="text-sm sm:text-base h-12 sm:h-14 px-6 sm:px-8 bg-white/10 text-white border-white/20 hover:bg-white/20 transition-smooth w-full sm:w-auto"
            >
              <span className="truncate">{user ? 'Check & See' : `Try Check & See — ${CHECK_AND_SEE_PRICE_DISPLAY_MO}`}</span>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 sm:py-8 border-t bg-card/50 backdrop-blur-sm">
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <p className="text-xs sm:text-sm text-muted-foreground">
            © {getCurrentYear()} PatentBot AI™. Professional patent drafting with AI assistance.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
