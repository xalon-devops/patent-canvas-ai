import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Scale, FileText, Brain, ArrowLeft, Mail } from 'lucide-react';
import { PageSEO } from '@/components/SEO';
import { trackSignupStart, trackSignupComplete, trackLogin } from '@/hooks/useFunnelTracking';

// Production app domain - always use this for redirects
const APP_DOMAIN = "https://patentbot-ai.com";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'signin';
  const authType = searchParams.get('type');
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Show success message if user just confirmed email
    if (authType === 'confirmed') {
      toast({
        title: "Email Verified!",
        description: "Your email has been verified. You can now sign in.",
      });
    } else if (authType === 'recovery') {
      toast({
        title: "Reset Your Password",
        description: "Enter your new password below.",
      });
    }
  }, [authType, toast]);

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
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Track signup attempt
    trackSignupStart();

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${APP_DOMAIN}/auth?type=confirmed`
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast({
            title: "Account exists",
            description: "This email is already registered. Please sign in instead.",
          });
        } else {
          toast({
            title: "Sign up failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else if (data.user && !data.session) {
        // Track successful signup (email confirmation pending)
        trackSignupComplete(data.user.id, email);
        
        // Send custom branded confirmation email
        try {
          await supabase.functions.invoke('send-email-confirmation', {
            body: { email, type: 'signup' }
          });
        } catch (emailError) {
          console.log('Custom email failed, using default:', emailError);
        }
        
        toast({
          title: "Check your email",
          description: "We've sent you a confirmation link to complete your registration.",
        });
      } else if (data.user && data.session) {
        // User auto-confirmed (e.g., dev environment)
        trackSignupComplete(data.user.id, email);
      }
    } catch (error) {
      toast({
        title: "Sign up failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "destructive",
        });
      } else if (data.user) {
        // Track successful login
        trackLogin(data.user.id, email);
      }
    } catch (error) {
      toast({
        title: "Sign in failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      // Use our custom branded password reset email
      const { error } = await supabase.functions.invoke('send-password-reset', {
        body: { email }
      });

      if (error) {
        throw error;
      }

      setResetEmailSent(true);
      toast({
        title: "Reset email sent!",
        description: "Check your inbox for a password reset link.",
      });
    } catch (error: any) {
      // Fallback to Supabase default if custom fails
      const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${APP_DOMAIN}/auth?type=recovery`,
      });
      
      if (supabaseError) {
        toast({
          title: "Failed to send reset email",
          description: supabaseError.message,
          variant: "destructive",
        });
      } else {
        setResetEmailSent(true);
        toast({
          title: "Reset email sent!",
          description: "Check your inbox for a password reset link.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address first.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      // Use our custom branded magic link email
      const { error } = await supabase.functions.invoke('send-magic-link', {
        body: { email }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Magic link sent!",
        description: "Check your inbox for a sign-in link.",
      });
    } catch (error: any) {
      // Fallback to Supabase default if custom fails
      const { error: supabaseError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${APP_DOMAIN}/dashboard`,
        },
      });
      
      if (supabaseError) {
        toast({
          title: "Failed to send magic link",
          description: supabaseError.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Magic link sent!",
          description: "Check your inbox for a sign-in link.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password View
  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <PageSEO.Auth />
        <div className="w-full max-w-md">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowForgotPassword(false);
              setResetEmailSent(false);
            }}
            className="mb-4 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sign In
          </Button>

          <Card className="shadow-elegant border-0 bg-card/80 backdrop-blur-sm">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-primary/10 rounded-full p-4">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl">Reset Password</CardTitle>
              <CardDescription>
                {resetEmailSent 
                  ? "Check your email for a reset link"
                  : "Enter your email to receive a reset link"
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {resetEmailSent ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">
                    We've sent a password reset link to <strong>{email}</strong>
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResetEmailSent(false);
                      setEmail('');
                    }}
                  >
                    Send to different email
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="transition-smooth focus:shadow-glow/20"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-primary hover:shadow-glow transition-smooth"
                    disabled={loading}
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <PageSEO.Auth />
      <div className="w-full max-w-md">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="mb-4 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-primary rounded-xl blur-lg opacity-20"></div>
              <div className="relative bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <img 
                  src="https://i.ibb.co/nsLWZ3sr/Patent-Bot-Logo-1.png" 
                  alt="PatentBot AI"
                  className="h-14 w-auto"
                />
              </div>
            </div>
          </div>
          <p className="text-muted-foreground">
            Intelligent patent drafting made simple
          </p>
        </div>

        <Card className="shadow-elegant border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-6 mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Professional Drafting</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Brain className="h-4 w-4" />
                <span>AI Powered</span>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <Tabs defaultValue={initialTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="transition-smooth focus:shadow-glow/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Password</Label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="transition-smooth focus:shadow-glow/20"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full mt-6 bg-gradient-primary hover:shadow-glow transition-smooth"
                    disabled={loading}
                  >
                    {loading ? 'Signing In...' : 'Sign In'}
                  </Button>
                  
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleMagicLink}
                    disabled={loading}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Sign in with Magic Link
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="transition-smooth focus:shadow-glow/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="transition-smooth focus:shadow-glow/20"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full mt-6 bg-gradient-primary hover:shadow-glow transition-smooth"
                    disabled={loading}
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>Professional patent drafting with AI assistance</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;