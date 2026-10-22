import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WINBACK-EMAILS] ${step}${detailsStr}`);
};

// App branding constants
const APP_NAME = "PatentBot™";
const APP_DOMAIN = "https://patentbot-ai.com";
const APP_LOGO = "https://i.ibb.co/nsLWZ3sr/Patent-Bot-Logo-1.png";
const BRAND_COLOR = "#001F3F";
const EMAIL_FROM = "PatentBot™ <teams@msg.patentbot-ai.com>";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Winback email function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authorization: either the service-role key (pg_cron / server-to-server)
    // or a signed-in admin.
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    const isServiceCall = !!serviceRoleKey && token === serviceRoleKey;

    if (!isServiceCall) {
      if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roleData } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not set");

    const resend = new Resend(resendApiKey);

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;
    const VALID_TYPES = ['never_started', 'abandoned_draft', 'churned_subscription', 'all_inactive'];
    // Scheduled runs (no targetType / 'scheduled') cycle through the specific segments.
    const requestedType: string = body?.targetType ?? 'scheduled';
    const typesToRun: string[] = requestedType === 'scheduled'
      ? ['abandoned_draft', 'churned_subscription', 'never_started']
      : VALID_TYPES.includes(requestedType) ? [requestedType] : [];
    if (typesToRun.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid targetType' }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Hard cap per invocation keeps us inside the edge-function time limit; the
    // cooldown below makes repeated runs pick up where the previous one stopped.
    const MAX_SENDS_PER_RUN = Math.min(Math.max(Number(body?.limit) || 50, 1), 100);
    const TYPE_COOLDOWN_DAYS = 30;   // same segment email at most once per 30 days
    const ANY_WINBACK_COOLDOWN_DAYS = 7; // never more than one winback email per week
    const MIN_ACCOUNT_AGE_DAYS = 3;  // don't "we miss you" brand-new signups
    logStep("Request parsed", { requestedType, dryRun, isServiceCall });

    const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();

    // PostgREST caps responses at max_rows (1000) - page through everything.
    const PAGE = 1000;
    const fetchAll = async <T,>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> => {
      const out: T[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await build(from, from + PAGE - 1);
        if (error) throw new Error(error.message);
        out.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }
      return out;
    };

    const registeredUsers = await fetchAll<{ id: string; email: string | null; created_at: string | null; email_preferences: any }>(
      (f, t) => supabaseClient.from('users').select('id, email, created_at, email_preferences').order('id').range(f, t)
    );

    // Users who opted out of marketing (weekly_digest is the general opt-in) are excluded.
    const accountAgeCutoff = daysAgo(MIN_ACCOUNT_AGE_DAYS);
    const eligibleUsers = registeredUsers.filter(u => {
      if (!u.email) return false;
      const prefs = u.email_preferences as Record<string, boolean> | null;
      if (prefs && prefs.weekly_digest === false) return false;
      return !u.created_at || new Date(u.created_at).getTime() <= new Date(accountAgeCutoff).getTime();
    });
    const eligibleById = new Map(eligibleUsers.map(u => [u.id, u]));

    // Recent winback history (idempotency / cooldown)
    const recentWinbacks = await fetchAll<{ user_id: string | null; email_type: string; sent_at: string | null }>(
      (f, t) => supabaseClient.from('email_notifications')
        .select('user_id, email_type, sent_at')
        .like('email_type', 'winback_%')
        .gte('created_at', daysAgo(TYPE_COOLDOWN_DAYS))
        .order('created_at')
        .range(f, t)
    );
    const anyCutoff = daysAgo(ANY_WINBACK_COOLDOWN_DAYS);
    const recentlyWonBackAny = new Set(recentWinbacks.filter(r => !!r.sent_at && new Date(r.sent_at).getTime() >= new Date(anyCutoff).getTime()).map(r => r.user_id));
    const recentlyWonBackType = new Set(recentWinbacks.map(r => `${r.user_id}:${r.email_type}`));

    logStep(`Found ${eligibleUsers.length} eligible registered users out of ${registeredUsers.length} total`);

    const findTargets = async (targetType: string) => {
      const targets: { id: string; email: string; created_at: string; last_activity?: string }[] = [];
      const push = (id: string, last_activity?: string) => {
        const u = eligibleById.get(id);
        if (!u?.email) return;
        if (recentlyWonBackAny.has(id) || recentlyWonBackType.has(`${id}:winback_${targetType}`)) return;
        if (targets.some(t => t.id === id)) return;
        targets.push({ id, email: u.email, created_at: u.created_at ?? '', last_activity });
      };

      if (targetType === 'never_started') {
        const withSessions = await fetchAll<{ user_id: string }>(
          (f, t) => supabaseClient.from('patent_sessions').select('user_id').not('user_id', 'is', null).order('id').range(f, t)
        );
        const ids = new Set(withSessions.map(s => s.user_id));
        for (const u of eligibleUsers) if (!ids.has(u.id)) push(u.id);
      } else if (targetType === 'abandoned_draft') {
        // Drafts untouched for 2+ days whose owner has never paid
        const drafts = await fetchAll<{ user_id: string; created_at: string }>(
          (f, t) => supabaseClient.from('patent_sessions').select('user_id, created_at')
            .in('status', ['draft', 'in_progress']).lte('created_at', daysAgo(2))
            .order('created_at', { ascending: false }).range(f, t)
        );
        const paid = await fetchAll<{ user_id: string }>(
          (f, t) => supabaseClient.from('application_payments').select('user_id').eq('status', 'completed').order('id').range(f, t)
        );
        const paidIds = new Set(paid.map(p => p.user_id));
        for (const d of drafts) if (!paidIds.has(d.user_id)) push(d.user_id, d.created_at);
      } else if (targetType === 'churned_subscription') {
        const churned = await fetchAll<{ user_id: string; updated_at: string }>(
          (f, t) => supabaseClient.from('subscriptions').select('user_id, updated_at')
            .in('status', ['canceled', 'expired', 'past_due']).order('id').range(f, t)
        );
        for (const sub of churned) push(sub.user_id, sub.updated_at);
      } else if (targetType === 'all_inactive') {
        const active = await fetchAll<{ user_id: string }>(
          (f, t) => supabaseClient.from('subscriptions').select('user_id').eq('status', 'active').order('id').range(f, t)
        );
        const paid = await fetchAll<{ user_id: string }>(
          (f, t) => supabaseClient.from('application_payments').select('user_id').eq('status', 'completed').order('id').range(f, t)
        );
        const excluded = new Set([...active.map(s => s.user_id), ...paid.map(p => p.user_id)]);
        for (const u of eligibleUsers) if (!excluded.has(u.id)) push(u.id);
      }
      return targets;
    };

    const plan: { targetType: string; targets: Awaited<ReturnType<typeof findTargets>> }[] = [];
    for (const t of typesToRun) {
      const targets = await findTargets(t);
      // A user picked in an earlier segment this run is not emailed twice
      for (const tg of targets) recentlyWonBackAny.add(tg.id);
      plan.push({ targetType: t, targets });
      logStep(`Found ${targets.length} target users`, { targetType: t });
    }
    const totalTargets = plan.reduce((n, p) => n + p.targets.length, 0);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          targetCount: totalTargets,
          willSendThisRun: Math.min(totalTargets, MAX_SENDS_PER_RUN),
          targetUsers: plan.flatMap(p => p.targets).slice(0, 10) // Preview first 10
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send winback emails
    let sentCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    const getWinbackSubject = (type: string) => {
      switch (type) {
        case 'never_started': return `We miss you! Start your first AI patent today 🚀`;
        case 'abandoned_draft': return `Your patent draft is waiting for you 📄`;
        case 'churned_subscription': return `Come back to unlimited patent searches 🔍`;
        default: return `Special offer just for you - ${APP_NAME}`;
      }
    };

    const getWinbackContent = (type: string, userName?: string) => {
      const greeting = userName ? `Hi ${userName}` : 'Hi there';
      
      let mainMessage = '';
      let ctaText = '';
      let ctaUrl = `${APP_DOMAIN}/dashboard`;

      switch (type) {
        case 'never_started':
          mainMessage = `You signed up for ${APP_NAME} but haven't started your first patent application yet. We're here to help you protect your innovation!`;
          ctaText = 'Start Your Patent Now';
          ctaUrl = `${APP_DOMAIN}/new-application`;
          break;
        case 'abandoned_draft':
          mainMessage = `You started a patent application but didn't complete it. Your draft is still saved and ready for you to finish. Don't let your innovation go unprotected!`;
          ctaText = 'Continue Your Draft';
          ctaUrl = `${APP_DOMAIN}/drafts`;
          break;
        case 'churned_subscription':
          mainMessage = `We noticed your Check & See subscription ended. Unlimited prior art searches help you stay ahead of the competition and protect your innovations.`;
          ctaText = 'Reactivate Subscription';
          ctaUrl = `${APP_DOMAIN}/pricing`;
          break;
        default:
          mainMessage = `We'd love to help you protect your innovation with ${APP_NAME}. Our AI-powered platform makes patent applications fast and affordable.`;
          ctaText = 'Get Started';
      }

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f7fa;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  
                  <!-- Header with Logo -->
                  <tr>
                    <td style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
                      <img src="${APP_LOGO}" alt="${APP_NAME}" style="height: 50px; width: auto; margin-bottom: 10px;" />
                      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${APP_NAME}</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px; color: #1a1a2e; font-size: 22px;">${greeting}!</h2>
                      
                      <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                        ${mainMessage}
                      </p>
                      
                      <div style="background-color: #f8fafc; border-radius: 10px; padding: 20px; margin: 25px 0; border-left: 4px solid ${BRAND_COLOR};">
                        <h3 style="margin: 0 0 15px; color: #1a1a2e; font-size: 16px; font-weight: 600;">Why Choose ${APP_NAME}?</h3>
                        <ul style="margin: 0; padding-left: 20px; color: #4a5568; font-size: 14px; line-height: 1.8;">
                          <li><strong>$1,000 flat fee</strong> vs $10,000+ with attorneys</li>
                          <li>AI-powered drafting in minutes, not weeks</li>
                          <li>USPTO-ready formatting included</li>
                          <li>Unlimited prior art searches for $99.99/month</li>
                        </ul>
                      </div>
                      
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${ctaUrl}"
                           style="display: inline-block; background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(0, 31, 63, 0.3);">
                          ${ctaText} →
                        </a>
                      </div>
                      
                      <p style="margin: 20px 0 0; color: #94a3b8; font-size: 14px; text-align: center;">
                        Questions? Just reply to this email - we're here to help!
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 25px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                      <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                        © ${new Date().getFullYear()} ${APP_NAME} • <a href="${APP_DOMAIN}" style="color: #94a3b8;">patentbot-ai.com</a>
                      </p>
                      <p style="margin: 10px 0 0; color: #94a3b8; font-size: 11px; text-align: center;">
                        You're receiving this because you signed up for ${APP_NAME}. 
                        <a href="${APP_DOMAIN}/settings" style="color: #94a3b8;">Manage email preferences</a>
                      </p>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
    };

    // Rate limiting: send with small delays to avoid API throttling
    const DELAY_BETWEEN_EMAILS_MS = 200;
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    let attempted = 0;
    outer: for (const { targetType, targets } of plan) {
      for (const targetUser of targets) {
        if (attempted >= MAX_SENDS_PER_RUN) break outer;
        attempted++;
        try {
          const emailResult = await resend.emails.send({
            from: EMAIL_FROM,
            to: [targetUser.email],
            subject: getWinbackSubject(targetType),
            html: getWinbackContent(targetType)
          });
          if ((emailResult as any)?.error) throw new Error((emailResult as any).error.message ?? 'Resend error');

          // Log to email_notifications table (this row is what makes re-runs idempotent)
          const { error: logError } = await supabaseClient.from('email_notifications').insert({
            user_id: targetUser.id,
            recipient_email: targetUser.email,
            email_type: `winback_${targetType}`,
            subject: getWinbackSubject(targetType),
            status: 'sent',
            sent_at: new Date().toISOString(),
            metadata: { resend_id: emailResult.data?.id, target_type: targetType, source: isServiceCall ? 'cron' : 'admin' }
          });
          if (logError) logStep('Failed to log winback email', { error: logError.message });

          sentCount++;
          await sleep(DELAY_BETWEEN_EMAILS_MS);
        } catch (emailError: any) {
          errorCount++;
          errors.push(`${targetUser.id}: ${emailError.message}`);
          logStep(`Failed to send winback`, { userId: targetUser.id, error: emailError.message });
        }
      }
    }

    logStep("Winback campaign complete", { sentCount, errorCount });

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount, 
        errorCount,
        totalTargeted: totalTargets,
        remaining: Math.max(totalTargets - attempted, 0),
        errors: errors.slice(0, 10) // Return first 10 errors
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    logStep("Error in winback emails", { error: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
