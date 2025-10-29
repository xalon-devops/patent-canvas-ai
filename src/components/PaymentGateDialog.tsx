import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EmbeddedStripeCheckout } from './EmbeddedStripeCheckout';
import { Lock, FileText, DollarSign, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  onPaymentSuccess: () => void;
}

export const PaymentGateDialog: React.FC<PaymentGateDialogProps> = ({
  open,
  onOpenChange,
  applicationId,
  onPaymentSuccess
}) => {
  const [showCheckout, setShowCheckout] = useState(false);

  // Admin override: auto-close and signal success for admin email
  useEffect(() => {
    if (!open) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email?.toLowerCase() || '';
      if (email === 'nash@kronoscapital.us') {
        onPaymentSuccess();
        onOpenChange(false);
      }
    });
  }, [open, onOpenChange, onPaymentSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        {!showCheckout ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Lock className="h-12 w-12 text-primary" />
                </div>
              </div>
              <DialogTitle className="text-center text-2xl">
                Payment Required to Export
              </DialogTitle>
              <DialogDescription className="text-center text-base">
                Complete your $1,000 patent application payment to download your USPTO-ready documents
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-6">
              {/* What's Included */}
              <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  What You Get
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <div className="font-medium">Complete Patent Application</div>
                      <div className="text-sm text-muted-foreground">
                        All sections professionally drafted and formatted
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <div className="font-medium">USPTO-Ready Formatting</div>
                      <div className="text-sm text-muted-foreground">
                        Compliant with all USPTO filing requirements
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <div className="font-medium">DOCX & PDF Export</div>
                      <div className="text-sm text-muted-foreground">
                        Download in both editable and print-ready formats
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <div className="font-medium">Professional Claims</div>
                      <div className="text-sm text-muted-foreground">
                        Legal-grade patent claims drafted by AI
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="border-2 border-primary rounded-lg p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <DollarSign className="h-8 w-8 text-primary" />
                  <span className="text-5xl font-bold text-primary">1,000</span>
                </div>
                <div className="text-muted-foreground mb-4">
                  One-time payment • No recurring fees
                </div>
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={() => setShowCheckout(true)}
                >
                  Continue to Payment
                </Button>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                Secure payment powered by Stripe • Your data is protected
              </p>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Complete Your Payment</DialogTitle>
              <DialogDescription>
                Secure payment processing for your patent application
              </DialogDescription>
            </DialogHeader>
            <EmbeddedStripeCheckout
              applicationId={applicationId}
              mode="payment"
              onSuccess={() => {
                onPaymentSuccess();
                onOpenChange(false);
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
