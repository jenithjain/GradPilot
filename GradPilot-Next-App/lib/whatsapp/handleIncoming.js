import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import Booking from '@/lib/models/Booking';
import CounsellorSession from '@/lib/models/CounsellorSession';
import WhatsAppState from '@/lib/models/WhatsAppState';
import { sendWhatsAppMessage } from '@/lib/whatsapp/sendMessage';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  COUNSELLING_FIELDS,
  buildCounsellingProgress,
  buildCounsellingSnapshot,
  isMeaningfulCounsellingValue,
} from '@/lib/counselling-profile';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const COUNSELLOR_PHONE = process.env.COUNSELLOR_WHATSAPP_NUMBER || '';

/**
 * Detect intent from a user WhatsApp message.
 * Returns one of: 'schedule_booking' | 'cancel_booking' | 'status_check' | 'general'
 */
async function detectIntent(message) {
  const lower = message.toLowerCase();

  // Quick keyword match before calling Gemini
  const bookingKeywords = [
    'schedule', 'book', 'appointment', 'counselling', 'counseling',
    'meet', 'session', 'call', 'talk', '1:1', 'one on one', 'one-on-one',
  ];
  const cancelKeywords = ['cancel', 'cancell', 'reschedule', 'postpone'];
  const statusKeywords = ['status', 'when is my', 'my booking', 'my appointment'];

  if (cancelKeywords.some((k) => lower.includes(k))) return 'cancel_booking';
  if (statusKeywords.some((k) => lower.includes(k))) return 'status_check';
  if (bookingKeywords.some((k) => lower.includes(k))) return 'schedule_booking';

  // Fallback to Gemini for ambiguous messages
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(
      `Classify this WhatsApp message from a student to a study-abroad counselling service into one of these intents: schedule_booking, cancel_booking, status_check, general.\n\nMessage: "${message}"\n\nReply with ONLY the intent label, nothing else.`
    );
    const intent = result.response.text().trim().toLowerCase();
    if (['schedule_booking', 'cancel_booking', 'status_check', 'general'].includes(intent)) {
      return intent;
    }
  } catch {
    // Ignore Gemini errors, fall through to general
  }

  return 'general';
}

/**
 * Parse a natural language date/time string into a JS Date.
 * Returns null if parsing fails.
 */
async function parseDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const today = new Date().toISOString().split('T')[0];
    const result = await model.generateContent(
      `Today is ${today}. Convert these into an ISO 8601 datetime string (UTC+5:30 IST):\nDate: "${dateStr}"\nTime: "${timeStr}"\n\nReply with ONLY the ISO string like "2026-04-10T10:00:00+05:30", nothing else. If you cannot parse, reply "null".`
    );
    const iso = result.response.text().trim();
    if (iso === 'null') return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Get or create the per-phone WhatsApp conversation state.
 */
async function getState(phoneNumber) {
  let state = await WhatsAppState.findOne({ phoneNumber });
  if (!state) {
    state = await WhatsAppState.create({ phoneNumber, step: 'idle' });
  }
  return state;
}

/**
 * Look up an existing user record by phone number.
 */
async function findUserByPhone(phoneNumber) {
  // Try exact match and 10-digit local variant
  const local = phoneNumber.replace(/^91/, '');
  return User.findOne({
    $or: [
      { 'studentProfile.phoneNumber': phoneNumber },
      { 'studentProfile.phoneNumber': local },
      { 'studentProfile.phoneNumber': `+${phoneNumber}` },
      { 'studentProfile.phoneNumber': `+91${local}` },
    ],
  }).lean();
}

/**
 * Build a rich context string from the student's profile, past sessions, and bookings.
 */
