import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'agent', 'tool'],
    required: true,
  },
  message: { type: String, default: '' },
  timeInCallSecs: { type: Number, default: 0 },
}, { _id: false });

const ConversationMemorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  conversationId: {
    type: String,
    required: true,
    unique: true,
  },
  agentId: { type: String },
  messages: [MessageSchema],
  summary: { type: String, default: '' },
  extractedFacts: {
    type: Map,
    of: String,
    default: {},
  },
  callDurationSecs: { type: Number, default: 0 },
  mode: {
    type: String,
    enum: ['onboarding', 'buddy'],
    default: 'buddy',
  },
  createdAt: { type: Date, default: Date.now },
});

ConversationMemorySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.ConversationMemory ||
  mongoose.model('ConversationMemory', ConversationMemorySchema);
