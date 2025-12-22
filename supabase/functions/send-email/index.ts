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
    
    const { type, userId, sessionId, planType, userEmail, userName } = await req.json();
    logStep("Request parsed", { type, userId, sessionId, planType });

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

    switch (type) {
      case 'welcome':
        emailData = {
          to: recipientEmail,
          subject: "Welcome to PatentBot AI™!",
          html: `
            <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #001F3F; margin: 0;">PatentBot AI™</h1>
                <p style="color: #666; margin: 10px 0;">Welcome to the future of patent applications</p>
              </div>
              
              <h2 style="color: #001F3F;">Welcome aboard, ${userName || 'valued user'}!</h2>
              
              <p>Thank you for joining PatentBot AI™. You now have access to our powerful patent application platform.</p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #001F3F; margin-top: 0;">Getting Started:</h3>
                <ul style="color: #555;">
                  <li>Visit your dashboard to start a new patent application</li>
                  <li>Use our AI-guided process to create professional patent drafts</li>
                  <li>Search prior art with our advanced tools</li>
                  <li>Export your completed applications in USPTO format</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://patentbot-ai.com/dashboard"
                   style="background: #001F3F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Go to Dashboard
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Need help? Reply to this email or visit our support center.
              </p>
            </div>
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

        // Clean the idea prompt for display (remove markdown artifacts)
        const cleanTitle = (sessionData?.idea_prompt || 'your innovation')
          .replace(/```[a-z]*\s*/gi, '')
          .replace(/```/g, '')
          .substring(0, 100)
          .trim();

        // Use the actual app URL
        const appBaseUrl = "https://jdkogqskjsmwlhigaecb.lovableproject.com";
        const applicationUrl = `${appBaseUrl}/session/${sessionId}`;

        emailData = {
          to: recipientEmail,
          subject: "🎉 Your Patent Application is Ready! - PatentBot AI™",
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
                        <td style="background: linear-gradient(135deg, #001F3F 0%, #003366 100%); padding: 40px 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
                          <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">PatentBot AI™</h1>
                          <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.8); font-size: 16px;">Your patent application is complete</p>
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
                            Great news! Your patent application for <strong style="color: #001F3F;">"${cleanTitle}"</strong> has been successfully generated and is ready for your review.
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
                               style="display: inline-block; background: linear-gradient(135deg, #001F3F 0%, #003366 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(0, 31, 63, 0.3);">
                              View Your Application →
                            </a>
                          </div>
                          
                          ${sessionData?.download_url ? `
                          <div style="text-align: center; margin: 20px 0;">
                            <a href="${sessionData.download_url}" 
                               style="display: inline-block; background-color: transparent; color: #001F3F; border: 2px solid #001F3F; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
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
                            © ${new Date().getFullYear()} PatentBot AI™ • All rights reserved
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
          subject: "Payment Received - PatentBot AI™",
          html: `
            <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #001F3F; margin: 0;">PatentBot AI™</h1>
                <p style="color: #666; margin: 10px 0;">Payment Confirmation</p>
              </div>
              
              <h2 style="color: #001F3F;">✅ Payment Received</h2>
              
              <p>Thank you for your payment! Your transaction has been successfully processed.</p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #001F3F; margin-top: 0;">Payment Details:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Amount:</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">${formattedAmount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Type:</td>
                    <td style="padding: 8px 0; text-align: right;">${paymentType === 'subscription' ? 'Check & See Subscription' : 'Patent Application Fee'}</td>
                  </tr>
                  ${applicationTitle ? `
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Application:</td>
                    <td style="padding: 8px 0; text-align: right;">${applicationTitle}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding: 8px 0; color: #666;">Date:</td>
                    <td style="padding: 8px 0; text-align: right;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://patentbot-ai.com/dashboard"
                   style="background: #001F3F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Go to Dashboard
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                This is your receipt for tax purposes. If you have any questions about this charge, please contact support.
              </p>
            </div>
          `,
          emailType: 'payment_received'
        };
        break;

      case 'subscription_welcome':
        emailData = {
          to: recipientEmail,
          subject: `Welcome to PatentBot AI™ ${planType || 'Premium'}!`,
          html: `
            <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #001F3F; margin: 0;">PatentBot AI™</h1>
                <p style="color: #666; margin: 10px 0;">Thank you for subscribing!</p>
              </div>
              
              <h2 style="color: #001F3F;">🚀 Welcome to ${planType || 'Check & See'}!</h2>
              
              <p>Thank you for subscribing to PatentBot AI™! You now have unlimited access to our prior art search tools.</p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #001F3F; margin-top: 0;">Your Subscription Benefits:</h3>
                <ul style="color: #555;">
                  <li>✅ Unlimited prior art searches</li>
                  <li>✅ AI-powered patent analysis</li>
                  <li>✅ Competitive landscape monitoring</li>
                  <li>✅ Priority support</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://patentbot-ai.com/check"
                   style="background: #001F3F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Start Searching
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Your subscription renews monthly at $9.99. You can manage your subscription anytime from your dashboard.
              </p>
            </div>
          `,
          emailType: 'subscription_update'
        };
        break;

      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    logStep("Sending email", { to: emailData.to, subject: emailData.subject });

    const emailResponse = await resend.emails.send({
      from: "PatentBot AI <noreply@resend.dev>",
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
    });

    logStep("Email sent successfully", { emailId: emailResponse.data?.id });

    // Log email in database
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
        metadata: { resend_id: emailResponse.data?.id }
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