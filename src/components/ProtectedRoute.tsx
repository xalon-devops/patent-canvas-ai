import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Crown, Loader2 } from 'lucide-react';
import { useUserProfile } from '@/contexts/UserProfileContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresPremium?: boolean;
  requiresAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiresPremium = false,
  requiresAdmin = false,
}) => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useUserProfile();

  const [accessLoading, setAccessLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessType, setAccessType] = useState<'premium' | 'admin' | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (authLoading) {
        setAccessLoading(true);
        return;
      }

      if (!user) {
        setHasAccess(false);
        setAccessType(null);
        setAccessLoading(false);
        navigate('/auth');
        return;
      }

      // Auth-only routes: no DB checks needed
      if (!requiresAdmin && !requiresPremium) {
        setHasAccess(true);
        setAccessType(null);
        setAccessLoading(false);
        return;
      }

      setAccessLoading(true);

      try {
        let allowed = false;
        let type: 'premium' | 'admin' | null = null;

        if (requiresAdmin) {
          const { data, error } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .maybeSingle();

          if (!error && data) {
            allowed = true;
            type = 'admin';
          }
        } else if (requiresPremium) {
          const { data, error } = await supabase
            .from('subscriptions')
            .select('status, plan')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!error && data?.status === 'active' && data?.plan !== 'free') {
            allowed = true;
            type = 'premium';
          }
        }

        if (cancelled) return;
        setHasAccess(allowed);
        setAccessType(type);
      } catch (e) {
        if (cancelled) return;
        setHasAccess(false);
        setAccessType(null);
      } finally {
        if (cancelled) return;
        setAccessLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, requiresAdmin, requiresPremium, navigate]);

  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking access permissions...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground mb-4">Please sign in to access this page.</p>
            <Button onClick={() => navigate('/auth')}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasAccess) {
    if (requiresAdmin) {
      return (
        <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
          <Card className="w-96">
            <CardContent className="p-8 text-center">
              <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
              <p className="text-muted-foreground mb-4">
                You need administrator privileges to access this page.
              </p>
              <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (requiresPremium) {
      return (
        <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
          <Card className="w-96">
            <CardContent className="p-8 text-center">
              <Crown className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Premium Required</h2>
              <p className="text-muted-foreground mb-4">
                Upgrade to Premium to access unlimited patent applications and advanced features.
              </p>
              <div className="space-y-2">
                <Button onClick={() => navigate('/pricing')} className="w-full">
                  Upgrade to Premium
                </Button>
                <Button variant="outline" onClick={() => navigate('/dashboard')} className="w-full">
                  Return to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
