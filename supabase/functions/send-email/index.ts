import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-EMAIL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const resend = new Resend(resendApiKey);
    
    const { type, userId, sessionId, planType, userEmail, userName, stripeSessionId } = await req.json();
    logStep("Request parsed", { type });

    let emailData: {
      to: string;
      subject: string;
      html: string;
      emailType: string;
    };

    // Get user email if not provided
    let recipientEmail = userEmail;
    if (!recipientEmail && userId) {
      const { data: userData } = await supabaseClient.auth.admin.getUserById(userId);
      recipientEmail = userData.user?.email;
    }

    if (!recipientEmail) {
      throw new Error("No recipient email found");
    }

    // App branding constants
    const APP_NAME = "PatentBot™";
    const APP_DOMAIN = "https://patentbot-ai.com";
    const APP_LOGO = "https://i.ibb.co/nsLWZ3sr/Patent-Bot-Logo-1.png";
    const BRAND_COLOR = "#001F3F";
    const EMAIL_FROM = "PatentBot™ <teams@msg.patentbot-ai.com>";

    switch (type) {
      case 'welcome':
        emailData = {
          to: recipientEmail,
          subject: `Welcome to ${APP_NAME}!`,
          html: `
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
                          <h2 style="margin: 0 0 20px; color: #1a1a2e; font-size: 22px;">Welcome aboard, ${userName || 'valued user'}!</h2>
                          
                          <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                            Thank you for joining ${APP_NAME}. You now have access to our powerful AI-guided patent application platform.
                          </p>
                          
                          <div style="background-color: #f8fafc; border-radius: 10px; padding: 20px; margin: 25px 0;">
                            <h3 style="margin: 0 0 15px; color: #1a1a2e; font-size: 16px; font-weight: 600;">Getting Started:</h3>
                            <ul style="margin: 0; padding-left: 20px; color: #4a5568; font-size: 14px; line-height: 1.8;">
                              <li>Start a new patent application from your dashboard</li>
                              <li>Use our AI-guided process to create professional drafts</li>
                              <li>Search prior art with our advanced tools</li>
                              <li>Export your completed applications in USPTO format</li>
                            </ul>
                          </div>
                          
                          <div style="text-align: center; margin: 30px 0;">
                            <a href="${APP_DOMAIN}/dashboard"
                               style="display: inline-block; background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                              Go to Dashboard →
                            </a>
                          </div>
                        </td>
                      </tr>
                      
                      <!-- Footer -->
                      <tr>
                        <td style="background-color: #f8fafc; padding: 25px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                            © ${new Date().getFullYear()} ${APP_NAME} • <a href="${APP_DOMAIN}" style="color: #94a3b8;">patentbot-ai.com</a>
                          </p>
                        </td>
                      </tr>
                      
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
          emailType: 'welcome'
        };
        break;

      case 'patent_completion':
        // Get session details
        const { data: sessionData } = await supabaseClient
          .from('patent_sessions')
          .select('idea_prompt, status, download_url')
          .eq('id', sessionId)
          .single();

        // Extract a clean, short title for display (idea_prompt may contain scraped/markdown-heavy content)
        const extractDisplayTitle = (raw: string | null | undefined) => {
          const base = (raw || 'your innovation')
            .replace(/```[a-z]*\s*/gi, '')
            .replace(/```/g, '')
            // strip HTML tags if any
            .replace(/<[^>]*>/g, ' ')
            // convert markdown links [text](url) -> text
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
            // remove markdown headings and emphasis tokens
            .replace(/(^|\s)#{1,6}(\s+)/g, ' ')
            .replace(/[*_`~]/g, '')
            // collapse whitespace/newlines
            .replace(/\s+/g, ' ')
            .trim();

          // Prefer a short segment before pipe separators if present
          const primary = base.includes('|') ? base.split('|')[0].trim() : base;

          // Final hard cap (avoid emails with giant titles)
          return primary.length > 80 ? `${primary.slice(0, 77).trim()}...` : primary;
        };

        const cleanTitle = extractDisplayTitle(sessionData?.idea_prompt);

        // Use the actual app URL
        const applicationUrl = `${APP_DOMAIN}/session/${sessionId}`;

        emailData = {
          to: recipientEmail,
          subject: `🎉 Your Patent Application is Ready! - ${APP_NAME}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #f4f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f7fa;">
                <tr>
                  <td style="padding: 40px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                      
                      <!-- Header -->
                      <tr>
                        <td style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
                          <img src="${APP_LOGO}" alt="${APP_NAME}" style="height: 50px; width: auto; margin-bottom: 10px;" />
                          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${APP_NAME}</h1>
                          <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.8); font-size: 14px;">Your patent application is complete</p>
                        </td>
                      </tr>
                      
                      <!-- Main Content -->
                      <tr>
                        <td style="padding: 40px;">
                          <!-- Success Badge -->
                          <div style="text-align: center; margin-bottom: 30px;">
                            <span style="display: inline-block; background-color: #10b981; color: white; padding: 8px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
                              ✓ Patent Application Complete
                            </span>
                          </div>
                          
                          <h2 style="margin: 0 0 20px; color: #1a1a2e; font-size: 24px; font-weight: 700; text-align: center;">
                            🎉 Congratulations!
                          </h2>
                          
                          <p style="margin: 0 0 25px; color: #4a5568; font-size: 16px; line-height: 1.6; text-align: center;">
                            Great news! Your patent application for <strong style="color: ${BRAND_COLOR};">"${cleanTitle}"</strong> has been successfully generated and is ready for your review.
                          </p>
                          
                          <!-- What's Next Card -->
                          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 25px; margin: 25px 0;">
                            <h3 style="margin: 0 0 15px; color: #1a1a2e; font-size: 18px; font-weight: 600;">
                              📋 What's Next:
                            </h3>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                              <tr>
                                <td style="padding: 8px 0; color: #4a5568; font-size: 15px;">
                                  <span style="color: #10b981; margin-right: 10px;">✓</span> Review your complete patent application
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #4a5568; font-size: 15px;">
                                  <span style="color: #10b981; margin-right: 10px;">✓</span> Download the USPTO-formatted document
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #4a5568; font-size: 15px;">
                                  <span style="color: #10b981; margin-right: 10px;">✓</span> Make any final edits if needed
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #4a5568; font-size: 15px;">
                                  <span style="color: #10b981; margin-right: 10px;">✓</span> File with the USPTO when ready
                                </td>
                              </tr>
                            </table>
                          </div>
                          
                          <!-- CTA Button -->
                          <div style="text-align: center; margin: 35px 0;">
                            <a href="${applicationUrl}" 
                               style="display: inline-block; background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(0, 31, 63, 0.3);">
                              View Your Application →
                            </a>
                          </div>
                          
                          ${sessionData?.download_url ? `
                          <div style="text-align: center; margin: 20px 0;">
                            <a href="${sessionData.download_url}" 
                               style="display: inline-block; background-color: transparent; color: ${BRAND_COLOR}; border: 2px solid ${BRAND_COLOR}; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
                              📄 Download Patent Document
                            </a>
                          </div>
                          ` : ''}
                          
                        </td>
                      </tr>
                      
                      <!-- Footer -->
                      <tr>
                        <td style="background-color: #f8fafc; padding: 25px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                          <p style="margin: 0 0 10px; color: #64748b; font-size: 14px; text-align: center;">
                            Questions about filing? Our team is here to help guide you through the next steps.
                          </p>
                          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                            © ${new Date().getFullYear()} ${APP_NAME} • <a href="${APP_DOMAIN}" style="color: #94a3b8;">patentbot-ai.com</a>
                          </p>
                        </td>
                      </tr>
                      
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
          emailType: 'patent_completion'
        };
        break;

      case 'payment_received':
        const { amount, paymentType, applicationTitle } = await req.json().catch(() => ({}));
        const formattedAmount = amount ? `$${(amount / 100).toFixed(2)}` : '$1,000.00';
        
        emailData = {
          to: recipientEmail,
          subject: `Payment Received - ${APP_NAME}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="margin: 0; padding: 0; background-color: #f4f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f7fa;">
                <tr>
                  <td style="padding: 40px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                      <tr>
                        <td style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
                          <img src="${APP_LOGO}" alt="${APP_NAME}" style="height: 50px; width: auto; margin-bottom: 10px;" />
                          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${APP_NAME}</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 40px;">
                          <h2 style="margin: 0 0 20px; color: #1a1a2e; font-size: 22px;">✅ Payment Received</h2>
                          <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                            Thank you for your payment! Your transaction has been successfully processed.
                          </p>
                          <div style="background-color: #f8fafc; border-radius: 10px; padding: 20px; margin: 25px 0;">
                            <h3 style="margin: 0 0 15px; color: #1a1a2e; font-size: 16px; font-weight: 600;">Payment Details:</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                              <tr><td style="padding: 8px 0; color: #64748b;">Amount:</td><td style="padding: 8px 0; font-weight: bold; text-align: right; color: #1a1a2e;">${formattedAmount}</td></tr>
                              <tr><td style="padding: 8px 0; color: #64748b;">Type:</td><td style="padding: 8px 0; text-align: right; color: #1a1a2e;">${paymentType === 'subscription' ? 'Check & See Subscription' : 'Patent Application Fee'}</td></tr>
                              ${applicationTitle ? `<tr><td style="padding: 8px 0; color: #64748b;">Application:</td><td style="padding: 8px 0; text-align: right; color: #1a1a2e;">${applicationTitle}</td></tr>` : ''}
                              <tr><td style="padding: 8px 0; color: #64748b;">Date:</td><td style="padding: 8px 0; text-align: right; color: #1a1a2e;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                            </table>
                          </div>
                          <div style="text-align: center; margin: 30px 0;">
                            <a href="${APP_DOMAIN}/dashboard" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                              Go to Dashboard →
                            </a>
                          </div>
                          <p style="margin: 0; color: #64748b; font-size: 14px; text-align: center;">
                            This is your receipt for tax purposes. If you have any questions, please contact support.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background-color: #f8fafc; padding: 25px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                            © ${new Date().getFullYear()} ${APP_NAME} • <a href="${APP_DOMAIN}" style="color: #94a3b8;">patentbot-ai.com</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
          emailType: 'payment_received'
        };
        break;

      case 'subscription_welcome':
        emailData = {
          to: recipientEmail,
          subject: `Welcome to ${APP_NAME} Check & See!`,
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="margin: 0; padding: 0; background-color: #f4f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f7fa;">
                <tr>
                  <td style="padding: 40px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                      <tr>
                        <td style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
                          <img src="${APP_LOGO}" alt="${APP_NAME}" style="height: 50px; width: auto; margin-bottom: 10px;" />
                          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${APP_NAME}</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 40px;">
                          <h2 style="margin: 0 0 20px; color: #1a1a2e; font-size: 22px;">🚀 Welcome to Check & See!</h2>
                          <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                            Thank you for subscribing! You now have unlimited access to our prior art search tools.
                          </p>
                          <div style="background-color: #f8fafc; border-radius: 10px; padding: 20px; margin: 25px 0;">
                            <h3 style="margin: 0 0 15px; color: #1a1a2e; font-size: 16px; font-weight: 600;">Your Subscription Benefits:</h3>
                            <ul style="margin: 0; padding-left: 20px; color: #4a5568; font-size: 14px; line-height: 1.8;">
                              <li>Unlimited prior art searches</li>
                              <li>AI-powered patent analysis</li>
                              <li>Competitive landscape monitoring</li>
                              <li>Priority support</li>
                            </ul>
                          </div>
                          <div style="text-align: center; margin: 30px 0;">
                            <a href="${APP_DOMAIN}/check" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                              Start Searching →
                            </a>
                          </div>
                          <p style="margin: 0; color: #64748b; font-size: 14px; text-align: center;">
                            Your subscription renews monthly at $9.99. Manage your subscription anytime from your dashboard.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background-color: #f8fafc; padding: 25px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                            © ${new Date().getFullYear()} ${APP_NAME} • <a href="${APP_DOMAIN}" style="color: #94a3b8;">patentbot-ai.com</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
          emailType: 'subscription_update'
        };
        break;

      case 'abandoned_checkout':
        // Non-annoying abandoned cart recovery email
        const sessionMode = await req.json().then(d => d.sessionMode).catch(() => 'subscription');
        const isSubscription = sessionMode === 'subscription';
        
        emailData = {
          to: recipientEmail,
          subject: `Still thinking it over? - ${APP_NAME}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="margin: 0; padding: 0; background-color: #f4f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f7fa;">
                <tr>
                  <td style="padding: 40px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                      <tr>
                        <td style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
                          <img src="${APP_LOGO}" alt="${APP_NAME}" style="height: 50px; width: auto; margin-bottom: 10px;" />
                          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${APP_NAME}</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 40px;">
                          <h2 style="margin: 0 0 20px; color: #1a1a2e; font-size: 22px;">Still interested in protecting your invention?</h2>
                          <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                            We noticed you didn't complete your ${isSubscription ? 'Check & See subscription' : 'patent application'} checkout. No worries—your cart is still waiting for you.
                          </p>
                          <div style="background-color: #f8fafc; border-radius: 10px; padding: 20px; margin: 25px 0;">
                            <h3 style="margin: 0 0 15px; color: #1a1a2e; font-size: 16px; font-weight: 600;">What you'll get:</h3>
                            ${isSubscription ? `
                            <ul style="margin: 0; padding-left: 20px; color: #4a5568; font-size: 14px; line-height: 1.8;">
                              <li>Unlimited prior art searches</li>
                              <li>AI-powered patentability analysis</li>
                              <li>7-day free trial to try everything</li>
                              <li>Cancel anytime—no commitments</li>
                            </ul>
                            ` : `
                            <ul style="margin: 0; padding-left: 20px; color: #4a5568; font-size: 14px; line-height: 1.8;">
                              <li>Complete USPTO-ready patent application</li>
                              <li>Professional claims, description & abstract</li>
                              <li>DOCX & PDF export formats</li>
                              <li>Save 90% vs traditional patent attorneys</li>
                            </ul>
                            `}
                          </div>
                          <div style="text-align: center; margin: 30px 0;">
                            <a href="${APP_DOMAIN}/${isSubscription ? 'pricing' : 'new-application'}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                              Complete Your ${isSubscription ? 'Subscription' : 'Application'} →
                            </a>
                          </div>
                          <p style="margin: 0; color: #64748b; font-size: 14px; text-align: center;">
                            Questions? Just reply to this email—we're happy to help.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background-color: #f8fafc; padding: 25px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                            © ${new Date().getFullYear()} ${APP_NAME} • <a href="${APP_DOMAIN}" style="color: #94a3b8;">patentbot-ai.com</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
          emailType: 'abandoned_checkout'
        };
        break;

      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    logStep("Sending email", { to: emailData.to, subject: emailData.subject });

    const emailResponse = await resend.emails.send({
      from: EMAIL_FROM,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
    });

    logStep("Email sent successfully", { emailId: emailResponse.data?.id });

    // Log email in database (include stripe_session_id for deduplication)
    const { error: logError } = await supabaseClient
      .from("email_notifications")
      .insert({
        user_id: userId,
        email_type: emailData.emailType,
        recipient_email: emailData.to,
        subject: emailData.subject,
        content: emailData.html,
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: { 
          resend_id: emailResponse.data?.id,
          ...(stripeSessionId && { stripe_session_id: stripeSessionId })
        }
      });

    if (logError) {
      logStep("Error logging email", { error: logError });
    }

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in send-email", { message: errorMessage });

    // Log failed email attempt
    if (userId && recipientEmail) {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      await supabaseClient
        .from("email_notifications")
        .insert({
          user_id: userId,
          email_type: type || 'unknown',
          recipient_email: recipientEmail,
          subject: 'Failed to send',
          status: 'failed',
          metadata: { error: errorMessage }
        });
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});