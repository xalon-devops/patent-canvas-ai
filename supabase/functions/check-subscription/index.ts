import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";
import { findCustomerIds, syncUserSubscription } from "../_shared/stripe-sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header provided" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return json({ error: "Not authenticated" }, 401);
    logStep("User authenticated", { userId: user.id });

    // Admins bypass all paywalls. Do NOT write a row for them: that used to overwrite
    // a real paid subscription (stripe_subscription_id -> null).
    const { data: adminRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (adminRole) {
      logStep("Admin user detected, granting full access");
      return json({ hasSubscription: true, subscribed: true, plan: "admin", current_period_end: null });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Reconcile with Stripe. syncUserSubscription never overwrites free_grant / manual
    // rows and never creates a row for a user who has nothing in Stripe.
    const customerIds = user.email ? await findCustomerIds(stripe, user.email) : [];
    const result = await syncUserSubscription(stripe, supabaseClient, user.id, customerIds);
    logStep("Reconciled", { plan: result.plan, status: result.status, skipped: result.skipped });

    return json({
      hasSubscription: result.subscribed,
      subscribed: result.subscribed,
      plan: result.plan,
      status: result.status,
      current_period_end: result.current_period_end,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return json({ error: errorMessage }, 500);
  }
});
