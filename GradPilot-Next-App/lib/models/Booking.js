import mongoose from 'mongoose';

/**
 * Tracks scheduled 1:1 counsellor sessions booked via WhatsApp or the dashboard.
 */
const BookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null = booked by anonymous WhatsApp number
      index: true,
    },

    // WhatsApp phone number of the student (e.g. "919876543210")
    phoneNumber: {
      type: String,
      required: true,
      index: true,
    },

    studentName: { type: String, default: '' },
    counsellorName: { type: String, default: '' },

    // Counsellor's WhatsApp number to notify
    counsellorPhone: { type: String, default: '' },

    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },

    durationMinutes: {
      type: Number,
      default: 30,
    },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
      index: true,
    },

    notes: { type: String, default: '' },

    // Tracks the WhatsApp multi-turn booking conversation state
    conversationState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Booking || mongoose.model('Booking', BookingSchema);
