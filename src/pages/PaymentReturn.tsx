import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, ArrowRight, FileText, Search, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PATENT_APPLICATION_PRICE_DISPLAY, CHECK_AND_SEE_PRICE_DISPLAY_MONTHLY, TRADEMARK_SEARCH_PRICE_DISPLAY_MO } from '@/lib/pricingConstants';
import { PageSEO } from '@/components/SEO';
import { useUserProfile } from '@/contexts/UserProfileContext';

type PaymentStatus = 'verifying' | 'success' | 'error' | 'processing' | 'cancelled';
type PaymentType = 'payment' | 'subscription' | null;

/** How long to keep polling a 'processing' payment before handing control back to the user. */
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 10;

/** Pull the JSON error body out of a non-2xx edge-function response. */
async function functionErrorMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : 'Could not verify payment.';
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.clone().json();
      if (body?.error) return body.error as string;
    } catch {
      /* not JSON */
    }
  }
  return fallback;
}

export default function PaymentReturn() {
  const [status, setStatus] = useState<PaymentStatus>('verifying');
  const [paymentType, setPaymentType] = useState<PaymentType>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [alreadyProcessed, setAlreadyProcessed] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [pollsExhausted, setPollsExhausted] = useState(false);
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshAccess } = useUserProfile();
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCount = useRef(0);
  const unmounted = useRef(false);

  const verifyPayment = useCallback(async () => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }

    if (!sessionId) {
      setStatus('error');
      setErrorDetail('No payment session found in the link. If you completed a payment, check your dashboard or email.');
      return;
    }

    try {
      // Edge function confirms the session with Stripe and that it belongs to this user.
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { sessionId }
      });
      if (unmounted.current) return;

      if (error) {
        const message = await functionErrorMessage(error);
        if (unmounted.current) return;
        console.error('Error verifying payment:', message);
        setStatus('error');
        setErrorDetail(message);
        return;
      }

      setPaymentType(data?.type ?? null);
      if (data?.payment?.applicationId) setApplicationId(data.payment.applicationId);
      if (data?.subscription?.plan) setPlan(data.subscription.plan);

      if (data?.success) {
        setStatus('success');
        setAlreadyProcessed(!!data.alreadyProcessed);
        // Update headers / route guards / paywalls without a full reload.
        await refreshAccess();
        return;
      }

      if (data?.status === 'open' || data?.status === 'expired') {
        setStatus('cancelled');
        return;
      }

      // Still processing (async payment method or webhook lag): poll, but not forever.
      setStatus('processing');
      pollCount.current += 1;
      if (pollCount.current < MAX_POLLS) {
        setPollsExhausted(false);
        pollTimer.current = setTimeout(verifyPayment, POLL_INTERVAL_MS);
      } else {
        setPollsExhausted(true);
      }
    } catch (error) {
      if (unmounted.current) return;
      console.error('Error verifying payment:', error);
      setStatus('error');
      setErrorDetail('Could not verify payment status. Please try again or contact support.');
    }
  }, [sessionId, refreshAccess]);

  useEffect(() => {
    unmounted.current = false;
    pollCount.current = 0;
    verifyPayment();
    return () => {
      unmounted.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
    // Run once per session id; refreshAccess identity changes must not re-verify.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // One toast per outcome.
  useEffect(() => {
    if (status === 'success') {
      toast(paymentType === 'payment'
        ? { title: "Payment Successful!", description: "Your patent application payment has been processed. You can now export your documents." }
        : { title: "Subscription Activated!", description: "Your subscription is now active." });
    } else if (status === 'error') {
      toast({ title: "Verification Error", description: "Could not verify payment. See details on the page.", variant: "destructive" });
    }
  }, [status, paymentType, toast]);

  const retryVerification = () => {
    pollCount.current = 0;
    setPollsExhausted(false);
    setStatus('verifying');
    verifyPayment();
  };

  const isTrademark = plan === 'trademark_suite';

  const handleContinue = () => {
    if (paymentType === 'payment' && applicationId) {
      navigate(`/session/${applicationId}`);
    } else if (paymentType === 'subscription') {
      navigate(isTrademark ? '/trademark-check' : '/check');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <PageSEO.PaymentReturn />
      <Card className="max-w-lg w-full shadow-elegant">
        {status === 'verifying' && (
          <>
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
              </div>
              <CardTitle className="text-2xl">Verifying Payment</CardTitle>
              <CardDescription>
                Please wait while we confirm your payment with our payment processor...
              </CardDescription>
            </CardHeader>
          </>
        )}

        {status === 'success' && (
          <>
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3">
                  <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <CardTitle className="text-2xl">{alreadyProcessed ? 'Already Paid' : 'Payment Successful!'}</CardTitle>
              <CardDescription>
                {paymentType === 'payment' 
                  ? `Your ${PATENT_APPLICATION_PRICE_DISPLAY} patent application payment has been processed.`
                  : isTrademark
                    ? `Your ${TRADEMARK_SEARCH_PRICE_DISPLAY_MO} Trademark Suite subscription is now active.`
                    : `Your ${CHECK_AND_SEE_PRICE_DISPLAY_MONTHLY} Check & See subscription is now active.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                {paymentType === 'payment' ? (
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Your patent application is ready for export</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Download professional DOCX and PDF formats</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>USPTO-ready formatting included</span>
                    </li>
                  </ul>
                ) : (
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{isTrademark ? 'Unlimited trademark searches' : 'Unlimited patent searches'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{isTrademark ? 'Likelihood-of-confusion analysis with AI' : 'Prior art analysis with AI'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Manage subscription anytime</span>
                    </li>
                  </ul>
                )}
              </div>
              <Button onClick={handleContinue} className="w-full" size="lg">
                {paymentType === 'payment' ? (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Continue to Patent Application
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    {isTrademark ? 'Start Searching Trademarks' : 'Start Searching Patents'}
                  </>
                )}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </>
        )}

        {status === 'error' && (
          <>
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-destructive/10 p-3">
                  <XCircle className="h-16 w-16 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-2xl">Payment Verification Failed</CardTitle>
              <CardDescription>
                We couldn't verify your payment. This may be temporary.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorDetail && (
                <p className="text-sm text-destructive text-center break-words">{errorDetail}</p>
              )}
              <p className="text-sm text-muted-foreground">
                If you've been charged, don't worry - your payment will be verified shortly. Check your email for confirmation or contact our support team.
              </p>
              <div className="space-y-2">
                {sessionId && (
                  <Button onClick={retryVerification} variant="outline" className="w-full">
                    Try Again
                  </Button>
                )}
                <Button onClick={() => navigate('/dashboard')} className="w-full">
                  Go to Dashboard
                </Button>
                <Button 
                  onClick={() => window.location.href = 'mailto:support@patentbot.ai'}
                  variant="outline" 
                  className="w-full"
                >
                  Contact Support
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {status === 'processing' && (
          <>
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                {pollsExhausted
                  ? <Clock className="h-16 w-16 text-primary" />
                  : <Loader2 className="h-16 w-16 animate-spin text-primary" />}
              </div>
              <CardTitle className="text-2xl">Payment Processing</CardTitle>
              <CardDescription>
                Your payment has been received and is being processed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm text-center">
                {pollsExhausted
                  ? "This is taking longer than usual (some payment methods take a few days to clear). We'll email you once it's confirmed — you can safely leave this page."
                  : 'Checking with our payment processor. This page updates automatically.'}
              </p>
              <div className="space-y-2">
                <Button onClick={retryVerification} variant="outline" className="w-full">
                  Refresh Status
                </Button>
                <Button onClick={() => navigate('/dashboard')} variant="ghost" className="w-full">
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {status === 'cancelled' && (
          <>
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-muted p-3">
                  <XCircle className="h-16 w-16 text-muted-foreground" />
                </div>
              </div>
              <CardTitle className="text-2xl">Checkout Not Completed</CardTitle>
              <CardDescription>
                Your checkout was cancelled or has expired. You have not been charged.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={() => navigate(paymentType === 'subscription' ? '/check' : applicationId ? `/session/${applicationId}` : '/pricing')}
                className="w-full"
              >
                Try Again
              </Button>
              <Button onClick={() => navigate('/dashboard')} variant="outline" className="w-full">
                Go to Dashboard
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
