import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Try to import Resend for primary sending, fallback to nodemailer
let Resend: any = null;
try {
  Resend = require('resend').Resend;
} catch {
  console.log('[Email] Resend not available, using nodemailer only');
}

// Gmail transporter configuration (FALLBACK)
// Uses App Password for authentication
const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'jenithjain09@gmail.com',
    pass: 'hpew wnra hbin zvhz' // Gmail App Password
  }
});

// Test email for verification - always receives a copy
const TEST_EMAIL = 'jenithspam@gmail.com';

export async function POST(request: Request) {
  try {
    const { 
      emailList, 
      subject, 
      html, 
      text
    } = await request.json();

    // Validate inputs
    if (!emailList || !Array.isArray(emailList) || emailList.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No email recipients provided' },
        { status: 400 }
      );
    }

    if (!subject || !html) {
      return NextResponse.json(
        { success: false, error: 'Subject and HTML content are required' },
        { status: 400 }
      );
    }

    console.log('[Email] Starting email campaign');
    console.log('[Email] Recipients:', emailList.length);

    // Results tracking
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
      method: 'nodemailer' as 'resend' | 'nodemailer',
    };

    // Determine which method to use
    const resendApiKey = process.env.RESEND_API_KEY;
    let useResend = false;
    let resend: any = null;

    if (Resend && resendApiKey && !resendApiKey.includes('test')) {
      try {
        resend = new Resend(resendApiKey);
        useResend = true;
        results.method = 'resend';
        console.log('[Email] Using Resend API');
      } catch {
        console.log('[Email] Resend init failed, using nodemailer');
      }
    } else {
      console.log('[Email] Using nodemailer/Gmail (Resend not configured)');
    }

    // First, send a test copy to jenithspam@gmail.com via Gmail
    try {
      const testMailOptions = {
        from: '"GradPilot Campaign" <jenithjain09@gmail.com>',
        to: TEST_EMAIL,
        subject: `[TEST COPY] ${subject}`,
        html: `<div style="background: #fffbcc; padding: 10px; margin-bottom: 20px; border-left: 4px solid #f0ad4e;">
          <strong>⚠️ TEST COPY</strong> - This is a copy of the campaign being sent to ${emailList.length} recipients via ${useResend ? 'Resend' : 'Gmail'}.
        </div>` + html.replace(/{{name}}/g, 'Test User'),
        text: `[TEST COPY - Sending to ${emailList.length} recipients]\n\n` + (text || '').replace(/{{name}}/g, 'Test User'),
      };

      const testInfo = await gmailTransporter.sendMail(testMailOptions);
      console.log(`[Email] ✅ Test copy sent to ${TEST_EMAIL}:`, testInfo.messageId);
    } catch (testErr: any) {
      console.error('[Email] Failed to send test copy:', testErr.message);
    }

    // Send to all recipients
    for (const recipient of emailList) {
      try {
        const recipientEmail = typeof recipient === 'string' ? recipient : recipient.email;
        const recipientName = typeof recipient === 'object' ? recipient.name : '';

        // Skip invalid emails
        if (!recipientEmail || !recipientEmail.includes('@')) {
          console.warn('[Email] Skipping invalid email:', recipientEmail);
          results.failed++;
          results.errors.push(`Invalid email: ${recipientEmail}`);
          continue;
        }

        // Personalize email content
        let personalizedHtml = html;
        let personalizedText = text || '';

        if (recipientName) {
          personalizedHtml = personalizedHtml.replace(/{{name}}/g, recipientName);
          personalizedText = personalizedText.replace(/{{name}}/g, recipientName);
        } else {
          personalizedHtml = personalizedHtml.replace(/{{name}}/g, 'there');
          personalizedText = personalizedText.replace(/{{name}}/g, 'there');
        }

        // Try Resend first, fallback to nodemailer
        let sent = false;
        
        if (useResend && resend) {
          try {
            const { data, error } = await resend.emails.send({
              from: process.env.EMAIL_FROM || 'GradPilot <onboarding@resend.dev>',
              to: recipientEmail,
              subject: subject,
              html: personalizedHtml,
              text: personalizedText,
            });
            
            if (error) throw error;
            console.log(`[Email] ✅ Sent via Resend to ${recipientEmail}:`, data?.id);
            results.sent++;
            sent = true;
          } catch (resendErr: any) {
            console.log(`[Email] Resend failed for ${recipientEmail}, trying Gmail:`, resendErr.message);
          }
        }

        // Fallback to Gmail/nodemailer
        if (!sent) {
          const mailOptions = {
            from: '"GradPilot - Fateh Education" <jenithjain09@gmail.com>',
            to: recipientEmail,
            subject: subject,
            html: personalizedHtml,
            text: personalizedText,
          };

          const info = await gmailTransporter.sendMail(mailOptions);
          console.log(`[Email] ✅ Sent via Gmail to ${recipientEmail}:`, info.messageId);
          results.sent++;
          if (results.method === 'resend') results.method = 'nodemailer'; // Mark as fallback used
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, useResend ? 500 : 1000));

      } catch (err: any) {
        results.failed++;
        const errorMsg = err?.message || 'Unknown error';
        const errorDetail = `Failed to send to ${typeof recipient === 'string' ? recipient : recipient.email}: ${errorMsg}`;
        results.errors.push(errorDetail);
        console.error('[Email] ❌ Send error:', errorDetail);
      }
    }

    console.log(`[Email] Campaign complete: ${results.sent} sent, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      sent: results.sent,
      failed: results.failed,
      total: emailList.length,
      testEmailSent: TEST_EMAIL,
      errors: results.errors.length > 0 ? results.errors.slice(0, 10) : undefined,
    });

  } catch (error) {
    console.error('[Email] Error sending bulk emails:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send emails',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
