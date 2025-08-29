import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
                <a href="https://jdkogqskjsmwlhigaecb.supabase.co/dashboard" 
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

        emailData = {
          to: recipientEmail,
          subject: "Your Patent Application is Ready!",
          html: `
            <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #001F3F; margin: 0;">PatentBot AI™</h1>
                <p style="color: #666; margin: 10px 0;">Your patent application is complete</p>
              </div>
              
              <h2 style="color: #001F3F;">🎉 Patent Application Complete!</h2>
              
              <p>Great news! Your patent application for "${sessionData?.idea_prompt || 'your innovation'}" has been successfully generated and is ready for review.</p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #001F3F; margin-top: 0;">What's Next:</h3>
                <ul style="color: #555;">
                  <li>Review your complete patent application</li>
                  <li>Download the USPTO-formatted document</li>
                  <li>Make any final edits if needed</li>
                  <li>File with the USPTO when ready</li>
                </ul>
              </div>
              
              ${sessionData?.download_url ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${sessionData.download_url}" 
                     style="background: #001F3F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Download Your Patent
                  </a>
                </div>
              ` : ''}
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://jdkogqskjsmwlhigaecb.supabase.co/session/${sessionId}" 
                   style="background: transparent; color: #001F3F; border: 2px solid #001F3F; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Application
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Questions about filing? Our team is here to help guide you through the next steps.
              </p>
            </div>
          `,
          emailType: 'patent_completion'
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
                <p style="color: #666; margin: 10px 0;">Thank you for upgrading!</p>
              </div>
              
              <h2 style="color: #001F3F;">🚀 Welcome to ${planType || 'Premium'}!</h2>
              
              <p>Thank you for upgrading to PatentBot AI™ ${planType || 'Premium'}! You now have access to all our advanced features.</p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #001F3F; margin-top: 0;">Your Premium Benefits:</h3>
                <ul style="color: #555;">
                  <li>✅ Unlimited patent applications</li>
                  <li>✅ Advanced AI-powered prior art search</li>
                  <li>✅ Professional DOCX/PDF export</li>
                  <li>✅ Priority support</li>
                  <li>✅ Advanced claims editing tools</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://jdkogqskjsmwlhigaecb.supabase.co/dashboard" 
                   style="background: #001F3F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Start Your First Patent
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                Your subscription gives you everything you need to protect your innovations. Let's get started!
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