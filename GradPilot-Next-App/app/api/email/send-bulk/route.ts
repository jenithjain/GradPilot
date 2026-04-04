import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { logAuditEvent } from '@/lib/audit-logger';
import { appendObservabilityLog, ensureObservabilityFolders } from '@/lib/agent-observability';

// Try to import Resend for primary sending, fallback to nodemailer
let Resend: any = null;
try {
  Resend = require('resend').Resend;
} catch {
  console.log('[Email] Resend not available, using nodemailer only');
}

// Gmail transporter configuration (FALLBACK)
// Uses App Password for authentication
const GMAIL_USER = (process.env.GMAIL_USER || process.env.EMAIL_USER || 'jenithjain09@gmail.com').trim();
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_APP_PASSWORD || 'hpew wnra hbin zvhz').trim();
const HAS_GMAIL_CREDENTIALS = Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);

const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  }
});

// Test email for verification - always receives a copy
const TEST_EMAIL = 'jenithspam@gmail.com';
const ENABLE_TEST_COPY = process.env.ENABLE_TEST_COPY === 'true';

type EmailTemplate = {
  subject: string;
  html: string;
  text?: string;
};

function normalizeEmailSequence(
  rawSequence: any,
  fallbackTemplate: { subject?: string; html?: string; text?: string }
): EmailTemplate[] {
  const sequenceCandidates = Array.isArray(rawSequence) ? rawSequence : [];

  const normalized = sequenceCandidates
    .map((item) => ({
      subject: String(item?.subject || '').trim(),
      html: String(item?.html || '').trim(),
      text: String(item?.text || '').trim() || undefined,
    }))
    .filter((item) => item.subject && item.html);

  if (normalized.length > 0) return normalized;

  if (fallbackTemplate.subject && fallbackTemplate.html) {
    return [
      {
        subject: String(fallbackTemplate.subject).trim(),
        html: String(fallbackTemplate.html).trim(),
        text: String(fallbackTemplate.text || '').trim() || undefined,
      },
    ];
  }

  return [];
}

