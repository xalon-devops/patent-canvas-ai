import React, { useCallback, useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/stripeConfig';

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

interface EmbeddedStripeCheckoutProps {
  /** @deprecated Prices are resolved server-side; ignored. */
  priceId?: string;
  /** 'trademark_suite' selects the Trademark Suite checkout; anything else is Check & See. */
  planType?: string;
  applicationId?: string;
  mode?: 'subscription' | 'payment';
  /**
   * Called when there is nothing to pay (already subscribed / already paid).
   * A completed checkout redirects the whole page to /payment/return (return_url),
   * which verifies the payment and routes the user onward.
   */
  onSuccess?: () => void;
}

/** Extract the JSON body of a non-2xx edge-function response. */
async function readFunctionError(error: unknown): Promise<{ message: string; body?: { error?: string; alreadyPaid?: boolean; alreadySubscribed?: boolean } }> {
  const fallback = error instanceof Error ? error.message : 'Failed to initialize checkout';
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.clone().json();
      return { message: body?.error || fallback, body };
    } catch {
      /* not JSON */
    }
  }
  return { message: fallback };
}

export const EmbeddedStripeCheckout: React.FC<EmbeddedStripeCheckoutProps> = ({
  planType = 'check_and_see',
  applicationId,
  mode = 'subscription',
  onSuccess
}) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { toast } = useToast();

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    let cancelled = false;

    const fetchClientSecret = async () => {
      setLoading(true);
      setErrorMessage(null);
      setClientSecret(null);
      try {
        if (mode === 'payment' && !applicationId) {
          throw new Error('Missing application to pay for.');
        }
        const fnName = mode === 'payment'
          ? 'create-payment'
          : planType === 'trademark_suite' ? 'create-trademark-checkout' : 'create-checkout';
        const body = mode === 'payment' ? { applicationId } : { planType };

        const { data, error } = await supabase.functions.invoke(fnName, { body });
        if (cancelled) return;

        if (error) {
          const { message, body: errBody } = await readFunctionError(error);
          if (cancelled) return;
          if (errBody?.alreadyPaid || errBody?.alreadySubscribed) {
            toast({ title: errBody.alreadyPaid ? 'Already paid' : 'Already subscribed', description: message });
            setErrorMessage(message);
            onSuccess?.();
            return;
          }
          throw new Error(message);
        }

        if (data?.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error('No client secret received');
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to initialize checkout';
        console.error('Checkout error:', err);
        setErrorMessage(message);
        toast({
          title: "Checkout Error",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchClientSecret();
    return () => {
      cancelled = true;
    };
    // onSuccess intentionally omitted: callers pass inline callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planType, applicationId, mode, toast, attempt]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="text-center p-6 sm:p-12 space-y-4">
        <p className="text-destructive">{errorMessage || 'Failed to load checkout. Please try again.'}</p>
        <Button variant="outline" onClick={retry}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <EmbeddedCheckoutProvider
        key={clientSecret}
        stripe={stripePromise}
        options={{ clientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
};
