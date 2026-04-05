import mongoose from 'mongoose';

/**
 * Ephemeral per-phone WhatsApp conversation state.
 * Tracks multi-turn scheduling flows (collecting date, time, confirmation).
 * TTL-indexed: auto-deleted after 30 minutes of inactivity.
 */
const WhatsAppStateSchema = new mongoose.Schema(
  {
    phoneNumber: { type: String, required: true, unique: true, index: true },

    // Current step in the flow
    step: {
      type: String,
      enum: ['idle', 'awaiting_date', 'awaiting_time', 'awaiting_confirm'],
      default: 'idle',
    },

    // Partial booking data collected so far
    pendingDate: { type: String, default: null },   // e.g. "15 April 2026"
    pendingTime: { type: String, default: null },   // e.g. "10:00 AM"

    updatedAt: { type: Date, default: Date.now, expires: 1800 }, // 30-min TTL
  },
);

WhatsAppStateSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 1800 });

export default mongoose.models.WhatsAppState || mongoose.model('WhatsAppState', WhatsAppStateSchema);
