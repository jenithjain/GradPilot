import mongoose from 'mongoose';

const TranscriptEntrySchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system', 'unknown'],
      default: 'unknown',
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false }
);

const RawEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      default: 'message',
    },
    origin: {
      type: String,
      default: '',
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const CounsellorSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['liveavatar'],
      default: 'liveavatar',
      required: true,
      index: true,
    },
    embedId: {
      type: String,
      default: '',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'failed'],
      default: 'active',
      index: true,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    rawEvents: {
      type: [RawEventSchema],
      default: [],
    },
    transcript: {
      type: [TranscriptEntrySchema],
      default: [],
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    lastEventAt: {
      type: Date,
      default: Date.now,
    },
    summary: {
      type: String,
      default: '',
    },
    followUpQuestions: {
      type: [String],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

CounsellorSessionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.CounsellorSession ||
  mongoose.model('CounsellorSession', CounsellorSessionSchema);
