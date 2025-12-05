import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EmailRequest {
  email: string;
  type: 'verification' | 'reset';
  code: string;
  userId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 })
  }

  try {
    const { email, type, code }: EmailRequest = await req.json()

    console.log('Sending email to:', email, 'type:', type);

    // Get SMTP password from environment
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')
    const smtpUser = Deno.env.get('SMTP_USER') || 'noreply@thinky.com'
    
    if (!smtpPassword) {
      console.warn('SMTP_PASSWORD not configured - skipping email send')
      return new Response(
        JSON.stringify({ success: true, message: 'Email service not configured', emailSent: false }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    console.log('Attempting SMTP connection...');

    // SMTP configuration for Gmail
    const client = new SmtpClient()

    try {
      // Use port 587 with STARTTLS (more reliable than 465)
      await client.connectTLS({
        hostname: "smtp.gmail.com",
        port: 587,
        username: smtpUser,
        password: smtpPassword,
      })
      console.log('SMTP connection successful');
    } catch (smtpError) {
      console.error('SMTP connection failed:', smtpError);
      // Return success but indicate email wasn't sent
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email service temporarily unavailable', 
          emailSent: false,
          error: String(smtpError)
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    let subject = ''
    let html = ''

    if (type === 'verification') {
      subject = 'Verify Your Email - Thinky'
      html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
<tr><td style="padding:40px 30px;text-align:center;background:linear-gradient(135deg,#E91E63 0%,#F06292 100%)">
<h1 style="margin:0;color:#fff;font-size:28px">Welcome to Thinky!</h1>
</td></tr>
<tr><td style="padding:40px 30px">
<p style="margin:0 0 20px;font-size:16px;color:#333;line-height:1.5">Thank you for signing up! Please use the following verification code:</p>
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:30px 0">
<div style="background:#f5f5f5;padding:20px 40px;border-radius:8px">
<span style="font-size:36px;font-weight:bold;color:#E91E63;letter-spacing:8px">${code}</span>
</div></td></tr></table>
<p style="margin:20px 0 0;font-size:14px;color:#666">This code will expire in <strong>15 minutes</strong>.</p>
</td></tr>
<tr><td style="padding:20px 30px;background:#f9f9f9;border-top:1px solid #e0e0e0;text-align:center">
<p style="margin:0;font-size:12px;color:#999">Thinky - Your Study Companion</p>
</td></tr></table>
</td></tr></table>
</body></html>`
    } else {
      subject = 'Password Reset Code - Thinky'
      html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
<tr><td style="padding:40px 30px;text-align:center;background:linear-gradient(135deg,#E91E63 0%,#F06292 100%)">
<h1 style="margin:0;color:#fff;font-size:28px">Password Reset</h1>
</td></tr>
<tr><td style="padding:40px 30px">
<p style="margin:0 0 20px;font-size:16px;color:#333;line-height:1.5">You requested to reset your password. Use this code:</p>
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:30px 0">
<div style="background:#f5f5f5;padding:20px 40px;border-radius:8px">
<span style="font-size:36px;font-weight:bold;color:#E91E63;letter-spacing:8px">${code}</span>
</div></td></tr></table>
<p style="margin:20px 0 0;font-size:14px;color:#666">This code will expire in <strong>15 minutes</strong>.</p>
</td></tr>
<tr><td style="padding:20px 30px;background:#f9f9f9;border-top:1px solid #e0e0e0;text-align:center">
<p style="margin:0;font-size:12px;color:#999">Thinky - Your Study Companion</p>
</td></tr></table>
</td></tr></table>
</body></html>`
    }

    await client.send({
      from: smtpUser,
      to: email,
      subject: subject,
      content: html,
      html: html,
    })

    await client.close()

    console.log('Email sent successfully to:', email)

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully', emailSent: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in email function:', error)
    console.error('Error type:', typeof error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Return 200 with error details instead of 400 to not break the signup flow
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Account created but email failed to send', 
        emailSent: false,
        error: errorMessage 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  }
})
