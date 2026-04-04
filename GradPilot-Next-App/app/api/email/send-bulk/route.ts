import { NextResponse } from 'next/server';
import { Resend } from 'resend';

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

    if (!process.env.RESEND_API_KEY) {
      console.error('[Email] RESEND_API_KEY not found in environment variables');
      console.error('[Email] Available env vars:', Object.keys(process.env).filter(k => k.includes('RESEND')));
      return NextResponse.json(
        { 
          success: false, 
          error: 'RESEND_API_KEY not configured. Please add it to environment variables (Vercel: Settings → Environment Variables)' 
        },
        { status: 500 }
      );
    }

    console.log('[Email] RESEND_API_KEY found, initializing Resend client');
    
    // Initialize Resend client with API key
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Prefer a single constant sender defined in env: EMAIL_FROM="Display Name <address@domain>"
    // This allows centralized control of the branded sender identity.
    let fromAddress = process.env.EMAIL_FROM;
    if (!fromAddress) {
      // Fallback for local testing without verified domain
      fromAddress = 'GradPilot <onboarding@resend.dev>';
    }

    // Clean up the from address - remove extra quotes if present
    fromAddress = fromAddress.trim().replace(/^["']|["']$/g, '');

    // Validate and fix format if needed
    const angleMatch = /.+<[^<>@]+@[^<>@]+\.[^<>@]+>$/.test(fromAddress);
    const simpleEmailMatch = /^[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+$/.test(fromAddress);
    
    if (!angleMatch && !simpleEmailMatch) {
      console.warn('[Email] EMAIL_FROM has invalid format, using default:', fromAddress);
      fromAddress = 'GradPilot <onboarding@resend.dev>';
    } else if (simpleEmailMatch && !angleMatch) {
      // If it's just an email, wrap it in proper format
      fromAddress = `GradPilot <${fromAddress}>`;
    }

    console.log('[Email] Using sender:', fromAddress);

    // Send emails in batches to avoid rate limits
    const batchSize = 100; // Resend allows up to 100 recipients per batch
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < emailList.length; i += batchSize) {
      const batch = emailList.slice(i, i + batchSize);
      
      // Send individual emails (to allow personalization)
      for (const recipient of batch) {
        try {
          const recipientEmail = typeof recipient === 'string' ? recipient : recipient.email;
          const recipientName = typeof recipient === 'object' ? recipient.name : '';

          // Personalize email content if name is available
          let personalizedHtml = html;
          let personalizedText = text || '';

          if (recipientName) {
            personalizedHtml = personalizedHtml.replace(/{{name}}/g, recipientName);
            personalizedText = personalizedText.replace(/{{name}}/g, recipientName);
          } else {
            personalizedHtml = personalizedHtml.replace(/{{name}}/g, 'there');
            personalizedText = personalizedText.replace(/{{name}}/g, 'there');
          }

          const { data, error } = await resend.emails.send({
            from: fromAddress,
            to: recipientEmail,
            subject,
            html: personalizedHtml,
            text: personalizedText,
          });

          if (error) {
            throw error;
          }

          console.log(`[Email] Sent to ${recipientEmail}:`, data?.id);
          results.sent++;
        } catch (err: any) {
          results.failed++;
          const errorMsg = err?.message || err?.error || 'Unknown error';
          const errorDetail = `Failed to send to ${typeof recipient === 'string' ? recipient : recipient.email}: ${errorMsg}`;
          results.errors.push(errorDetail);
          console.error('[Email] Send error:', errorDetail, err);
        }

        // Rate limiting: Wait 500ms between emails to avoid hitting API limits (2 req/sec = 500ms)
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return NextResponse.json({
      success: true,
      sent: results.sent,
      failed: results.failed,
      total: emailList.length,
      errors: results.errors.length > 0 ? results.errors.slice(0, 10) : undefined, // Return first 10 errors
    });

  } catch (error) {
    console.error('Error sending bulk emails:', error);
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
