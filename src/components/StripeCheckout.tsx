import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CreditCard } from 'lucide-react';

interface StripeCheckoutProps {
  priceId?: string;
  planType?: string;
  applicationId?: string;
  amount?: number;
  mode?: 'subscription' | 'payment';
  className?: string;
  children?: React.ReactNode;
}

export const StripeCheckout: React.FC<StripeCheckoutProps> = ({
  priceId,
  planType = 'premium',
  applicationId,
  amount = 999, // Default $9.99 for subscription
  mode = 'subscription',
  className,
  children
}) => {
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  const handleCheckout = async () => {
    setLoading(true);
    
    try {
      let data, error;
      
      if (mode === 'subscription') {
        // Call create-checkout for subscriptions
        const response = await supabase.functions.invoke('create-checkout', {
          body: { priceId, planType }
        });
        data = response.data;
        error = response.error;
      } else {
        // Call create-payment for one-time payments
        const response = await supabase.functions.invoke('create-payment', {
          body: { applicationId }
        });
        data = response.data;
        error = response.error;
      }

      if (error) {
        throw new Error(error.message || 'Failed to create checkout session');
      }

      if (!data?.url) {
        throw new Error('No checkout URL received');
      }

      // Open Stripe checkout in a new tab (embedded branding)
      window.open(data.url, '_blank', 'width=800,height=600,scrollbars=yes');
      
      toast({
        title: "Redirecting to Stripe",
        description: "Opening secure payment window...",
        variant: "default",
      });

    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: "Checkout Error",
        description: error.message || 'Failed to start checkout process',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCheckout}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Processing...
        </>
      ) : (
        children || (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            {mode === 'subscription' ? `Subscribe $${amount / 100}/mo` : `Pay $${amount / 100}`}
          </>
        )
      )}
    </Button>
  );
};