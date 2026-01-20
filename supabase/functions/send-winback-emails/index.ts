import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

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

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify the user is an admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      throw new Error('Admin access required');
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not set");

    const resend = new Resend(resendApiKey);
    
    const { targetType, dryRun = false } = await req.json();
    logStep("Request parsed", { targetType, dryRun });

    // Find inactive/unpaid users based on targetType
    // IMPORTANT: Only target users who exist in our public.users table (actual app users)
    // and have email preferences allowing winback emails
    let targetUsers: { id: string; email: string; created_at: string; last_activity?: string }[] = [];

    // Get all registered app users from our users table (not auth.users which includes all Supabase users)
    const { data: registeredUsers, error: usersError } = await supabaseClient
      .from('users')
      .select('id, email, created_at, email_preferences');
    
    if (usersError) {
      logStep("Error fetching registered users", { error: usersError.message });
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    // Filter to only users with valid emails who haven't opted out of winback emails
    const eligibleUsers = (registeredUsers || []).filter(u => {
      if (!u.email) return false;
      // Check email preferences - default to true if not set
      const prefs = u.email_preferences as Record<string, boolean> | null;
      // Allow if no preferences set, or if weekly_digest is true (use this as general marketing opt-in)
      return !prefs || prefs.weekly_digest !== false;
    });

    logStep(`Found ${eligibleUsers.length} eligible registered users out of ${registeredUsers?.length || 0} total`);

    if (targetType === 'never_started') {
      // Users who signed up but never started a session
      const { data: usersWithSessions } = await supabaseClient
        .from('patent_sessions')
        .select('user_id')
        .not('user_id', 'is', null);

      const userIdsWithSessions = new Set(usersWithSessions?.map(s => s.user_id) || []);
      
      targetUsers = eligibleUsers
        .filter(u => !userIdsWithSessions.has(u.id))
        .map(u => ({
          id: u.id,
          email: u.email!,
          created_at: u.created_at
        }));

    } else if (targetType === 'abandoned_draft') {
      // Users with draft sessions but no payment
      const { data: draftSessions } = await supabaseClient
        .from('patent_sessions')
        .select('user_id, created_at')
        .eq('status', 'draft')
        .order('created_at', { ascending: false });

      const { data: paidUsers } = await supabaseClient
        .from('application_payments')
        .select('user_id')
        .eq('status', 'completed');

      const paidUserIds = new Set(paidUsers?.map(p => p.user_id) || []);
      const eligibleUserIds = new Set(eligibleUsers.map(u => u.id));
      
      // Only include users who are in our eligible users list AND have draft sessions AND haven't paid
      const unpaidUserIds = [...new Set(
        (draftSessions || [])
          .filter(s => !paidUserIds.has(s.user_id) && eligibleUserIds.has(s.user_id))
          .map(s => s.user_id)
      )];

      for (const userId of unpaidUserIds) {
        const user = eligibleUsers.find(u => u.id === userId);
        if (user?.email) {
          targetUsers.push({
            id: userId,
            email: user.email,
            created_at: user.created_at,
            last_activity: draftSessions?.find(s => s.user_id === userId)?.created_at
          });
        }
      }

    } else if (targetType === 'churned_subscription') {
      // Users with canceled/expired subscriptions
      const { data: churnedSubs } = await supabaseClient
        .from('subscriptions')
        .select('user_id, updated_at')
        .in('status', ['canceled', 'expired', 'past_due']);

      const eligibleUserIds = new Set(eligibleUsers.map(u => u.id));

      for (const sub of churnedSubs || []) {
        // Only include if user is in our eligible list
        if (!eligibleUserIds.has(sub.user_id)) continue;
        
        const user = eligibleUsers.find(u => u.id === sub.user_id);
        if (user?.email) {
          targetUsers.push({
            id: sub.user_id,
            email: user.email,
            created_at: user.created_at,
            last_activity: sub.updated_at
          });
        }
      }

    } else if (targetType === 'all_inactive') {
      // All registered users without active subscription AND no completed payments
      const { data: activeSubscribers } = await supabaseClient
        .from('subscriptions')
        .select('user_id')
        .eq('status', 'active');

      const { data: paidUsers } = await supabaseClient
        .from('application_payments')
        .select('user_id')
        .eq('status', 'completed');

      const paidOrActiveIds = new Set([
        ...(activeSubscribers?.map(s => s.user_id) || []),
        ...(paidUsers?.map(p => p.user_id) || [])
      ]);

      targetUsers = eligibleUsers
        .filter(u => !paidOrActiveIds.has(u.id))
        .map(u => ({
          id: u.id,
          email: u.email!,
          created_at: u.created_at
        }));
    }

    logStep(`Found ${targetUsers.length} target users`, { targetType });

    if (dryRun) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          dryRun: true,
          targetCount: targetUsers.length,
          targetUsers: targetUsers.slice(0, 10) // Preview first 10
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
                          <li>Unlimited prior art searches for $9.99/month</li>
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

    // Rate limiting: send in batches with delays to avoid API throttling
    const BATCH_SIZE = 10;
    const DELAY_BETWEEN_EMAILS_MS = 200; // 200ms between individual emails
    const DELAY_BETWEEN_BATCHES_MS = 2000; // 2s between batches

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < targetUsers.length; i += BATCH_SIZE) {
      const batch = targetUsers.slice(i, i + BATCH_SIZE);
      logStep(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}`, { batchSize: batch.length, totalProcessed: i });

      for (const targetUser of batch) {
        try {
          const emailResult = await resend.emails.send({
            from: EMAIL_FROM,
            to: [targetUser.email],
            subject: getWinbackSubject(targetType),
            html: getWinbackContent(targetType)
          });

          // Log to email_notifications table
          await supabaseClient.from('email_notifications').insert({
            user_id: targetUser.id,
            recipient_email: targetUser.email,
            email_type: `winback_${targetType}`,
            subject: getWinbackSubject(targetType),
            status: 'sent',
            sent_at: new Date().toISOString(),
            metadata: { resend_id: emailResult.data?.id, target_type: targetType }
          });

          sentCount++;
          logStep(`Sent email to ${targetUser.email}`);
          
          // Small delay between individual emails
          await sleep(DELAY_BETWEEN_EMAILS_MS);
        } catch (emailError: any) {
          errorCount++;
          errors.push(`${targetUser.email}: ${emailError.message}`);
          logStep(`Failed to send to ${targetUser.email}`, { error: emailError.message });
        }
      }

      // Longer delay between batches
      if (i + BATCH_SIZE < targetUsers.length) {
        logStep(`Waiting between batches...`);
        await sleep(DELAY_BETWEEN_BATCHES_MS);
      }
    }

    logStep("Winback campaign complete", { sentCount, errorCount });

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount, 
        errorCount,
        totalTargeted: targetUsers.length,
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
