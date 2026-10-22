// Shared Stripe -> subscriptions reconciliation used by check-subscription,
// verify-payment and stripe-webhook.
//
// Design rules:
// - Stripe is the source of truth for Stripe-managed rows. We always re-read the
//   live subscription list instead of trusting event payload ordering, so duplicate
//   and out-of-order webhook deliveries converge on the same final state.
// - Manual rows are never touched: plan 'free_grant' (admin-granted) or any row with
//   no stripe_subscription_id whose plan is not a Stripe plan.
// - Only PatentBot subscriptions count (the Stripe account may hold other products).
// - subscriptions has UNIQUE(user_id), so when a user holds several PatentBot
//   subscriptions we store the "best" one (active/trialing first, Check & See first).

// deno-lint-ignore-file no-explicit-any

export const STRIPE_PLANS = ["check_and_see", "trademark_suite", "premium"];
const ACCESS_STATUSES = ["active", "trialing"];
// Statuses that mean "this subscription is still alive" (worth storing over a dead one)
const LIVE_STATUSES = ["active", "trialing", "past_due", "unpaid", "incomplete"];

let cachedProductIds: Set<string> | null = null;

async function getPatentBotProductIds(stripe: any): Promise<Set<string>> {
  if (cachedProductIds) return cachedProductIds;
  const ids = new Set<string>();
  try {
    const products = await stripe.products.list({ limit: 100 });
    for (const p of products.data) {
      if (p.metadata?.app === "patentbot" || (typeof p.name === "string" && p.name.startsWith("PatentBot"))) {
        ids.add(p.id);
      }
    }
  } catch (_e) {
    // Fall back to metadata-only matching
  }
  cachedProductIds = ids;
  return ids;
}

function subProductIds(sub: any): string[] {
  return (sub.items?.data ?? [])
    .map((it: any) => (typeof it.price?.product === "string" ? it.price.product : it.price?.product?.id))
    .filter(Boolean);
}

async function isPatentBotSub(stripe: any, sub: any): Promise<boolean> {
  if (sub.metadata?.app === "patentbot") return true;
  const ids = await getPatentBotProductIds(stripe);
  return subProductIds(sub).some((id) => ids.has(id));
}

function planFor(sub: any): string {
  const p = sub.metadata?.plan_type;
  if (p === "trademark_suite") return "trademark_suite";
  // 'premium' was a legacy client-supplied value for Check & See
  return "check_and_see";
}

function rank(sub: any): number {
  const access = ACCESS_STATUSES.includes(sub.status) ? 100 : LIVE_STATUSES.includes(sub.status) ? 50 : 0;
  const plan = planFor(sub) === "check_and_see" ? 10 : 0;
  return access + plan;
}

export interface SyncResult {
  subscribed: boolean;
  plan: string;
  status: string;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  skipped?: "manual_grant";
}

/** Returns true when an existing row was created by hand (admin grant) and must not be overwritten. */
export function isManualRow(row: any): boolean {
  if (!row) return false;
  if (row.plan === "free_grant") return true;
  if (!row.stripe_subscription_id && row.plan && !STRIPE_PLANS.includes(row.plan) && row.plan !== "free" && row.plan !== "admin") {
    return true;
  }
  return false;
}

/** Find Stripe customer ids for a user: by explicit id, else by email (all matches). */
export async function findCustomerIds(stripe: any, email: string | null | undefined, customerId?: string | null): Promise<string[]> {
  const ids = new Set<string>();
  if (customerId) ids.add(customerId);
  if (email) {
    const customers = await stripe.customers.list({ email, limit: 10 });
    for (const c of customers.data) ids.add(c.id);
  }
  return [...ids];
}

/**
 * Reconcile the user's subscriptions row with Stripe.
 * Never downgrades manual grants; never creates a row for a user with nothing in Stripe.
 */
export async function syncUserSubscription(
  stripe: any,
  supabase: any,
  userId: string,
  customerIds: string[],
): Promise<SyncResult> {
  const { data: existing, error: readErr } = await supabase
    .from("subscriptions")
    .select("plan, status, stripe_subscription_id, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) throw readErr;

  if (isManualRow(existing)) {
    const active = ACCESS_STATUSES.includes(existing.status) &&
      (!existing.current_period_end || new Date(existing.current_period_end) > new Date());
    return {
      subscribed: active,
      plan: existing.plan,
      status: existing.status,
      current_period_end: existing.current_period_end ?? null,
      stripe_subscription_id: existing.stripe_subscription_id ?? null,
      skipped: "manual_grant",
    };
  }

  const subs: any[] = [];
  for (const cid of customerIds) {
    const list = await stripe.subscriptions.list({ customer: cid, status: "all", limit: 20 });
    for (const s of list.data) {
      if (await isPatentBotSub(stripe, s)) subs.push(s);
    }
  }

  if (subs.length === 0) {
    // Nothing in Stripe. Only demote a row that was Stripe-managed; leave others alone.
    if (existing && (existing.stripe_subscription_id || STRIPE_PLANS.includes(existing.plan)) &&
        existing.status !== "inactive" && existing.status !== "cancelled") {
      const { error } = await supabase.from("subscriptions")
        .update({ status: "inactive", updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw error;
    }
    return { subscribed: false, plan: "free", status: "inactive", current_period_end: null, stripe_subscription_id: null };
  }

  subs.sort((a, b) => rank(b) - rank(a) || (b.created ?? 0) - (a.created ?? 0));
  const best = subs[0];
  const status = best.status === "canceled" ? "cancelled" : best.status;
  const plan = planFor(best);
  const periodStart = best.current_period_start ? new Date(best.current_period_start * 1000).toISOString() : null;
  const periodEnd = best.current_period_end ? new Date(best.current_period_end * 1000).toISOString() : null;

  const { error: upErr } = await supabase.from("subscriptions").upsert({
    user_id: userId,
    status,
    plan,
    stripe_subscription_id: best.id,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (upErr) throw upErr;

  return {
    subscribed: ACCESS_STATUSES.includes(status),
    plan,
    status,
    current_period_end: periodEnd,
    stripe_subscription_id: best.id,
  };
}
