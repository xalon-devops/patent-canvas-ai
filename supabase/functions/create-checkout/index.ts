import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Use service role key for database operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { planType = "check_and_see" } = await req.json();
    logStep("Request parsed", { planType });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const resolveSubscriptionPriceId = async () => {
      const productName = 'PatentBot™ Check & See';
      
      // 1) Find or create the PatentBot product first
      const products = await stripe.products.list({ active: true, limit: 100 });
      let product = products.data.find((p) => p.name === productName);
      
      if (!product) {
        product = await stripe.products.create({
          name: productName,
          description: 'Unlimited prior patent searches. Cancel anytime.',
          metadata: { app: 'patentbot' }
        });
        logStep("Created PatentBot product", { productId: product.id });
      } else {
        logStep("Found existing PatentBot product", { productId: product.id });
      }

      // 2) Look for an existing $9.99/mo price on THIS product only
      const prices = await stripe.prices.list({ 
        product: product.id, 
        active: true, 
        limit: 100 
      });
      
      const existingPrice = prices.data.find((p) =>
        p.currency === 'usd' &&
        p.unit_amount === 999 &&
        !!p.recurring &&
        p.recurring.interval === 'month'
      );
      
      if (existingPrice?.id) {
        logStep("Found existing PatentBot price", { priceId: existingPrice.id });
        return existingPrice.id;
      }

      // 3) Create the $9.99/mo price on the PatentBot product
      const createdPrice = await stripe.prices.create({
        product: product.id,
        currency: 'usd',
        unit_amount: 999,
        recurring: { interval: 'month' },
        metadata: { app: 'patentbot' }
      });

      logStep("Created PatentBot price", {
        productId: product.id,
        priceId: createdPrice.id,
      });

      return createdPrice.id;
    };

    const priceId = await resolveSubscriptionPriceId();
    logStep("Resolved subscription price", { priceId, planType });

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

    const appDomain = "https://patentbot-ai.com";
    
    // Create embedded checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      ui_mode: "embedded",
      return_url: `${appDomain}/payment/return?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        user_id: user.id,
        plan_type: planType
      }
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    // Record transaction in database
    const { error: insertError } = await supabaseClient
      .from("payment_transactions")
      .insert({
        user_id: user.id,
        stripe_session_id: session.id,
        amount: 999, // $9.99 for Check & See
        currency: "usd",
        status: "pending",
        payment_type: "subscription",
        description: "Check & See Subscription",
        metadata: { price_id: priceId, plan_type: planType }
      });

    if (insertError) {
      logStep("Error recording transaction", { error: insertError });
    } else {
      logStep("Transaction recorded successfully");
    }

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});