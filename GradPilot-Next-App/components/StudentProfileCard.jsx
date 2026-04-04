'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  FlaskConical,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Target,
  User,
  Wallet,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  COUNSELLING_FIELDS,
  buildCounsellingPatch,
  getCounsellingFieldValue,
  isMeaningfulCounsellingValue,
} from '@/lib/counselling-profile';

const FIELD_ICONS = {
  studentName: User,
  phoneNumber: Phone,
  contactEmail: Mail,
  currentLocation: MapPin,
  educationLevel: GraduationCap,
  fieldOfStudy: BookOpen,
  institution: Award,
  gpaPercentage: Target,
  targetCountries: MapPin,
  courseInterest: BookOpen,
  englishTestStatus: FlaskConical,
  budgetRange: Wallet,
  applicationTimeline: Clock,
};

function displayValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value || null;
}

function FieldEditor({ field, currentValue, onSave, onCancel }) {
  const [value, setValue] = useState(
    Array.isArray(currentValue) ? currentValue.join(', ') : (currentValue || '')
  );

  return (
    <div className="mt-2 space-y-2">
      <input
        type={field.inputType || 'text'}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={field.placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-emerald-500/40"
        autoFocus
      />
      {field.isArray && (
        <p className="text-[11px] text-muted-foreground">
          Separate multiple values with commas.
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSave(field.key, value)}
          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 cursor-pointer"
        >
          <Check className="h-3.5 w-3.5" /> Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted cursor-pointer"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}

export default function StudentProfileCard({ onResumeCall, refreshKey }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ filledCount: 0, totalCount: COUNSELLING_FIELDS.length, isComplete: false });

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/kyc');
      if (!res.ok) return;

      const data = await res.json();
      setProfile(data.studentProfile || {});
      setProgress(data.counsellingProgress || { filledCount: 0, totalCount: COUNSELLING_FIELDS.length, isComplete: false });
    } catch {
      // Silent refresh failure.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile, refreshKey]);

  useEffect(() => {
    const handleProfileUpdate = () => {
      fetchProfile();
    };

    window.addEventListener('counselling-profile:updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('counselling-profile:updated', handleProfileUpdate);
    };
  }, [fetchProfile]);

  const handleSave = async (key, value) => {
    setSaving(true);

    try {
      const patch = buildCounsellingPatch(key, value);
      const res = await fetch('/api/kyc', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }

      setProfile((prev) => ({ ...(prev || {}), ...patch }));
      setEditingField(null);
      toast.success('Updated');
      window.dispatchEvent(new CustomEvent('counselling-profile:updated', { detail: { source: 'manual-edit' } }));
      fetchProfile();
    } catch (error) {
      toast.error(error.message || 'Unable to save this field');
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

  const filledCount = progress.filledCount || 0;
  const totalCount = progress.totalCount || COUNSELLING_FIELDS.length;
  const isComplete = !!progress.isComplete;
  const progressPct = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;
  const hasAnyData = COUNSELLING_FIELDS.some((field) =>
    isMeaningfulCounsellingValue(getCounsellingFieldValue(profile || {}, field.key))
  );

  if (!hasAnyData) return null;

  return (
    <div className="space-y-6 rounded-4xl border border-border/50 bg-card/70 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="ivy-font text-2xl font-bold text-foreground">
            Counselling Profile
          </h2>
          <p className="ivy-font mt-1 text-sm text-muted-foreground">
            {isComplete
              ? 'All counselling fields are recorded. Resume is hidden because nothing is missing.'
              : `${filledCount} of ${totalCount} counselling fields recorded`}
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

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="ivy-font font-medium text-muted-foreground">Counselling Completion</span>
          <span className="ivy-font font-bold text-emerald-500">{progressPct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/50">
          <div
            className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-400 transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {COUNSELLING_FIELDS.map((field) => {
          const Icon = FIELD_ICONS[field.key] || User;
          const rawValue = getCounsellingFieldValue(profile || {}, field.key);
          const filled = isMeaningfulCounsellingValue(rawValue);
          const shownValue = displayValue(rawValue);
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
                      title={`Edit ${field.label}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {isEditing ? (
                <FieldEditor
                  field={field}
                  currentValue={rawValue}
                  onSave={handleSave}
                  onCancel={() => setEditingField(null)}
                />
              ) : (
                <p
                  className={`ivy-font mt-2 text-sm font-semibold leading-snug ${
                    filled ? 'text-foreground' : 'text-muted-foreground/50 italic'
                  }`}
                >
                  {shownValue || 'Not recorded yet'}
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