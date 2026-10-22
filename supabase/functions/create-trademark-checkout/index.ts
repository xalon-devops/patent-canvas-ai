import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-TRADEMARK-CHECKOUT] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(userError.message);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    log("user", { id: user.id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Resolve or create the Trademark Suite product + $49.99/mo price
    const productName = "PatentBot™ Trademark Suite";
    const products = await stripe.products.list({ active: true, limit: 100 });
    let product = products.data.find((p) => p.name === productName);
    const productDescription = "PatentBot AI — Trademark Suite: unlimited USPTO trademark clearance searches, DuPont factor analysis, and brand monitoring. Cancel anytime.";
    if (!product) {
      product = await stripe.products.create({
        name: productName,
        description: productDescription,
        metadata: { app: "patentbot", platform: "PatentBot AI", product: "Trademark Suite" },
      });
      log("created product", { id: product.id });
    } else {
      product = await stripe.products.update(product.id, {
        name: productName,
        description: productDescription,
        metadata: { app: "patentbot", platform: "PatentBot AI", product: "Trademark Suite" },
      });
      log("synced product descriptor", { id: product.id });
    }

    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
    let price = prices.data.find(
      (p) =>
        p.currency === "usd" &&
        p.unit_amount === 4999 &&
        !!p.recurring &&
        p.recurring.interval === "month",
    );
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: 4999,
        recurring: { interval: "month" },
        metadata: { app: "patentbot" },
      });
      log("created price", { id: price.id });
    }

    // Find or create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id
      ?? (await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } })).id;

    // Block duplicate subscriptions and repeat free trials.
    const existingSubs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 50 });
    const priorTrademark = existingSubs.data.filter((s) =>
      s.items?.data?.some((it) => {
        const prod = typeof it.price?.product === "string" ? it.price.product : it.price?.product?.id;
        return prod === product!.id;
      })
    );
    if (priorTrademark.some((s) => ["active", "trialing", "past_due"].includes(s.status))) {
      return new Response(JSON.stringify({
        error: "You already have an active Trademark Suite subscription. Manage it from Settings.",
        alreadySubscribed: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 409,
      });
    }
    const trialEligible = priorTrademark.length === 0;

    const appDomain = "https://patentbot-ai.com";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      mode: "subscription",
      ui_mode: "embedded",
      return_url: `${appDomain}/payment/return?session_id={CHECKOUT_SESSION_ID}`,
      subscription_data: {
        ...(trialEligible ? { trial_period_days: 7 } : {}),
        metadata: { app: "patentbot", user_id: user.id, plan_type: "trademark_suite" },
      },
      metadata: { user_id: user.id, plan_type: "trademark_suite", app: "patentbot" },
    });

    log("session created", { id: session.id });

    const { error: txError } = await supabaseClient.from("payment_transactions").insert({
      user_id: user.id,
      stripe_session_id: session.id,
      amount: 4999,
      currency: "usd",
      status: "pending",
      payment_type: "subscription",
      description: "PatentBot AI — Trademark Suite Subscription",
      metadata: { price_id: price.id, plan_type: "trademark_suite" },
    });
    if (txError) log("Error recording transaction", { error: txError });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
