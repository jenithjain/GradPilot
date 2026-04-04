import mongoose from 'mongoose';

const GeneratedVideoSchema = new mongoose.Schema({
  workflowId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  agentId: {
    type: String,
    default: 'unknown',
  },
  agentType: {
    type: String,
    default: 'cinematic-teaser',
  },
  promptIndex: {
    type: Number,
    default: 0,
  },
  promptKey: {
    type: String,
    default: 'prompt_0',
  },
  prompt: {
    type: String,
  },
  sceneName: {
    type: String,
  },
  sceneDetails: {
    type: String,
  },
  localPath: {
    type: String,
  },
  fileName: {
    type: String,
  },
  fileSize: {
    type: Number,
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
  },
  operationId: {
    type: String,
  },
  projectName: {
    type: String,
  },
  draftName: {
    type: String,
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing',
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Compound index for lookups
GeneratedVideoSchema.index({ workflowId: 1, agentType: 1, promptKey: 1 });

export default mongoose.models.GeneratedVideo || mongoose.model('GeneratedVideo', GeneratedVideoSchema);
