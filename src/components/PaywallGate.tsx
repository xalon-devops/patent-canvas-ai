import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Crown, Shield, CheckCircle, Lock } from 'lucide-react';
import { EmbeddedStripeCheckout } from './EmbeddedStripeCheckout';
import { CHECK_AND_SEE_PRICE_DISPLAY_MONTHLY, PATENT_APPLICATION_PRICE_DISPLAY, FREE_SEARCHES_LIMIT } from '@/lib/pricingConstants';
import { useAdminStatus } from '@/hooks/useAdminStatus';

interface PaywallGateProps {
  children: React.ReactNode;
  userId: string;
  /** If true, always show children (for admins/free users) */
  bypassPaywall?: boolean;
}

interface SubscriptionStatus {
  hasAccess: boolean;
  isAdmin: boolean;
  isFreeUser: boolean;
  plan: string;
  status: string;
}

/**
 * PaywallGate - Enforces subscription before allowing access to protected content
 * 
 * Flow:
 * 1. Check if user is admin (user_roles table) - bypass paywall
 * 2. Check if user has "free" grant from admin (subscriptions.plan = 'free_grant') - bypass paywall
 * 3. Check if user has active subscription - allow access
 * 4. Otherwise, show paywall with subscription options
 */
export const PaywallGate: React.FC<PaywallGateProps> = ({ 
  children, 
  userId,
  bypassPaywall = false 
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const adminStatus = useAdminStatus(userId);

  useEffect(() => {
    // If admin status is still loading, wait
    if (adminStatus.loading) return;
    
    // If user can bypass paywall (admin or free grant), grant access immediately
    if (bypassPaywall || adminStatus.canBypassPaywall) {
      setStatus({
        hasAccess: true,
        isAdmin: adminStatus.isAdmin,
        isFreeUser: adminStatus.isFreeGrant,
        plan: adminStatus.isAdmin ? 'admin' : 'free_grant',
        status: 'active'
      });
      setLoading(false);
      return;
    }

    checkAccess();
  }, [userId, bypassPaywall, adminStatus.loading, adminStatus.canBypassPaywall]);

  const checkAccess = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Check admin role first
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (adminRole) {
        setStatus({
          hasAccess: true,
          isAdmin: true,
          isFreeUser: false,
          plan: 'admin',
          status: 'active'
        });
        setLoading(false);
        return;
      }

      // Check subscription status
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status, plan')
        .eq('user_id', userId)
        .maybeSingle();

      // Check for free_grant (admin-designated free user)
      if (subscription?.plan === 'free_grant' && subscription?.status === 'active') {
        setStatus({
          hasAccess: true,
          isAdmin: false,
          isFreeUser: true,
          plan: 'free_grant',
          status: 'active'
        });
        setLoading(false);
        return;
      }

      // Check for active paid subscription
      const hasActiveSubscription = 
        subscription?.status === 'active' && 
        subscription?.plan !== 'free' &&
        subscription?.plan !== 'inactive';

      setStatus({
        hasAccess: hasActiveSubscription,
        isAdmin: false,
        isFreeUser: false,
        plan: subscription?.plan || 'free',
        status: subscription?.status || 'inactive'
      });

    } catch (error) {
      console.error('Error checking paywall access:', error);
      setStatus({
        hasAccess: false,
        isAdmin: false,
        isFreeUser: false,
        plan: 'error',
        status: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowCheckout(false);
    checkAccess(); // Re-check access after payment
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
  if (status?.hasAccess) {
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
