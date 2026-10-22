import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Crown, Loader2 } from 'lucide-react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import AppBreadcrumbs from '@/components/AppBreadcrumbs';

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
  const location = useLocation();
  const { user, loading: authLoading, access } = useUserProfile();

  useEffect(() => {
    if (!authLoading && !user) {
      const next = location.pathname + location.search;
      navigate(`/auth?redirect=${encodeURIComponent(next)}`, { replace: true });
    }
  }, [authLoading, user, navigate, location.pathname, location.search]);

  const needsAccessCheck = requiresAdmin || requiresPremium;
  const accessLoading = !!user && needsAccessCheck && !access.loaded;
  const hasAccess = !needsAccessCheck
    || (requiresAdmin ? access.isAdmin : access.isAdmin || access.isPaid);

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

  return <><AppBreadcrumbs />{children}</>;
};

export default ProtectedRoute;
