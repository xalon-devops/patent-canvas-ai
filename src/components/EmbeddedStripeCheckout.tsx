import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/stripeConfig';

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

interface EmbeddedStripeCheckoutProps {
  priceId?: string;
  planType?: string;
  applicationId?: string;
  mode?: 'subscription' | 'payment';
  onSuccess?: () => void;
}

export const EmbeddedStripeCheckout: React.FC<EmbeddedStripeCheckoutProps> = ({
  priceId,
  planType = 'premium',
  applicationId,
  mode = 'subscription',
  onSuccess
}) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchClientSecret = async () => {
      try {
        let data, error;
        
        if (mode === 'subscription') {
          const response = await supabase.functions.invoke('create-checkout', {
            body: { priceId, planType }
          });
          data = response.data;
          error = response.error;
        } else {
          const response = await supabase.functions.invoke('create-payment', {
            body: { applicationId }
          });
          data = response.data;
          error = response.error;
        }

        if (error) throw error;
        
        if (data?.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error('No client secret received');
        }
      } catch (err: any) {
        console.error('Checkout error:', err);
        toast({
          title: "Checkout Error",
          description: err.message || 'Failed to initialize checkout',
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchClientSecret();
  }, [priceId, planType, applicationId, mode, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="text-center p-12">
        <p className="text-destructive">Failed to load checkout. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ clientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
};
