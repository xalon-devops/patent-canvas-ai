import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Crown, Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresPremium?: boolean;
  requiresAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiresPremium = false, 
  requiresAdmin = false 
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessType, setAccessType] = useState<'premium' | 'admin' | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/auth');
        } else {
          checkUserAccess(session.user.id);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/auth');
      } else {
        checkUserAccess(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, requiresPremium, requiresAdmin]);

  const checkUserAccess = async (userId: string) => {
    try {
      // If no special access is required, just allow authenticated users
      if (!requiresAdmin && !requiresPremium) {
        setHasAccess(true);
        setAccessType(null);
        setLoading(false);
        return;
      }

      let userHasAccess = true;
      let userAccessType: 'premium' | 'admin' | null = null;

      // Check admin access if required
      if (requiresAdmin) {
        const { data: adminData, error: adminError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();

        if (adminError) {
          console.error('Error checking admin role:', adminError);
          userHasAccess = false;
        } else if (adminData) {
          userHasAccess = true;
          userAccessType = 'admin';
        } else {
          userHasAccess = false;
        }
      } 
      // Check premium access if required
      else if (requiresPremium) {
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('status, plan')
          .eq('user_id', userId)
          .maybeSingle();

        if (subscriptionError) {
          console.error('Error checking subscription:', subscriptionError);
          userHasAccess = false;
        } else if (subscriptionData?.status === 'active' && subscriptionData?.plan !== 'free') {
          userHasAccess = true;
          userAccessType = 'premium';
        } else {
          userHasAccess = false;
        }
      }

      setHasAccess(userHasAccess);
      setAccessType(userAccessType);
    } catch (error: any) {
      console.error('Error checking user access:', error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
            <p className="text-muted-foreground mb-4">
              Please sign in to access this page.
            </p>
            <Button onClick={() => navigate('/auth')}>
              Sign In
            </Button>
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
              <Button onClick={() => navigate('/dashboard')}>
                Return to Dashboard
              </Button>
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