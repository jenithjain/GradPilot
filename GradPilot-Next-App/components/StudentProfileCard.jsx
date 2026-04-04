'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, Circle, Pencil, Check, X, Phone,
  GraduationCap, MapPin, BookOpen, Calendar, Wallet,
  Target, AlertCircle, FileText, FlaskConical, Award, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * The 12 KYC fields the voice agent collects, in display order.
 * Each entry maps a DB key → human label, icon, and the set of valid options.
 */
const PROFILE_FIELDS = [
  {
    key: 'educationLevel',
    label: 'Education Level',
    icon: GraduationCap,
    options: ['10th/SSC', '12th/HSC', 'Diploma', 'Bachelors', 'Masters', 'PhD', 'Other'],
  },
  {
    key: 'fieldOfStudy',
    label: 'Field of Study',
    icon: BookOpen,
    options: ['Engineering', 'Business/MBA', 'Medicine', 'Arts & Humanities', 'Science', 'Law', 'IT/Computer Science', 'Other'],
  },
  {
    key: 'institution',
    label: 'Institution',
    icon: Award,
    freeText: true,
  },
  {
    key: 'gpaPercentage',
    label: 'GPA / Percentage',
    icon: Target,
    options: ['Below 50%', '50-60%', '60-70%', '70-80%', '80-90%', '90%+'],
  },
  {
    key: 'testStatus',
    label: 'Test Status',
    icon: FlaskConical,
    options: ['Not Started', 'Preparing', 'Booked Exam', 'Score Available', 'Not Required'],
  },
  {
    key: 'testScore',
    label: 'Test Score',
    icon: Target,
    options: ['Below 5.5', '5.5-6.0', '6.0-6.5', '6.5-7.0', '7.0-7.5', '7.5+', 'N/A'],
  },
  {
    key: 'targetCountries',
    label: 'Target Countries',
    icon: MapPin,
    options: ['UK', 'Ireland', 'USA', 'Canada', 'Australia', 'Germany', 'Other'],
    isArray: true,
  },
  {
    key: 'courseInterest',
    label: 'Course Interest',
    icon: BookOpen,
    options: ['Undergraduate', 'Postgraduate/Masters', 'PhD/Research', 'Foundation Year', 'English Language Course', 'Other'],
  },
  {
    key: 'intakeTiming',
    label: 'Intake Timing',
    icon: Calendar,
    options: ['January 2026', 'May 2026', 'September 2026', 'January 2027', 'Not Sure'],
  },
  {
    key: 'budgetRange',
    label: 'Budget Range',
    icon: Wallet,
    options: ['Below ₹10 Lakhs', '₹10-20 Lakhs', '₹20-30 Lakhs', '₹30-50 Lakhs', '₹50 Lakhs+'],
  },
  {
    key: 'scholarshipInterest',
    label: 'Scholarship Interest',
    icon: Award,
    options: ['Yes, definitely need scholarship', 'Interested but not essential', 'No, self-funded', 'Education loan planned'],
  },
  {
    key: 'primaryObjective',
    label: 'Primary Objective',
    icon: Target,
    options: ['Career Advancement', 'Better Job Opportunities', 'Research & Academia', 'Immigration/PR', 'Personal Growth', 'Other'],
  },
];

/** The default / placeholder values that mean "not really answered" */
const DEFAULT_VALUES = new Set([
  'Other', 'Not specified', 'Not Started', 'N/A', 'Not Sure',
  '6+ Months', 'Below 50%', 'Below ₹10 Lakhs',
]);

function isFieldFilled(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim() !== '' && !DEFAULT_VALUES.has(value);
  return true;
}

function displayValue(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : null;
  if (typeof value === 'string' && value.trim()) return value;
  return null;
}

