import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmbeddedStripeCheckout } from './EmbeddedStripeCheckout';
import { CreditCard, Loader2 } from 'lucide-react';

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
  const [showCheckout, setShowCheckout] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setShowCheckout(true)}
      >
        {children || (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            Pay ${amount / 100}
          </>
        )}
      </Button>

      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{description}</DialogTitle>
          </DialogHeader>
          <EmbeddedStripeCheckout
            applicationId={applicationId}
            mode="payment"
            onSuccess={() => setShowCheckout(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};