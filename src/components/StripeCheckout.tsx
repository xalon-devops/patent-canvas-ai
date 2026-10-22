import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmbeddedStripeCheckout } from './EmbeddedStripeCheckout';
import { CreditCard } from 'lucide-react';
import { CHECK_AND_SEE_PRICE_CENTS, formatPrice } from '@/lib/pricingConstants';

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
  planType = 'check_and_see',
  applicationId,
  amount = CHECK_AND_SEE_PRICE_CENTS,
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
            {mode === 'subscription' ? `Subscribe ${formatPrice(amount)}/mo` : `Pay ${formatPrice(amount)}`}
          </>
        )}
      </Button>

      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {mode === 'subscription' ? 'Complete Your Subscription' : 'Complete Payment'}
            </DialogTitle>
          </DialogHeader>
          <EmbeddedStripeCheckout
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