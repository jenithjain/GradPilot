import mongoose from 'mongoose';

/**
 * Singleton document that tracks the last processed WhatsApp message timestamp.
 * Used by the polling mechanism to avoid re-processing messages.
 */
const WhatsAppPollStateSchema = new mongoose.Schema({
  _id: { type: String, default: 'singleton' },
  lastPollTimestamp: { type: Number, default: 0 }, // Unix epoch seconds
  lastMessageId: { type: String, default: '' },
});

export default mongoose.models.WhatsAppPollState ||
  mongoose.model('WhatsAppPollState', WhatsAppPollStateSchema);
