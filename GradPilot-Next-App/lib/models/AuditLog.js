import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  // Request Information
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  method: {
    type: String,
    required: false,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  },
  url: {
    type: String,
    required: false,
    index: true,
  },
  path: {
    type: String,
    required: false,
  },
  
  // User Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  userEmail: String,
  sessionId: String,
  
  // Network Information
  ip: {
    type: String,
    index: true,
  },
  userAgent: String,
  referer: String,
  origin: String,
  
  // Request Details
  requestHeaders: mongoose.Schema.Types.Mixed,
  requestBody: mongoose.Schema.Types.Mixed,
  queryParams: mongoose.Schema.Types.Mixed,
  
  // Response Details
  statusCode: {
    type: Number,
    index: true,
  },
  responseTime: Number, // milliseconds
  responseSize: Number, // bytes
  
  // Error Information
  error: {
    message: String,
    stack: String,
    code: String,
  },
  
  // Additional Context
  level: {
    type: String,
    enum: ['info', 'warn', 'error', 'critical'],
    default: 'info',
    index: true,
  },
  category: {
    type: String,
    enum: ['api', 'auth', 'campaign', 'social', 'workflow', 'image', 'other'],
    default: 'other',
    index: true,
  },
  action: String, // e.g., "user_login", "campaign_create", "image_upload"
  metadata: mongoose.Schema.Types.Mixed,
  
  // Geolocation (optional, can be enriched)
  country: String,
  city: String,
  
  // Performance Metrics
  memoryUsage: Number,
  cpuUsage: Number,
}, {
  timestamps: true,
  collection: 'audit_logs',
});

// Indexes for efficient querying
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ level: 1, timestamp: -1 });
AuditLogSchema.index({ category: 1, timestamp: -1 });
AuditLogSchema.index({ ip: 1, timestamp: -1 });
AuditLogSchema.index({ statusCode: 1, timestamp: -1 });

// Combined: timestamp descending index with TTL to auto-delete logs older than 90 days
AuditLogSchema.index({ timestamp: -1 }, { expireAfterSeconds: 7776000 });

export default mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
