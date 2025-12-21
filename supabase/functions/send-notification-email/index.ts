import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.52.1";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, type, session_id, payment_amount } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user info
    const { data: userData } = await supabaseClient
      .from('users')
      .select('email, email_preferences')
      .eq('id', user_id)
      .single();

    if (!userData || !userData.email) {
      throw new Error('User email not found');
    }

    // Check if user wants this notification
    const prefs = userData.email_preferences || {};
    if (!prefs[type]) {
      console.log(`User opted out of ${type} emails`);
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate email content based on type
    const emailContent = generateEmailContent(type, {
      session_id,
      payment_amount,
      base_url: 'https://patentbot-ai.com'
    });

    // Send email
    const emailResponse = await resend.emails.send({
      from: 'PatentBot AI <notifications@patentbot.ai>',
      to: [userData.email],
      subject: emailContent.subject,
      html: emailContent.html,
    });

    // Log email
    await supabaseClient.from('email_notifications').insert({
      user_id,
      email_type: type,
      recipient_email: userData.email,
      subject: emailContent.subject,
      content: emailContent.html,
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      email_id: emailResponse.id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[EMAIL] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function generateEmailContent(type: string, data: any): { subject: string, html: string } {
  const templates: { [key: string]: any } = {
    draft_complete: {
      subject: '🎉 Your Patent Draft is Ready!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Your Patent Draft is Complete!</h1>
            </div>
            <div class="content">
              <h2>Great news!</h2>
              <p>Your AI-generated patent application draft is ready for review. Our advanced system has created a comprehensive USPTO-compliant document with:</p>
              <ul>
                <li>✓ Professional Abstract</li>
                <li>✓ Detailed Background & Summary</li>
                <li>✓ Complete Claims Section</li>
                <li>✓ Technical Description</li>
                <li>✓ Drawing Descriptions</li>
              </ul>
              <p><strong>This draft went through 3 iterations of AI refinement to ensure maximum quality.</strong></p>
              <a href="${data.base_url}/session/${data.session_id}" class="button">Review Your Patent Draft</a>
              <p>Next steps:</p>
              <ol>
                <li>Review and edit any sections</li>
                <li>Complete payment ($1,000)</li>
                <li>Download your USPTO-ready patent application</li>
              </ol>
            </div>
            <div class="footer">
              <p>PatentBot AI™ - Automated Patent Drafting</p>
              <p><a href="${data.base_url}/dashboard">Dashboard</a> | <a href="${data.base_url}/check">Prior Art Search</a></p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    payment_received: {
      subject: '✅ Payment Confirmed - Download Your Patent',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .amount { font-size: 32px; font-weight: bold; color: #10b981; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Payment Confirmed!</h1>
            </div>
            <div class="content">
              <p>Thank you for your payment!</p>
              <div class="amount">$${(data.payment_amount || 100000) / 100}</div>
              <p>Your patent application is now ready to download in USPTO-compliant format:</p>
              <ul>
                <li>📄 DOCX format (editable)</li>
                <li>📄 PDF format (ready to file)</li>
              </ul>
              <a href="${data.base_url}/session/${data.session_id}" class="button">Download Patent Application</a>
              <p><strong>What's next?</strong></p>
              <ol>
                <li>Review the final document</li>
                <li>File with USPTO directly or through an attorney</li>
                <li>Track your application status</li>
              </ol>
              <p>Need help filing? Contact us for filing assistance.</p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    prior_art_alert: {
      subject: '🚨 New Prior Art Detected',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Prior Art Alert</h1>
            </div>
            <div class="content">
              <p>Our monitoring system detected new patents that may be relevant to your invention idea.</p>
              <p>We recommend reviewing these patents to assess potential overlap with your invention.</p>
              <a href="${data.base_url}/ideas" class="button">View Alert Details</a>
            </div>
          </div>
        </body>
        </html>
      `
    }
  };

  return templates[type] || {
    subject: 'PatentBot AI Notification',
    html: '<p>You have a new notification from PatentBot AI.</p>'
  };
}