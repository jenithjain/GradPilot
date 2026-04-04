import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * Student Profile Schema (KYC Data)
 * This is embedded within the User document for efficient access
 */
const StudentProfileSchema = new mongoose.Schema({
  // Personal Information (Step 1)
  educationLevel: {
    type: String,
    enum: ['10th/SSC', '12th/HSC', 'Diploma', 'Bachelors', 'Masters', 'PhD', 'Other'],
    required: true
  },
  fieldOfStudy: {
    type: String,
    enum: ['Engineering', 'Business/MBA', 'Medicine', 'Arts & Humanities', 'Science', 'Law', 'IT/Computer Science', 'Other'],
    required: true
  },
  institution: {
    type: String,
    required: true
  },

  // Academic Details (Step 2)
  gpaPercentage: {
    type: String,
    enum: ['Below 50%', '50-60%', '60-70%', '70-80%', '80-90%', '90%+'],
    required: true
  },
  testStatus: {
    type: String,
    enum: ['Not Started', 'Preparing', 'Booked Exam', 'Score Available', 'Not Required'],
    required: true
  },
  testScore: {
    type: String,
    enum: ['Below 5.5', '5.5-6.0', '6.0-6.5', '6.5-7.0', '7.0-7.5', '7.5+', 'N/A'],
    required: true
  },

  // Study Preferences (Step 3)
  targetCountries: {
    type: [String],
    enum: ['UK', 'Ireland', 'USA', 'Canada', 'Australia', 'Germany', 'Other'],
    required: true
  },
  courseInterest: {
    type: String,
    enum: ['Undergraduate', 'Postgraduate/Masters', 'PhD/Research', 'Foundation Year', 'English Language Course', 'Other'],
    required: true
  },

  // Timeline & Intake (Step 4)
  intakeTiming: {
    type: String,
    enum: ['January 2026', 'May 2026', 'September 2026', 'January 2027', 'Not Sure'],
    required: true
  },
  applicationTimeline: {
    type: String,
    enum: ['Immediately', 'Within 1 Month', '1-3 Months', '3-6 Months', '6+ Months'],
    required: true
  },

  // Financial Planning (Step 5)
  budgetRange: {
    type: String,
    enum: ['Below ₹10 Lakhs', '₹10-20 Lakhs', '₹20-30 Lakhs', '₹30-50 Lakhs', '₹50 Lakhs+'],
    required: true
  },
  scholarshipInterest: {
    type: String,
    enum: ['Yes, definitely need scholarship', 'Interested but not essential', 'No, self-funded', 'Education loan planned'],
    required: true
  },

  // Goals & Concerns (Step 6)
  primaryObjective: {
    type: String,
    enum: ['Career Advancement', 'Better Job Opportunities', 'Research & Academia', 'Immigration/PR', 'Personal Growth', 'Other'],
    required: true
  },
  painPoints: {
    type: [String],
    enum: ['University Selection', 'Visa Process', 'Financial Planning', 'Test Preparation', 'Application Deadlines', 'Accommodation'],
    required: true
  },

  // Verification (Step 7)
  documentType: {
    type: String,
    enum: ['Student ID Card', 'Marksheet/Transcript', 'Degree Certificate', 'Passport', 'Other'],
    required: true
  },
  verificationStatus: {
    type: String,
    enum: ['Pending', 'Verified', 'Rejected'],
    default: 'Pending'
  },

  // Extra fields from OCR extraction
  studentName: { type: String },
  phoneNumber: { type: String },
  contactEmail: { type: String },
  currentLocation: { type: String },
  englishTestStatus: { type: String },
  rollNumber: { type: String },
  universityRegNumber: { type: String },
  dateOfBirth: { type: String },
  
  // Metadata
  completedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

/**
 * User Schema with Embedded KYC
 */
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return this.authProvider === 'credentials';
    }
  },
  authProvider: {
    type: String,
    enum: ['credentials', 'google'],
    default: 'credentials',
    required: true
  },
  googleId: {
    type: String,
    sparse: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  image: {
    type: String
  },
  
  // User Role
  role: {
    type: String,
    enum: ['student', 'counsellor'],
    default: 'student',
    required: true
  },
  
  // KYC Data (Embedded) — only for students
  studentProfile: {
    type: StudentProfileSchema,
    default: null
  },
  
  // Onboarding Status
  hasCompletedKYC: {
    type: Boolean,
    default: false
  },
  
  // Social Media Tokens
  socialTokens: {
    linkedin: {
      access_token: { type: String, select: false },
      expires_in: { type: Number, select: false },
      connected_at: { type: Date, select: false }
    },
    twitter: {
      access_token: { type: String, select: false },
      refresh_token: { type: String, select: false },
      expires_in: { type: Number, select: false },
      connected_at: { type: Date, select: false }
    }
  },
  
  // API Keys (Optional for future integrations)
  apiKeys: {
    gemini: { type: String, select: false },
    midjourney: { type: String, select: false },
    other: { type: Map, of: String, select: false }
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) {
    return;
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Prevent model recompilation in development
export default mongoose.models.User || mongoose.model('User', UserSchema);
