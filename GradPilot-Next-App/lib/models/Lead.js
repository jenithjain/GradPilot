import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  sourceType: { type: String, default: '' },   // e.g. "LinkedIn Profile", "Reddit User", "Competitor"
  sourceUrl: { type: String, default: '' },
  location: { type: String, default: '' },
  course: { type: String, default: '' },
  country: { type: String, default: '' },
  exam: { type: String, default: '' },
  examDetail: { type: String, default: '' },
  score: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['new', 'in_progress', 'follow_up', 'completed'],
    default: 'new',
  },
  avatar: { type: String, default: '' },
  notes: { type: String, default: '' },
  tags: { type: [String], default: [] },
  counsellorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export default mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
