import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { applicationId } = await req.json();
    if (!applicationId) throw new Error("Application ID is required");
    logStep("Request parsed", { applicationId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id }
      });
      customerId = customer.id;
      logStep("New customer created", { customerId });
    }

    const appDomain = "https://patentbot-ai.lovable.app";
    
    // Create embedded one-time payment session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { 
              name: "Patent Application Filing",
              description: "Complete AI-guided patent application with USPTO-ready formatting"
            },
            unit_amount: 100000, // $1,000 in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      ui_mode: "embedded",
      return_url: `${appDomain}/payment/return?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        user_id: user.id,
        application_id: applicationId
      }
    });

    logStep("Payment session created", { sessionId: session.id, url: session.url });

    // Record transaction in both tables
    const { error: txError } = await supabaseClient
      .from("payment_transactions")
      .insert({
        user_id: user.id,
        stripe_session_id: session.id,
        amount: 100000, // $1,000 in cents
        currency: "usd",
        status: "pending",
        payment_type: "one_time",
        description: "Patent Application Filing",
        application_id: applicationId,
        metadata: { stripe_customer_id: customerId }
      });

    const { error: appPaymentError } = await supabaseClient
      .from("application_payments")
      .insert({
        user_id: user.id,
        application_id: applicationId,
        stripe_session_id: session.id,
        amount: 100000,
        currency: "usd",
        status: "pending"
      });

    if (txError) {
      logStep("Error recording payment transaction", { error: txError });
    }
    if (appPaymentError) {
      logStep("Error recording application payment", { error: appPaymentError });
    }
    if (!txError && !appPaymentError) {
      logStep("Payment records created successfully");
    }

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-payment", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});