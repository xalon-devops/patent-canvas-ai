import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Crown, CheckCircle, Lock } from 'lucide-react';
import { EmbeddedStripeCheckout } from './EmbeddedStripeCheckout';
import { CHECK_AND_SEE_PRICE_DISPLAY_MONTHLY, PATENT_APPLICATION_PRICE_DISPLAY } from '@/lib/pricingConstants';
import { useUserProfile } from '@/contexts/UserProfileContext';

interface PaywallGateProps {
  children: React.ReactNode;
  userId: string;
  /** If set, a completed $1,000 payment for this application also grants access. */
  applicationId?: string;
  /** If true, always show children (for admins/free users) */
  bypassPaywall?: boolean;
}

/**
 * PaywallGate - Enforces payment before allowing access to protected content.
 *
 * Single definition of "has access" (matches ProtectedRoute / UserProfileContext):
 *   admin (user_roles) || free_grant || active/trialing paid subscription
 *   || (applicationId given && application_payments.status === 'completed')
 */
export const PaywallGate: React.FC<PaywallGateProps> = ({
  children,
  userId,
  applicationId,
  bypassPaywall = false
}) => {
  const navigate = useNavigate();
  const { access, refreshAccess } = useUserProfile();
  const [showCheckout, setShowCheckout] = useState(false);
  const [appPaid, setAppPaid] = useState<boolean | null>(applicationId ? null : false);

  useEffect(() => {
    if (!applicationId || !userId) {
      setAppPaid(false);
      return;
    }
    let cancelled = false;
    setAppPaid(null);
    supabase
      .from('application_payments')
      .select('status')
      .eq('application_id', applicationId)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('Error checking application payment:', error);
        setAppPaid(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, userId]);

  const hasAccess = bypassPaywall || access.isAdmin || access.isFreeGrant || access.isPaid || appPaid === true;
  const loading = !hasAccess && (!access.loaded || appPaid === null);

  const handlePaymentSuccess = () => {
    setShowCheckout(false);
    void refreshAccess(); // Re-check access after payment
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking your subscription...</p>
        </div>
      </div>
    );
  }

  // User has access - show children
  if (hasAccess) {
    return <>{children}</>;
  }

  // User needs to subscribe - show paywall
  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-elegant border-0 bg-card/90 backdrop-blur-sm">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary/10 rounded-full">
              <Lock className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Subscription Required</CardTitle>
          <CardDescription className="text-base">
            Subscribe to unlock full access to PatentBot™
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {!showCheckout ? (
            <>
              {/* Features included */}
              <div className="bg-muted/50 rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  What You Get
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Unlimited prior art searches</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>AI-powered patentability analysis</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Patent application drafting access</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>USPTO database integration</span>
                  </div>
                </div>
              </div>

              {/* Pricing card */}
              <div className="border-2 border-primary rounded-lg p-5 text-center">
                <div className="text-sm text-muted-foreground mb-1">Check & See Subscription</div>
                <div className="text-4xl font-bold text-primary mb-1">
                  {CHECK_AND_SEE_PRICE_DISPLAY_MONTHLY}
                </div>
                <div className="text-sm text-muted-foreground mb-4">
                  7-day free trial • Cancel anytime
                </div>
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={() => setShowCheckout(true)}
                >
                  Start Free Trial
                </Button>
              </div>

              {/* Alternative: Pay per application */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Or pay per patent application
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate('/new-application')}
                >
                  File Patent ({PATENT_APPLICATION_PRICE_DISPLAY})
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Secure payment powered by Stripe • Your data is protected
              </p>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Complete Your Subscription</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCheckout(false)}
                >
                  ← Back
                </Button>
              </div>
              <EmbeddedStripeCheckout
                mode="subscription"
                onSuccess={handlePaymentSuccess}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaywallGate;
