import mongoose from 'mongoose';

/**
 * ScriptWorkflow is used for video-generation workflows.
 * It stores nodes/edges and allows the video route to persist
 * generated video URLs directly into node data.
 */
const NodeSchema = new mongoose.Schema({
  id: String,
  type: String,
  position: { x: Number, y: Number },
  data: mongoose.Schema.Types.Mixed,
}, { _id: false });

const EdgeSchema = new mongoose.Schema({
  id: String,
  source: String,
  target: String,
  type: String,
  animated: Boolean,
  data: mongoose.Schema.Types.Mixed,
}, { _id: false });

const ScriptWorkflowSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  brief: { type: String },
  strategyRationale: { type: String },
  nodes: { type: [NodeSchema], default: [] },
  edges: { type: [EdgeSchema], default: [] },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.models.ScriptWorkflow || mongoose.model('ScriptWorkflow', ScriptWorkflowSchema);
