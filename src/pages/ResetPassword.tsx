import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Lock, CheckCircle, Loader2 } from 'lucide-react';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if we arrived here via a recovery link (Supabase sets the session automatically)
    const checkRecoverySession = async () => {
      // Check URL hash for recovery token (Supabase puts type=recovery in the hash)
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace('#', ''));
      const type = params.get('type');
      const accessToken = params.get('access_token');

      if (type === 'recovery' && accessToken) {
        // Supabase will have already set the session via the hash
        // Wait briefly for onAuthStateChange to fire
        const { data: { session } } = await supabase.auth.getSession();
        setValidSession(!!session);
      } else {
        // Also check if user has an active session (maybe redirected from auth?type=recovery)
        const { data: { session } } = await supabase.auth.getSession();
        setValidSession(!!session);
      }
    };

    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true);
      }
    });

    checkRecoverySession();

    return () => subscription.unsubscribe();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: 'Passwords don\'t match', description: 'Please make sure both passwords are identical.', variant: 'destructive' });
      return;
    }

    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'Password must be at least 6 characters.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      toast({ title: 'Password updated!', description: 'Your password has been successfully reset.' });

      // Redirect to dashboard after a brief delay
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (error: any) {
      toast({ title: 'Reset failed', description: error.message || 'Failed to update password.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Still checking session
  if (validSession === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  // No valid session
  if (!validSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl p-8 text-center" style={{ boxShadow: 'var(--shadow-elegant)' }}>
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Invalid or Expired Link</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Button onClick={() => navigate('/auth')} className="w-full btn-dark h-11 rounded-xl">
              Back to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl p-8 text-center" style={{ boxShadow: 'var(--shadow-elegant)' }}>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Password Updated!</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your password has been successfully reset. Redirecting to dashboard...
            </p>
            <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // Password reset form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Button variant="ghost" size="sm" onClick={() => navigate('/auth')} className="mb-6 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Sign In
        </Button>

        <div className="bg-card border border-border rounded-2xl p-8" style={{ boxShadow: 'var(--shadow-elegant)' }}>
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Set New Password</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your new password below
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="rounded-xl h-11"
              />
            </div>
            <Button type="submit" className="w-full btn-dark h-11 rounded-xl" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
