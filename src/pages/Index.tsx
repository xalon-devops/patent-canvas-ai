import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Scale, FileText, Brain, Zap, CheckCircle, ArrowRight, Sparkles, Play, Eye } from 'lucide-react';

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
        
        if (session?.user) {
          navigate('/dashboard');
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        navigate('/dashboard');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-5"></div>
        <div className="container mx-auto px-4 py-20 relative">
          <div className="text-center max-w-4xl mx-auto">
            {/* Logo */}
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-primary rounded-2xl blur-xl opacity-30"></div>
                <div className="relative bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <img 
                    src="https://i.ibb.co/wrhwtf5P/Patent-Bot-AI-Logo-Transparent.png?v=2" 
                    alt="PatentBot AI Logo"
                    className="h-16 w-auto"
                  />
                </div>
              </div>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                PatentBot AI™
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
              Transform your innovative ideas into professional patent applications 
              with AI-powered assistance and intelligent prior art analysis
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button 
                variant="gradient" 
                size="lg"
                onClick={() => navigate('/auth')}
                className="text-lg h-14 px-8"
              >
                <Sparkles className="h-5 w-5" />
                Start Your Patent Journey
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button 
                variant="professional" 
                size="lg"
                onClick={() => navigate('/demo')}
                className="text-lg h-14 px-8"
              >
                <Play className="h-5 w-5" />
                Watch Demo
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>AI-Powered</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Professional Grade</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Secure & Private</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
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
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>AI-Guided Process</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Real User Journey</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500" />
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
                    className="text-lg h-14 px-8 group"
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
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our AI-powered platform guides you through every step of the patent application process
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Step 1 */}
            <Card className="shadow-elegant border-0 bg-card/80 backdrop-blur-sm text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Brain className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl">AI Interview</CardTitle>
                <CardDescription>
                  Our AI conducts an intelligent interview to understand your invention thoroughly
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Guided questioning process</li>
                  <li>• Technical detail extraction</li>
                  <li>• Innovation mapping</li>
                </ul>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className="shadow-elegant border-0 bg-card/80 backdrop-blur-sm text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl">Prior Art Search</CardTitle>
                <CardDescription>
                  Comprehensive patent database search to identify similar inventions and assess novelty
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Global patent database access</li>
                  <li>• Similarity analysis</li>
                  <li>• Novelty assessment</li>
                </ul>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card className="shadow-elegant border-0 bg-card/80 backdrop-blur-sm text-center">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-xl">PatentBot AI™</CardTitle>
                <CardDescription>
                  Professional patent application generated with editable sections and real-time collaboration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Professional formatting</li>
                  <li>• Editable sections</li>
                  <li>• Ready for filing</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-glow opacity-10"></div>
        <div className="container mx-auto px-4 text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Protect Your Innovation?
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
            Join thousands of inventors who trust PatentBot AI™ to transform their ideas into professional patent applications
          </p>
          <Button 
            variant="secondary"
            size="lg"
            onClick={() => navigate('/auth')}
            className="text-lg h-14 px-8 bg-white/10 text-white border-white/20 hover:bg-white/20 hover:shadow-glow transition-smooth"
          >
            <Sparkles className="h-5 w-5" />
            Get Started Free
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            © 2024 PatentBot AI™. Professional patent drafting with AI assistance.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
