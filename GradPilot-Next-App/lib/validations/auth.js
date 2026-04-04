import { z } from 'zod';

// Common disposable and invalid email domains to block
const invalidEmailDomains = [
  'test.com', 'example.com', 'test.test', 'abc.com', 'xyz.com',
  'temp-mail.org', 'guerrillamail.com', 'mailinator.com', '10minutemail.com',
  'throwaway.email', 'tempmail.com', 'fakeinbox.com', 'trashmail.com'
];

// Email validation helper
const isValidBusinessEmail = (email) => {
  const domain = email.split('@')[1]?.toLowerCase();
  
  // Check if domain exists
  if (!domain) return false;
  
  // Block invalid domains
  if (invalidEmailDomains.includes(domain)) return false;
  
  // Block generic patterns
  if (/^(test|demo|sample|example|fake|dummy)/.test(domain)) return false;
  
  // Require proper domain structure
  if (!domain.includes('.') || domain.split('.').length < 2) return false;
  
  // Block single letter domains
  const domainParts = domain.split('.');
  if (domainParts[0].length === 1 || domainParts[1].length === 1) return false;
  
  return true;
};

// Login validation schema
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .refine(isValidBusinessEmail, 'Please use a valid business email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

// Password strength calculation
export const calculatePasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '' };
  
  let score = 0;
  
  // Length bonus
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  
  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 2; // Special characters worth more
  
  // Penalty for common patterns
  if (/^(password|123456|qwerty|abc123)/i.test(password)) score -= 3;
  if (/(.)\1{2,}/.test(password)) score -= 1; // Repeated characters
  
  // Ensure score is between 0 and 10
  score = Math.max(0, Math.min(10, score));
  
  // Map score to strength label
  if (score <= 3) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 5) return { score, label: 'Fair', color: 'bg-orange-500' };
  if (score <= 7) return { score, label: 'Good', color: 'bg-yellow-500' };
  if (score <= 8) return { score, label: 'Strong', color: 'bg-emerald-500' };
  return { score, label: 'Very Strong', color: 'bg-green-600' };
};

// Signup validation schema
export const signupSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email is too long')
    .refine(isValidBusinessEmail, 'Please use a valid business or professional email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z
    .string()
    .min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// KYC validation schemas
export const studentPersonalSchema = z.object({
  educationLevel: z.string().min(1, 'Education level is required'),
  fieldOfStudy: z.string().min(1, 'Field of study is required'),
  institution: z.string().min(1, 'Institution is required'),
});

export const studentAcademicSchema = z.object({
  gpaPercentage: z.string().min(1, 'GPA/Percentage is required'),
  testStatus: z.string().min(1, 'Test status is required'),
  testScore: z.string().min(1, 'Test score is required'),
});

export const studentPreferencesSchema = z.object({
  targetCountries: z.array(z.string()).min(1, 'Select at least one country'),
  courseInterest: z.string().min(1, 'Course interest is required'),
  intakeTiming: z.string().min(1, 'Intake timing is required'),
  applicationTimeline: z.string().min(1, 'Application timeline is required'),
  budgetRange: z.string().min(1, 'Budget range is required'),
  scholarshipInterest: z.string().min(1, 'Scholarship interest is required'),
  primaryObjective: z.string().min(1, 'Primary objective is required'),
  painPoints: z.array(z.string()).min(1, 'Select at least one concern'),
  documentType: z.string().min(1, 'Document type is required'),
});

// Complete KYC schema
export const kycSchema = z.object({
  studentProfile: studentPersonalSchema.merge(studentAcademicSchema).merge(studentPreferencesSchema),
});
