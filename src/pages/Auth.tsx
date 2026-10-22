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

const APP_DOMAIN = "https://patentbot-ai.com";

/** Only same-origin relative paths ("/x", not "//x" or "/\\x") are honoured as post-login targets. */
const getSafeRedirect = (raw: string | null): string => {
  if (!raw) return '/dashboard';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/dashboard';
  if (raw.startsWith('/auth') || raw.startsWith('/reset-password')) return '/dashboard';
  return raw;
};

const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'signin';
  const authType = searchParams.get('type');
  const redirectTo = getSafeRedirect(searchParams.get('redirect'));
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Surface errors Supabase puts in the URL hash for expired/invalid email links
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const errDesc = hash.get('error_description') || searchParams.get('error_description');
    if (errDesc) {
      const expired = (hash.get('error_code') || searchParams.get('error_code')) === 'otp_expired';
      toast({
        title: expired ? 'Link expired' : 'Sign-in link problem',
        description: expired ? 'That email link has expired or was already used. Please request a new one.' : errDesc.replace(/\+/g, ' '),
        variant: 'destructive',
      });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    if (authType === 'confirmed') {
      toast({ title: "Email Verified!", description: "Your email has been verified." });
      // Send welcome email on first confirmation (fire and forget; server dedupes and
      // always sends to the signed-in user's own address)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          supabase.functions.invoke('send-email', { body: { type: 'welcome' } }).catch(() => {});
        }
      });
    } else if (authType === 'recovery') {
      // Redirect to dedicated reset password page
      navigate('/reset-password', { replace: true });
      return;
    }
  }, [authType, toast, navigate]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // PASSWORD_RECOVERY must land on the reset page, not the dashboard
      if (event === 'PASSWORD_RECOVERY') { navigate('/reset-password', { replace: true }); return; }
      if (session?.user) navigate(redirectTo, { replace: true });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user && authType !== 'recovery') navigate(redirectTo, { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate, redirectTo, authType]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    trackSignupStart();
    try {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${APP_DOMAIN}/auth?type=confirmed${redirectTo !== '/dashboard' ? `&redirect=${encodeURIComponent(redirectTo)}` : ''}` } });
      if (error) {
        toast({ title: error.message.includes('already registered') ? "Account exists" : "Sign up failed", description: error.message.includes('already registered') ? "This email is already registered. Please sign in instead." : error.message, variant: error.message.includes('already registered') ? "default" : "destructive" });
      } else if (data.user && !data.session) {
        trackSignupComplete(data.user.id, email);
        try { await supabase.functions.invoke('send-email-confirmation', { body: { email, type: 'signup' } }); } catch { /* Supabase's own confirmation email is the fallback */ }
        toast({ title: "Check your email", description: "We've sent you a confirmation link. Open it on this device to finish signing up." });
      } else if (data.user && data.session) {
        trackSignupComplete(data.user.id, email);
        // Send welcome email (fire and forget)
        supabase.functions.invoke('send-email', { body: { type: 'welcome' } }).catch(() => {});
      }
    } catch {
      toast({ title: "Sign up failed", description: "An unexpected error occurred.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast({ title: "Sign in failed", description: error.message, variant: "destructive" }); }
      else if (data.user) { trackLogin(data.user.id, email); }
    } catch {
      toast({ title: "Sign in failed", description: "An unexpected error occurred.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-password-reset', { body: { email } });
      if (error) throw error;
      setResetEmailSent(true);
      toast({ title: "Reset email sent!", description: "Check your inbox for a password reset link." });
    } catch {
      const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${APP_DOMAIN}/reset-password` });
      if (supabaseError) { toast({ title: "Failed to send reset email", description: supabaseError.message, variant: "destructive" }); }
      else { setResetEmailSent(true); toast({ title: "Reset email sent!", description: "Check your inbox for a password reset link." }); }
    } finally { setLoading(false); }
  };

  const handleMagicLink = async () => {
    if (!email) { toast({ title: "Email required", description: "Please enter your email address first.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-magic-link', { body: { email, redirectPath: redirectTo } });
      if (error) throw error;
      toast({ title: "Magic link sent!", description: "Check your inbox for a sign-in link." });
    } catch {
      const { error: supabaseError } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${APP_DOMAIN}${redirectTo}` } });
      if (supabaseError) { toast({ title: "Failed to send magic link", description: supabaseError.message, variant: "destructive" }); }
      else { toast({ title: "Magic link sent!", description: "Check your inbox for a sign-in link." }); }
    } finally { setLoading(false); }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <PageSEO.Auth />
        <div className="w-full max-w-md">
          <Button variant="ghost" size="sm" onClick={() => { setShowForgotPassword(false); setResetEmailSent(false); }} className="mb-6 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Sign In
          </Button>
          <div className="bg-card border border-border rounded-2xl p-8" style={{ boxShadow: 'var(--shadow-elegant)' }}>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Reset Password</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {resetEmailSent ? "Check your email for a reset link" : "Enter your email to receive a reset link"}
              </p>
            </div>
            {resetEmailSent ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground text-sm mb-4">We've sent a password reset link to <strong className="text-foreground">{email}</strong></p>
                <Button variant="outline" onClick={() => { setResetEmailSent(false); setEmail(''); }} className="rounded-xl">Send to different email</Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-sm font-medium">Email</Label>
                  <Input id="reset-email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl h-11" />
                </div>
                <Button type="submit" className="w-full btn-dark h-11 rounded-xl" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <PageSEO.Auth />
      <div className="w-full max-w-md">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="mb-6 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Home
        </Button>

        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src="https://i.ibb.co/nsLWZ3sr/Patent-Bot-Logo-1.png" 
            alt="PatentBot AI"
            className="h-12 w-auto mx-auto mb-3"
          />
          <p className="text-muted-foreground text-sm">Intelligent patent drafting made simple</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8" style={{ boxShadow: 'var(--shadow-elegant)' }}>
          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span>Professional Drafting</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Brain className="h-3.5 w-3.5" />
              <span>AI Powered</span>
            </div>
          </div>
          
          <Tabs defaultValue={initialTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 rounded-xl bg-muted h-10">
              <TabsTrigger value="signin" className="rounded-lg text-sm">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-lg text-sm">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-sm font-medium">Email</Label>
                  <Input id="signin-email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password" className="text-sm font-medium">Password</Label>
                    <button type="button" onClick={() => setShowForgotPassword(true)} className="text-xs text-primary hover:underline">Forgot password?</button>
                  </div>
                  <Input id="signin-password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl h-11" />
                </div>
                <Button type="submit" className="w-full btn-dark h-11 rounded-xl mt-2" disabled={loading}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </Button>
                
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground">Or</span></div>
                </div>
                
                <Button type="button" variant="outline" className="w-full rounded-xl h-11 border-border" onClick={handleMagicLink} disabled={loading}>
                  <Mail className="h-4 w-4 mr-2" />Sign in with Magic Link
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm font-medium">Email</Label>
                  <Input id="signup-email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
                  <Input id="signup-password" type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-xl h-11" />
                </div>
                <Button type="submit" className="w-full btn-dark h-11 rounded-xl mt-2" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center mt-6 text-xs text-muted-foreground">
          Professional patent drafting with AI assistance
        </p>
      </div>
    </div>
  );
};

export default Auth;
