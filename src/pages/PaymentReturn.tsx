import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, ArrowRight, FileText, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const PaymentReturn = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'success' | 'error' | 'processing'>('processing');
  const [paymentType, setPaymentType] = useState<'patent' | 'subscription'>('patent');
  const [applicationId, setApplicationId] = useState<string | null>(null);

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      setStatus('error');
      setLoading(false);
      return;
    }

    try {
      // Wait a moment for webhook to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if it's a patent application payment
      const { data: appPayment } = await supabase
        .from('application_payments')
        .select('*, patent_sessions(id, idea_prompt)')
        .eq('stripe_session_id', sessionId)
        .single();

      if (appPayment) {
        setPaymentType('patent');
        setApplicationId(appPayment.application_id);
        setStatus(appPayment.status === 'completed' ? 'success' : 'processing');
        setLoading(false);
        return;
      }

      // Check if it's a subscription payment
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (subscription && subscription.status === 'active') {
        setPaymentType('subscription');
        setStatus('success');
        setLoading(false);
        return;
      }

      // If still processing, keep checking
      setStatus('processing');
      setLoading(false);
    } catch (error) {
      console.error('Payment verification error:', error);
      setStatus('error');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Card className="max-w-md w-full p-8 text-center shadow-card">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Processing Payment</h2>
          <p className="text-muted-foreground">
            Please wait while we confirm your payment...
          </p>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Card className="max-w-md w-full p-8 text-center shadow-card">
          <div className="p-4 bg-destructive/10 rounded-full w-fit mx-auto mb-4">
            <XCircle className="h-16 w-16 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Payment Failed</h2>
          <p className="text-muted-foreground mb-6">
            We couldn't verify your payment. Please contact support if you believe this is an error.
          </p>
          <div className="space-y-3">
            <Button 
              onClick={() => navigate('/dashboard')}
              className="w-full"
            >
              Return to Dashboard
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.location.href = 'mailto:support@patentbotai.com'}
              className="w-full"
            >
              Contact Support
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Card className="max-w-md w-full p-8 text-center shadow-card">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Payment Processing</h2>
          <p className="text-muted-foreground mb-6">
            Your payment is being processed. This usually takes a few moments.
          </p>
          <Button 
            onClick={verifyPayment}
            variant="outline"
            className="w-full"
          >
            Check Again
          </Button>
        </Card>
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
      <Card className="max-w-md w-full p-8 text-center shadow-card">
        <div className="p-4 bg-green-500/10 rounded-full w-fit mx-auto mb-4">
          <CheckCircle className="h-16 w-16 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
        
        {paymentType === 'patent' ? (
          <>
            <p className="text-muted-foreground mb-6">
              Your $1,000 payment has been processed. You can now export and file your patent application.
            </p>
            <div className="space-y-3">
              {applicationId && (
                <Button 
                  onClick={() => navigate(`/session/${applicationId}`)}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Continue to Patent Application
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="w-full"
              >
                Return to Dashboard
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-6">
              Your Check & See subscription is now active. You have unlimited patent searches!
            </p>
            <div className="space-y-3">
              <Button 
                onClick={() => navigate('/check')}
                className="w-full bg-secondary hover:bg-secondary/90"
              >
                <Search className="h-4 w-4 mr-2" />
                Start Searching Patents
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="w-full"
              >
                Return to Dashboard
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default PaymentReturn;

