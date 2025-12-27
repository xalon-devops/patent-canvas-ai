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

    const { priceId: requestedPriceId, planType = "check_and_see" } = await req.json();
    // Default Check & See price id (may vary by Stripe account/mode)
    const fallbackPriceId = 'price_1RdXHaKFoovQj4C2Vx8MmN3P';
    logStep("Request parsed", { requestedPriceId, planType });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const resolveSubscriptionPriceId = async () => {
      // 1) Try the requested price id first (if provided)
      if (requestedPriceId) {
        try {
          const p = await stripe.prices.retrieve(requestedPriceId);
          if (p?.id) return p.id;
        } catch (e) {
          logStep("Requested price not found; will fallback", {
            requestedPriceId,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // 2) Try the fallback id (if it exists)
      try {
        const p = await stripe.prices.retrieve(fallbackPriceId);
        if (p?.id) return p.id;
      } catch (e) {
        logStep("Fallback price not found; will search/create", {
          fallbackPriceId,
          message: e instanceof Error ? e.message : String(e),
        });
      }

      // 3) Try to find an existing $9.99/mo USD price
      const prices = await stripe.prices.list({ active: true, limit: 100 });
      const existing = prices.data.find((p) =>
        p.currency === 'usd' &&
        p.unit_amount === 999 &&
        !!p.recurring &&
        p.recurring.interval === 'month'
      );
      if (existing?.id) {
        logStep("Found existing $9.99/mo price", { priceId: existing.id });
        return existing.id;
      }

      // 4) Create product + price in this Stripe account (so checkout can proceed)
      const productName = 'PatentBot™ — Check & See';
      const products = await stripe.products.list({ active: true, limit: 100 });
      const product =
        products.data.find((p) => p.name === productName) ??
        (await stripe.products.create({
          name: productName,
          description: 'Unlimited prior patent searches while subscribed.',
        }));

      const createdPrice = await stripe.prices.create({
        product: product.id,
        currency: 'usd',
        unit_amount: 999,
        recurring: { interval: 'month' },
      });

      logStep("Created new $9.99/mo price", {
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