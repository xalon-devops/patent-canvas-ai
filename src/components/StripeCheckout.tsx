import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmbeddedStripeCheckout } from './EmbeddedStripeCheckout';
import { CreditCard, Loader2 } from 'lucide-react';

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
  amount = 999,
  mode = 'subscription',
  className,
  children
}) => {
  const [showCheckout, setShowCheckout] = useState(false);

  return (
    <>
      <Button
        onClick={() => setShowCheckout(true)}
        className={className}
      >
        {children || (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            {mode === 'subscription' ? `Subscribe $${amount / 100}/mo` : `Pay $${amount / 100}`}
          </>
        )}
      </Button>

      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {mode === 'subscription' ? 'Complete Your Subscription' : 'Complete Payment'}
            </DialogTitle>
          </DialogHeader>
          <EmbeddedStripeCheckout
            priceId={priceId}
            planType={planType}
            applicationId={applicationId}
            mode={mode}
            onSuccess={() => setShowCheckout(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};