export async function POST(request: Request) {
  const startTime = Date.now();
  let response: Response | null = null;
  let error: Error | null = null;
  let requestSummary: Record<string, any> = {};

  try {
    await ensureObservabilityFolders();
    const { 
      emailList, 
      subject, 
      html, 
      text,
      sequence,
      campaignContext,
    } = await request.json();

    const templates = normalizeEmailSequence(sequence, { subject, html, text });

    const runId = campaignContext?.runId || `email_run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    requestSummary = {
      runId,
      workflowRunId: campaignContext?.workflowRunId || null,
      sourceNodeId: campaignContext?.sourceNodeId || null,
      sourceNodeType: campaignContext?.sourceNodeType || null,
      recipientCount: Array.isArray(emailList) ? emailList.length : 0,
      subjectLength: typeof subject === 'string' ? subject.length : 0,
      sequenceLength: templates.length,
    };
    console.log('[Email] Campaign request', requestSummary);

    // Validate inputs
    if (!emailList || !Array.isArray(emailList) || emailList.length === 0) {
      response = NextResponse.json(
        { success: false, error: 'No email recipients provided' },
        { status: 400 }
      );
      return response;
    }

    if (templates.length === 0) {
      response = NextResponse.json(
        { success: false, error: 'No valid email template found. Provide subject/html or a valid sequence array.' },
        { status: 400 }
      );
      return response;
    }

    console.log('[Email] Starting email campaign', { runId, recipients: emailList.length, sequenceLength: templates.length });

    // Results tracking
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
      method: 'nodemailer' as 'resend' | 'nodemailer',
      runId,
      sequenceLength: templates.length,
    };
    appendObservabilityLog('agents', {
      event: 'email_sender_started',
      ...requestSummary,
    });

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

    // Only require Gmail creds if we are not using Resend.
    if (!useResend && !HAS_GMAIL_CREDENTIALS) {
      response = NextResponse.json(
        {
          success: false,
          error: 'Gmail credentials are not configured',
          details: 'Set GMAIL_USER/GMAIL_APP_PASSWORD (or EMAIL_USER/EMAIL_APP_PASSWORD), or configure a valid RESEND_API_KEY.',
        },
        { status: 500 }
      );
      return response;
    }

    // Optional: send a copy for monitoring when explicitly enabled
    if (ENABLE_TEST_COPY) {
      try {
        const previewTemplate = templates[0];
        const testMailOptions = {
          from: `"GradPilot Campaign" <${GMAIL_USER}>`,
          to: TEST_EMAIL,
          subject: previewTemplate.subject,
          html: `<div style="background: #fffbcc; padding: 10px; margin-bottom: 20px; border-left: 4px solid #f0ad4e;">
            <strong>Monitoring Copy</strong> - Campaign run ${runId} to ${emailList.length} recipients and ${templates.length} sequence step(s).
          </div>` + previewTemplate.html.replace(/{{name}}/g, 'Test User'),
          text: `Monitoring Copy - Campaign run ${runId} to ${emailList.length} recipients and ${templates.length} sequence step(s)\n\n` + (previewTemplate.text || '').replace(/{{name}}/g, 'Test User'),
        };

        const testInfo = await gmailTransporter.sendMail(testMailOptions);
        console.log(`[Email] Monitoring copy sent to ${TEST_EMAIL}:`, testInfo.messageId);
      } catch (testErr: any) {
        console.error('[Email] Failed to send monitoring copy:', testErr.message);
      }
    }

    let resendRestrictionMessage = '';

    // Send to all recipients
    for (const recipient of emailList) {
      const recipientEmail = typeof recipient === 'string' ? recipient : recipient.email;
      const recipientName = typeof recipient === 'object' ? recipient.name : '';

      // Skip invalid emails
      if (!recipientEmail || !recipientEmail.includes('@')) {
        console.warn('[Email] Skipping invalid email:', recipientEmail);
        results.failed += templates.length;
        results.errors.push(`Invalid email: ${recipientEmail}`);
        continue;
      }

      for (const template of templates) {
        try {
          // Personalize email content
          let personalizedHtml = template.html;
          let personalizedText = template.text || '';

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
                subject: template.subject,
                html: personalizedHtml,
                text: personalizedText,
              });
              
              if (error) throw error;
              console.log(`[Email] ✅ Sent via Resend to ${recipientEmail}:`, data?.id);
              results.sent++;
              sent = true;
            } catch (resendErr: any) {
              const resendMessage = String(resendErr?.message || 'Resend send failed');
              if (resendMessage.toLowerCase().includes('you can only send testing emails')) {
                resendRestrictionMessage = resendMessage;
                useResend = false;
              }
              console.log(`[Email] Resend failed for ${recipientEmail}, trying Gmail:`, resendMessage);
            }
          }

          // Fallback to Gmail/nodemailer
          if (!sent) {
            if (!HAS_GMAIL_CREDENTIALS) {
              throw new Error(
                resendRestrictionMessage
                  ? `Resend is in testing mode and Gmail fallback is not configured. ${resendRestrictionMessage}`
                  : 'Gmail fallback credentials missing (set GMAIL_USER and GMAIL_APP_PASSWORD).'
              );
            }

            const mailOptions = {
              from: `"GradPilot - Fateh Education" <${GMAIL_USER}>`,
              to: recipientEmail,
              subject: template.subject,
              html: personalizedHtml,
              text: personalizedText,
            };

            const info = await gmailTransporter.sendMail(mailOptions);
            console.log(`[Email] ✅ Sent via Gmail to ${recipientEmail}:`, info.messageId);
            results.sent++;
            if (results.method === 'resend') results.method = 'nodemailer';
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, useResend ? 500 : 1000));
        } catch (err: any) {
          results.failed++;
          const errorMsg = err?.message || 'Unknown error';
          const errorDetail = `Failed to send to ${recipientEmail}: ${errorMsg}`;
          results.errors.push(errorDetail);
          console.error('[Email] ❌ Send error:', errorDetail);
        }
      }
    }

    console.log(`[Email] Campaign complete [${runId}]: ${results.sent} sent, ${results.failed} failed`);
    appendObservabilityLog('api', {
      event: 'email_sender_completed',
      ...requestSummary,
      sent: results.sent,
      failed: results.failed,
      method: results.method,
      sequenceLength: templates.length,
    });

    const totalPlanned = emailList.length * templates.length;
    const allFailed = results.sent === 0 && totalPlanned > 0;

    if (allFailed) {
      response = NextResponse.json(
        {
          success: false,
          sent: results.sent,
          failed: results.failed,
          total: totalPlanned,
          sequenceLength: templates.length,
          testEmailSent: ENABLE_TEST_COPY ? TEST_EMAIL : null,
          runId,
          error: 'All email sends failed. Configure sending provider credentials/domain.',
          details: resendRestrictionMessage || 'Check RESEND domain verification or Gmail app credentials.',
          errors: results.errors.length > 0 ? results.errors.slice(0, 10) : undefined,
        },
        { status: 502 }
      );
      return response;
    }

    response = NextResponse.json({
      success: true,
      sent: results.sent,
      failed: results.failed,
      total: totalPlanned,
      sequenceLength: templates.length,
      testEmailSent: ENABLE_TEST_COPY ? TEST_EMAIL : null,
      runId,
      errors: results.errors.length > 0 ? results.errors.slice(0, 10) : undefined,
    });
    return response;

  } catch (err) {
    error = err as Error;
    console.error('[Email] Error sending bulk emails:', error);
    appendObservabilityLog('errors', {
      event: 'email_sender_failed',
      ...requestSummary,
      errorMessage: error.message,
    });
    response = NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send emails',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
    return response;
  } finally {
    logAuditEvent({
      request,
      response: response || undefined,
      error,
      action: 'email_send_bulk',
      metadata: requestSummary,
      startTime,
    }).catch(() => {});
  }
}