// ────────────────────────────────────────────────────────────────
// Inline editor for a single field
// ────────────────────────────────────────────────────────────────
function FieldEditor({ field, currentValue, onSave, onCancel }) {
  const [value, setValue] = useState(
    field.isArray ? (currentValue || []) : (currentValue || '')
  );

  const handleToggleOption = (opt) => {
    setValue((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.includes(opt) ? arr.filter((v) => v !== opt) : [...arr, opt];
    });
  };

  return (
    <div className="mt-2 space-y-2">
      {field.freeText ? (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-emerald-500/40"
          autoFocus
        />
      ) : field.isArray ? (
        <div className="flex flex-wrap gap-1.5">
          {field.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleToggleOption(opt)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                (Array.isArray(value) ? value : []).includes(opt)
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                  : 'border-border bg-muted/40 text-muted-foreground hover:border-emerald-500/40'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {field.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setValue(opt)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                value === opt
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                  : 'border-border bg-muted/40 text-muted-foreground hover:border-emerald-500/40'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSave(field.key, value)}
          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors cursor-pointer"
        >
          <Check className="h-3.5 w-3.5" /> Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────
export default function StudentProfileCard({ onResumeCall, refreshKey }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Fetch profile on mount and whenever refreshKey changes
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/kyc');
      if (!res.ok) return;
      const data = await res.json();
      setProfile(data.studentProfile || {});
      setIsComplete(!!data.hasCompletedKYC);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile, refreshKey]);

  // Count filled fields
  const filledFields = PROFILE_FIELDS.filter(
    (f) => profile && isFieldFilled(profile[f.key])
  );
  const filledCount = filledFields.length;
  const totalCount = PROFILE_FIELDS.length;
  const progressPct = Math.round((filledCount / totalCount) * 100);

  // Save a single field edit
  const handleSave = async (key, value) => {
    setSaving(true);
    try {
      const res = await fetch('/api/kyc', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }
      setProfile((prev) => ({ ...prev, [key]: value }));
      setEditingField(null);
      toast.success('Updated!');
      // Re-fetch to get server-side completeness check
      fetchProfile();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const hasAnyData = profile && filledCount > 0;

  // Nothing collected yet
  if (!hasAnyData) return null;

  return (
    <div className="space-y-6">
      {/* ── Progress header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="ivy-font text-2xl font-bold text-foreground">
            Your Profile
          </h2>
          <p className="ivy-font mt-1 text-sm text-muted-foreground">
            {isComplete
              ? 'All information collected — you\'re all set!'
              : `${filledCount} of ${totalCount} fields completed`}
          </p>
        </div>
        {!isComplete && onResumeCall && (
          <button
            type="button"
            onClick={onResumeCall}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 hover:bg-emerald-700 cursor-pointer"
          >
            <Phone className="h-4 w-4" />
            Resume Call
          </button>
        )}
      </div>

      {/* ── Progress bar ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="ivy-font font-medium text-muted-foreground">Profile Completion</span>
          <span className="ivy-font font-bold text-emerald-500">{progressPct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/50">
          <div
            className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-400 transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* ── Field cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROFILE_FIELDS.map((field) => {
          const Icon = field.icon;
          const raw = profile?.[field.key];
          const filled = isFieldFilled(raw);
          const display = displayValue(raw);
          const isEditing = editingField === field.key;

          return (
            <div
              key={field.key}
              className={`group relative rounded-2xl border p-4 transition-all ${
                filled
                  ? 'border-emerald-500/20 bg-emerald-500/3'
                  : 'border-border/50 bg-muted/20'
              }`}
            >
              {/* Top row: icon + label + status */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      filled
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : 'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="ivy-font text-xs font-medium text-muted-foreground">
                    {field.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {filled ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                  )}
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => setEditingField(field.key)}
                      className="rounded-md p-1 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground cursor-pointer"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Value */}
              {isEditing ? (
                <FieldEditor
                  field={field}
                  currentValue={raw}
                  onSave={handleSave}
                  onCancel={() => setEditingField(null)}
                />
              ) : (
                <p
                  className={`ivy-font mt-2 text-sm font-semibold leading-snug ${
                    filled ? 'text-foreground' : 'text-muted-foreground/50 italic'
                  }`}
                >
                  {display || 'Not provided yet'}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-6 py-4 shadow-xl">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <span className="ivy-font text-sm font-medium text-foreground">Saving...</span>
          </div>
        </div>
      )}
    </div>
  );
}
