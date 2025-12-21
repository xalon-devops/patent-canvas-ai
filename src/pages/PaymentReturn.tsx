import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, ArrowRight, FileText, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PATENT_APPLICATION_PRICE_DISPLAY, CHECK_AND_SEE_PRICE_DISPLAY_MONTHLY } from '@/lib/pricingConstants';

type PaymentStatus = 'verifying' | 'success' | 'error' | 'processing';
type PaymentType = 'payment' | 'subscription' | null;

export default function PaymentReturn() {
  const [status, setStatus] = useState<PaymentStatus>('verifying');
  const [paymentType, setPaymentType] = useState<PaymentType>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const verifyPayment = async () => {
      const sessionId = searchParams.get('session_id');
      
      if (!sessionId) {
        setStatus('error');
        toast({
          title: "Invalid Payment Session",
          description: "No payment session found. Please try again.",
          variant: "destructive"
        });
        return;
      }

      try {
        console.log('Verifying payment session:', sessionId);

        // Call edge function to verify payment with Stripe and update database
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { sessionId }
        });

        if (error) {
          console.error('Error verifying payment:', error);
          setStatus('error');
          toast({
            title: "Verification Error",
            description: error.message || "Could not verify payment. Please contact support.",
            variant: "destructive"
          });
          return;
        }

        console.log('Payment verification result:', data);

        if (data.success) {
          setStatus('success');
          setPaymentType(data.type);
          
          if (data.type === 'payment' && data.payment?.applicationId) {
            setApplicationId(data.payment.applicationId);
            toast({
              title: "Payment Successful!",
              description: "Your patent application payment has been processed. You can now export your documents."
            });
          } else if (data.type === 'subscription') {
            toast({
              title: "Subscription Activated!",
              description: "Your Check & See subscription is now active. You can now perform unlimited patent searches."
            });
          }
        } else {
          setStatus('processing');
          toast({
            title: "Payment Processing",
            description: "Your payment is being processed. This may take a few moments.",
          });
        }
        
      } catch (error) {
        console.error('Error verifying payment:', error);
        setStatus('error');
        toast({
          title: "Verification Error",
          description: "Could not verify payment status. Please contact support.",
          variant: "destructive"
        });
      }
    };

    verifyPayment();
  }, [searchParams, toast]);

  const handleContinue = () => {
    if (paymentType === 'payment' && applicationId) {
      navigate(`/session/${applicationId}`);
    } else if (paymentType === 'subscription') {
      navigate('/check');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
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
              <CardTitle className="text-2xl">Payment Successful!</CardTitle>
              <CardDescription>
                {paymentType === 'payment' 
                  ? `Your ${PATENT_APPLICATION_PRICE_DISPLAY} patent application payment has been processed.`
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
                      <span>Unlimited patent searches</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Prior art analysis with AI</span>
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
                    Start Searching Patents
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
              <p className="text-sm text-muted-foreground">
                If you've been charged, don't worry - your payment will be verified shortly. Check your email for confirmation or contact our support team.
              </p>
              <div className="space-y-2">
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
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
              </div>
              <CardTitle className="text-2xl">Payment Processing</CardTitle>
              <CardDescription>
                Your payment has been received and is being processed. This usually takes just a few moments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm text-center">
                Please wait while we verify your payment with our payment processor. This page will automatically update.
              </p>
              <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
                Refresh Status
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
