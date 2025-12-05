import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  email: string;
  type: 'verification' | 'reset';
  code: string;
  userId?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify user is authenticated for reset emails
    const { data: { user } } = await supabaseClient.auth.getUser()

    const { email, type, code, userId }: EmailRequest = await req.json()

    // Get SMTP credentials from environment variables
    const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com'
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587')
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPassword = Deno.env.get('SMTP_APP_PASSWORD') // Gmail App Password
    const fromEmail = Deno.env.get('FROM_EMAIL') || smtpUser

    if (!smtpUser || !smtpPassword) {
      throw new Error('SMTP credentials not configured')
    }

    // Create SMTP client
    const client = new SmtpClient();

    await client.connectTLS({
      hostname: smtpHost,
      port: smtpPort,
      username: smtpUser,
      password: smtpPassword,
    });

    let subject = '';
    let body = '';

    if (type === 'verification') {
      subject = 'Verify Your Email - Reviewer App';
      body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #E91E63;">Welcome to Reviewer App!</h2>
          <p>Thank you for signing up. Please use the following verification code to complete your registration:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #E91E63; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Reviewer App - Your Study Companion</p>
        </div>
      `;
    } else {
      subject = 'Password Reset Code - Reviewer App';
      body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #E91E63;">Password Reset Request</h2>
          <p>You requested to reset your password. Please use the following code:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #E91E63; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Reviewer App - Your Study Companion</p>
        </div>
      `;
    }

    await client.send({
      from: fromEmail!,
      to: email,
      subject: subject,
      content: body,
      html: body,
    });

    await client.close();

    // Update database with verification/reset code
    if (type === 'verification' && userId) {
      await supabaseClient
        .from('profiles')
        .update({
          verification_code: code,
          verification_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        })
        .eq('id', userId)
    } else if (type === 'reset') {
      await supabaseClient
        .from('profiles')
        .update({
          reset_code: code,
          reset_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        })
        .eq('email', email)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