async function buildStudentContext(user, phoneNumber) {
  const lines = [];

  // Profile data
  if (user?.studentProfile) {
    const snapshot = buildCounsellingSnapshot(user.studentProfile);
    const progress = buildCounsellingProgress(user.studentProfile);

    lines.push('## Student Profile');
    lines.push(`Name: ${snapshot.studentName || user.name || 'Unknown'}`);

    for (const field of COUNSELLING_FIELDS) {
      if (field.key === 'studentName') continue;
      const value = snapshot[field.key];
      if (!isMeaningfulCounsellingValue(value)) continue;
      lines.push(`${field.label}: ${Array.isArray(value) ? value.join(', ') : value}`);
    }

    lines.push('');
    lines.push('## KYC Progress');
    if (progress.isComplete) {
      lines.push('Profile is COMPLETE.');
    } else {
      lines.push(`${progress.filledCount}/${progress.totalCount} fields filled.`);
      if (progress.missingLabels.length > 0) {
        lines.push(`Missing: ${progress.missingLabels.join(', ')}`);
      }
    }
  } else {
    lines.push('## Profile');
    lines.push(`Name: ${user?.name || 'Unknown'}`);
    lines.push('No KYC profile completed yet.');
  }

  // Past counsellor sessions
  const pastSessions = await CounsellorSession.find({
    userId: user?._id,
    status: 'completed',
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('title summary followUpQuestions startedAt')
    .lean();

  lines.push('');
  lines.push('## Past Counselling Sessions');
  if (pastSessions.length === 0) {
    lines.push('No past sessions recorded.');
  } else {
    for (const s of pastSessions) {
      const date = new Date(s.startedAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
      lines.push(`[${date}] ${s.title || 'Session'}`);
      if (s.summary) lines.push(`  Summary: ${s.summary}`);
      if (s.followUpQuestions?.length > 0) {
        lines.push(`  Follow-ups: ${s.followUpQuestions.join(' | ')}`);
      }
    }
  }

  // Upcoming bookings
  const upcoming = await Booking.findOne({
    phoneNumber,
    status: { $in: ['pending', 'confirmed'] },
    scheduledAt: { $gte: new Date() },
  }).sort({ scheduledAt: 1 }).lean();

  lines.push('');
  lines.push('## Upcoming Bookings');
  if (upcoming) {
    const dateDisplay = upcoming.scheduledAt.toLocaleString('en-IN', {
      dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata',
    });
    lines.push(`Next session: ${dateDisplay} (${upcoming.status})`);
  } else {
    lines.push('No upcoming sessions booked.');
  }

  return lines.join('\n');
}

/**
 * Generate a context-aware reply using Gemini + student data.
 */
async function generateContextReply(messageText, studentContext, studentName) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(
      `You are GradPilot's WhatsApp counselling assistant — a warm, professional study-abroad advisor.

You have the following information about this student:

${studentContext}

The student (${studentName}) sent this WhatsApp message:
"${messageText}"

Instructions:
- Reply in a friendly, concise WhatsApp style (use *bold*, emoji where appropriate).
- Reference their specific profile data, past sessions, and progress naturally.
- If they're asking about progress, give them a brief personalized status update.
- Always mention that they can type *schedule* to book a 1:1 counselling session.
- Keep the reply under 200 words.
- Do NOT make up information not present in the profile.
- Format for WhatsApp (no markdown headers, use *bold* and bullet points with •).`
    );
    return result.response.text().trim();
  } catch (err) {
    console.error('[whatsapp-incoming] Gemini context reply failed:', err);
    return null;
  }
}

/**
 * Main handler: process one incoming WhatsApp message and reply.
 * Called from the webhook route.
 *
 * @param {string} phoneNumber  - Sender number, digits only (e.g. "919876543210")
 * @param {string} messageText  - Raw message body
 */
export async function handleIncomingMessage(phoneNumber, messageText) {
  await dbConnect();

  const text = (messageText || '').trim();
  if (!text) return;

  const state = await getState(phoneNumber);
  const user = await findUserByPhone(phoneNumber);
  const studentName = user?.name || user?.studentProfile?.studentName || 'Student';

  // ── Active scheduling flow ─────────────────────────────────────────
  if (state.step === 'awaiting_date') {
    state.pendingDate = text;
    state.step = 'awaiting_time';
    state.updatedAt = new Date();
    await state.save();

    await sendWhatsAppMessage(
      phoneNumber,
      `Got it — *${text}*! ⏰ What time works for you? (e.g. *10 AM*, *2:30 PM*)`
    );
    return;
  }

  if (state.step === 'awaiting_time') {
    state.pendingTime = text;
    state.step = 'awaiting_confirm';
    state.updatedAt = new Date();
    await state.save();

    await sendWhatsAppMessage(
      phoneNumber,
      `Perfect! Here's your booking summary:\n\n📅 *Date:* ${state.pendingDate}\n⏰ *Time:* ${text}\n\nReply *CONFIRM* to book or *CANCEL* to start over.`
    );
    return;
  }

  if (state.step === 'awaiting_confirm') {
    const reply = text.toUpperCase();

    if (reply === 'CANCEL' || reply === 'NO') {
      state.step = 'idle';
      state.pendingDate = null;
      state.pendingTime = null;
      state.updatedAt = new Date();
      await state.save();

      await sendWhatsAppMessage(phoneNumber, `No problem! Booking cancelled. Type *schedule* anytime to book again. 😊`);
      return;
    }

    if (reply === 'CONFIRM' || reply === 'YES' || reply === 'OK') {
      const scheduledAt = await parseDateTime(state.pendingDate, state.pendingTime);

      const booking = await Booking.create({
        userId: user?._id || null,
        phoneNumber,
        studentName,
        counsellorName: 'GradPilot Counsellor',
        counsellorPhone: COUNSELLOR_PHONE,
        scheduledAt: scheduledAt || new Date(Date.now() + 24 * 60 * 60 * 1000), // default +1 day if parse fails
        status: 'confirmed',
        notes: `Booked via WhatsApp on ${new Date().toLocaleDateString('en-IN')}`,
      });

      // Reset state
      state.step = 'idle';
      state.pendingDate = null;
      state.pendingTime = null;
      state.updatedAt = new Date();
      await state.save();

      // Confirm to student
      const dateDisplay = scheduledAt
        ? scheduledAt.toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
        : `${state.pendingDate} at ${state.pendingTime}`;

      await sendWhatsAppMessage(
        phoneNumber,
        `✅ *Booking Confirmed!*\n\n📅 *${dateDisplay}*\n🎓 *GradPilot Counsellor Session*\n\nYou'll receive a reminder before the session. See you soon, ${studentName}! 🌟\n\n_Booking ID: ${String(booking._id).slice(-8).toUpperCase()}_`
      );

      // Notify counsellor
      if (COUNSELLOR_PHONE) {
        await sendWhatsAppMessage(
          COUNSELLOR_PHONE,
          `📅 *New 1:1 Session Booked*\n\n👤 *Student:* ${studentName}\n📱 *Phone:* +${phoneNumber}\n🗓 *Date/Time:* ${dateDisplay}\n\n_Booking ID: ${String(booking._id).slice(-8).toUpperCase()}_`
        ).catch((err) => console.error('[whatsapp-incoming] counsellor notify failed:', err));
      }

      return;
    }

    // Unclear response — prompt again
    await sendWhatsAppMessage(
      phoneNumber,
      `Please reply *CONFIRM* to book your session on *${state.pendingDate}* at *${state.pendingTime}*, or *CANCEL* to start over.`
    );
    return;
  }

  // ── Intent detection for new messages ─────────────────────────────
  const intent = await detectIntent(text);

  if (intent === 'schedule_booking') {
    state.step = 'awaiting_date';
    state.pendingDate = null;
    state.pendingTime = null;
    state.updatedAt = new Date();
    await state.save();

    // Build personalized greeting with context
    const context = await buildStudentContext(user, phoneNumber);
    let greeting = `Hi ${studentName}! 👋 Let's schedule your *1:1 Counselling Session*.\n\n`;

    // Add a quick progress teaser
    if (user?.studentProfile) {
      const progress = buildCounsellingProgress(user.studentProfile);
      const snapshot = buildCounsellingSnapshot(user.studentProfile);
      const countries = snapshot.targetCountries;
      const countryStr = Array.isArray(countries) && countries.length > 0
        ? countries.join(', ')
        : null;

      if (progress.isComplete) {
        greeting += `✅ Your profile is complete`;
        if (countryStr) greeting += ` — targeting *${countryStr}*`;
        greeting += `. We'll focus on your next steps in the session.\n\n`;
      } else {
        greeting += `📊 Your profile is *${progress.filledCount}/${progress.totalCount}* fields done`;
        if (countryStr) greeting += ` (interested in *${countryStr}*)`;
        greeting += `. We can fill the gaps in your session.\n\n`;
      }
    }

    greeting += `📅 What date works for you?\n_(e.g. *15 April*, *next Monday*, *tomorrow*)_`;

    await sendWhatsAppMessage(phoneNumber, greeting);
    return;
  }

  if (intent === 'cancel_booking') {
    const latestBooking = await Booking.findOne({
      phoneNumber,
      status: { $in: ['pending', 'confirmed'] },
    }).sort({ createdAt: -1 });

    if (!latestBooking) {
      await sendWhatsAppMessage(phoneNumber, `You don't have any upcoming bookings to cancel. Type *schedule* to book a new session! 😊`);
      return;
    }

    latestBooking.status = 'cancelled';
    await latestBooking.save();

    await sendWhatsAppMessage(
      phoneNumber,
      `✅ Your session on *${latestBooking.scheduledAt.toLocaleDateString('en-IN', { dateStyle: 'full', timeZone: 'Asia/Kolkata' })}* has been cancelled.\n\nType *schedule* anytime to book a new one.`
    );
    return;
  }

  if (intent === 'status_check') {
    const upcoming = await Booking.findOne({
      phoneNumber,
      status: { $in: ['pending', 'confirmed'] },
      scheduledAt: { $gte: new Date() },
    }).sort({ scheduledAt: 1 });

    if (!upcoming) {
      await sendWhatsAppMessage(phoneNumber, `You have no upcoming sessions. Type *schedule* to book one! 📅`);
      return;
    }

    const dateDisplay = upcoming.scheduledAt.toLocaleString('en-IN', {
      dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata',
    });

    await sendWhatsAppMessage(
      phoneNumber,
      `📅 *Upcoming Session*\n\n🗓 *${dateDisplay}*\n📌 *Status:* ${upcoming.status.charAt(0).toUpperCase() + upcoming.status.slice(1)}\n_ID: ${String(upcoming._id).slice(-8).toUpperCase()}_\n\nReply *cancel* to cancel it.`
    );
    return;
  }

  // General — context-aware reply using student profile + Gemini
  const context = await buildStudentContext(user, phoneNumber);
  const aiReply = await generateContextReply(text, context, studentName);

  if (aiReply) {
    await sendWhatsAppMessage(phoneNumber, aiReply);
  } else {
    // Fallback if Gemini fails
    let fallback = `Hi ${studentName}! 👋 I'm the *GradPilot Assistant*.\n\n`;

    if (user?.studentProfile) {
      const progress = buildCounsellingProgress(user.studentProfile);
      fallback += `📊 *Your Profile:* ${progress.filledCount}/${progress.totalCount} fields completed\n`;
      if (!progress.isComplete && progress.missingLabels.length > 0) {
        fallback += `📝 *Still needed:* ${progress.missingLabels.slice(0, 3).join(', ')}\n`;
      }
      fallback += '\n';
    }

    fallback += `Here's what I can do:\n• Type *schedule* — Book a 1:1 counselling session\n• Type *status* — Check your upcoming session\n• Type *cancel* — Cancel a session\n• Ask me anything about your progress! 🌟`;

    await sendWhatsAppMessage(phoneNumber, fallback);
  }
}
