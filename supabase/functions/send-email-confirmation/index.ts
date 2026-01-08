import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[EMAIL-CONFIRMATION] ${step}${detailsStr}`);
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
    logStep("Function started");

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const resend = new Resend(resendApiKey);
    
    const { email, type = 'signup' } = await req.json();
    logStep("Request parsed", { email, type });

    if (!email) {
      throw new Error("Email is required");
    }

    // Generate email confirmation link using Supabase Admin API
    const linkType = type === 'email_change' ? 'email_change_new' : 'signup';
    const { data, error } = await supabaseClient.auth.admin.generateLink({
      type: linkType,
      email: email,
      options: {
        redirectTo: `${APP_DOMAIN}/auth?type=confirmed`
      }
    });

    if (error) {
      logStep("Error generating confirmation link", { error: error.message });
      throw error;
    }

    const confirmationLink = data?.properties?.action_link;
    if (!confirmationLink) {
      throw new Error("Failed to generate confirmation link");
    }

    logStep("Confirmation link generated successfully");

    const isEmailChange = type === 'email_change';
    const subject = isEmailChange 
      ? `Confirm Your New Email Address - ${APP_NAME}`
      : `Verify Your Email - Welcome to ${APP_NAME}!`;

    const headingText = isEmailChange 
      ? "Confirm Your New Email"
      : "Verify Your Email Address";

    const messageText = isEmailChange
      ? `You requested to change your email address for your ${APP_NAME} account. Please click the button below to confirm this change.`
      : `Thank you for signing up for ${APP_NAME}! Please verify your email address to activate your account and start creating AI-powered patent applications.`;

    // Send branded email via Resend
    const emailResponse = await resend.emails.send({
      from: EMAIL_FROM,
      to: [email],
      subject: subject,
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
                      <h2 style="margin: 0 0 20px; color: #1a1a2e; font-size: 22px; text-align: center;">✉️ ${headingText}</h2>
                      
                      <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6; text-align: center;">
                        ${messageText}
                      </p>
                      
                      <div style="text-align: center; margin: 35px 0;">
                        <a href="${confirmationLink}" 
                           style="display: inline-block; background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(0, 31, 63, 0.3);">
                          ${isEmailChange ? 'Confirm Email Change' : 'Verify My Email'} →
                        </a>
                      </div>
                      
                      ${!isEmailChange ? `
                      <div style="background-color: #f8fafc; border-radius: 10px; padding: 20px; margin: 25px 0;">
                        <h3 style="margin: 0 0 15px; color: #1a1a2e; font-size: 16px; font-weight: 600;">What you can do with ${APP_NAME}:</h3>
                        <ul style="margin: 0; padding-left: 20px; color: #4a5568; font-size: 14px; line-height: 1.8;">
                          <li>Create AI-guided patent applications ($1,000 flat fee)</li>
                          <li>Search prior art with unlimited "Check & See" ($9.99/mo)</li>
                          <li>Export USPTO-formatted documents</li>
                          <li>Track your patent portfolio</li>
                        </ul>
                      </div>
                      ` : ''}
                      
                      <div style="background-color: #e0f2fe; border: 1px solid #0284c7; border-radius: 8px; padding: 15px; margin: 25px 0;">
                        <p style="margin: 0; color: #0369a1; font-size: 14px; line-height: 1.5;">
                          <strong>ℹ️ Note:</strong> This verification link will expire in 24 hours. If you didn't ${isEmailChange ? 'request this email change' : 'create an account'}, you can safely ignore this email.
                        </p>
                      </div>
                      
                      <p style="margin: 20px 0 0; color: #94a3b8; font-size: 13px; text-align: center; line-height: 1.5;">
                        If the button doesn't work, copy and paste this link into your browser:<br/>
                        <a href="${confirmationLink}" style="color: ${BRAND_COLOR}; word-break: break-all;">${confirmationLink}</a>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 25px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                      <p style="margin: 0 0 10px; color: #64748b; font-size: 14px; text-align: center;">
                        Questions? Contact our support team anytime.
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
    });

    logStep("Email sent successfully", { emailId: emailResponse.id });

    // Log to database
    await supabaseClient.from('email_notifications').insert({
      recipient_email: email,
      email_type: isEmailChange ? 'email_change_confirmation' : 'email_confirmation',
      subject: subject,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: true, message: "Confirmation email sent" }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  } catch (error: any) {
    logStep("Error in send-email-confirmation function", { error: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
});
