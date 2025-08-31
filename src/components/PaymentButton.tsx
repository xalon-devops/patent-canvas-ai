import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CreditCard } from 'lucide-react';

interface PaymentButtonProps {
  applicationId: string;
  amount: number;
  description: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: React.ReactNode;
}

export const PaymentButton: React.FC<PaymentButtonProps> = ({
  applicationId,
  amount,
  description,
  variant = "default",
  size = "default",
  className,
  children
}) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePayment = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { applicationId }
      });

      if (error) {
        throw new Error(error.message || 'Failed to create payment session');
      }

      if (!data?.url) {
        throw new Error('No payment URL received');
      }

      // Open Stripe checkout in a new tab (embedded style)
      window.open(data.url, '_blank');
      
      toast({
        title: "Payment Started",
        description: "Redirecting to secure payment...",
        variant: "default",
      });

    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Error",
        description: error.message || 'Failed to start payment process',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handlePayment}
      disabled={loading}
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
            Pay ${amount / 100}
          </>
        )
      )}
    </Button>
  );
};