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
      base_url: 'https://patentbot-ai.com',
      logo_url: 'https://i.ibb.co/nsLWZ3sr/Patent-Bot-Logo-1.png'
    });

    // Send email
    const emailResponse = await resend.emails.send({
      from: 'PatentBot™ <teams@msg.patentbot-ai.com>',
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
  const APP_NAME = "PatentBot™";
  const BRAND_COLOR = "#001F3F";
  const LOGO_URL = data.logo_url || 'https://i.ibb.co/nsLWZ3sr/Patent-Bot-Logo-1.png';
  const BASE_URL = data.base_url || 'https://patentbot-ai.com';

  const emailWrapper = (content: string) => `
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
              <tr>
                <td style="background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
                  <img src="${LOGO_URL}" alt="${APP_NAME}" style="height: 50px; width: auto; margin-bottom: 10px;" />
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${APP_NAME}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  ${content}
                </td>
              </tr>
              <tr>
                <td style="background-color: #f8fafc; padding: 25px 40px; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                    © ${new Date().getFullYear()} ${APP_NAME} • <a href="${BASE_URL}" style="color: #94a3b8;">patentbot-ai.com</a>
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

  const templates: { [key: string]: any } = {
    draft_complete: {
      subject: '🎉 Your Patent Draft is Ready!',
      html: emailWrapper(`
        <h2 style="margin: 0 0 20px; color: #1a1a2e; font-size: 22px;">Great news!</h2>
        <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
          Your AI-generated patent application draft is ready for review. Our advanced system has created a comprehensive USPTO-compliant document with:
        </p>
        <div style="background-color: #f8fafc; border-radius: 10px; padding: 20px; margin: 25px 0;">
          <ul style="margin: 0; padding-left: 20px; color: #4a5568; font-size: 14px; line-height: 1.8;">
            <li>✓ Professional Abstract</li>
            <li>✓ Detailed Background & Summary</li>
            <li>✓ Complete Claims Section</li>
            <li>✓ Technical Description</li>
            <li>✓ Drawing Descriptions</li>
          </ul>
        </div>
        <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
          <strong>This draft went through 3 iterations of AI refinement to ensure maximum quality.</strong>
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${BASE_URL}/session/${data.session_id}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
            Review Your Patent Draft →
          </a>
        </div>
        <p style="margin: 0; color: #64748b; font-size: 14px; text-align: center;">
          Next: Review and edit → Complete payment ($1,000) → Download USPTO-ready application
        </p>
      `)
    },
    payment_received: {
      subject: '✅ Payment Confirmed - Download Your Patent',
      html: emailWrapper(`
        <div style="text-align: center; margin-bottom: 25px;">
          <span style="display: inline-block; background-color: #10b981; color: white; padding: 8px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
            ✓ Payment Successful
          </span>
        </div>
        <h2 style="margin: 0 0 20px; color: #1a1a2e; font-size: 22px; text-align: center;">Thank you for your payment!</h2>
        <div style="background-color: #f8fafc; border-radius: 10px; padding: 20px; margin: 25px 0; text-align: center;">
          <p style="margin: 0 0 10px; color: #64748b; font-size: 14px;">Amount Paid</p>
          <p style="margin: 0; color: #10b981; font-size: 32px; font-weight: bold;">$${(data.payment_amount || 100000) / 100}</p>
        </div>
        <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
          Your patent application is now ready to download in USPTO-compliant format:
        </p>
        <ul style="margin: 0 0 25px; padding-left: 20px; color: #4a5568; font-size: 14px; line-height: 1.8;">
          <li>📄 DOCX format (editable)</li>
          <li>📄 PDF format (ready to file)</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${BASE_URL}/session/${data.session_id}" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
            Download Patent Application →
          </a>
        </div>
        <p style="margin: 0; color: #64748b; font-size: 14px; text-align: center;">
          Need help filing? Contact us for filing assistance.
        </p>
      `)
    },
    prior_art_alert: {
      subject: '🚨 New Prior Art Detected',
      html: emailWrapper(`
        <div style="text-align: center; margin-bottom: 25px;">
          <span style="display: inline-block; background-color: #f59e0b; color: white; padding: 8px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
            ⚠️ Prior Art Alert
          </span>
        </div>
        <h2 style="margin: 0 0 20px; color: #1a1a2e; font-size: 22px;">New Patents Detected</h2>
        <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
          Our monitoring system detected new patents that may be relevant to your invention idea.
        </p>
        <p style="margin: 0 0 25px; color: #4a5568; font-size: 16px; line-height: 1.6;">
          We recommend reviewing these patents to assess potential overlap with your invention.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${BASE_URL}/ideas" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
            View Alert Details →
          </a>
        </div>
      `)
    }
  };

  return templates[type] || {
    subject: 'PatentBot™ Notification',
    html: emailWrapper(`
      <p style="margin: 0; color: #4a5568; font-size: 16px; line-height: 1.6;">You have a new notification from PatentBot™.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${BASE_URL}/dashboard" style="display: inline-block; background: linear-gradient(135deg, ${BRAND_COLOR} 0%, #003366 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
          View Dashboard →
        </a>
      </div>
    `)
  };
}