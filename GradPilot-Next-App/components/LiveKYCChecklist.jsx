'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

/**
 * The 12 KYC fields in collection order — mirrors PROFILE_FIELDS
 * in StudentProfileCard.
 */
const CHECKLIST_FIELDS = [
  { key: 'educationLevel',       label: 'Education Level' },
  { key: 'fieldOfStudy',         label: 'Field of Study' },
  { key: 'institution',          label: 'Institution' },
  { key: 'gpaPercentage',        label: 'GPA / Percentage' },
  { key: 'testStatus',           label: 'Test Status' },
  { key: 'testScore',            label: 'Test Score' },
  { key: 'targetCountries',      label: 'Target Countries' },
  { key: 'courseInterest',       label: 'Course Interest' },
  { key: 'intakeTiming',         label: 'Intake Timing' },
  { key: 'budgetRange',          label: 'Budget Range' },
  { key: 'scholarshipInterest',  label: 'Scholarship Interest' },
  { key: 'primaryObjective',     label: 'Primary Objective' },
];

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

/**
 * A live checklist panel that polls /api/kyc every few seconds while the
 * voice agent is active, so the user sees fields light up in real time.
 *
 * Props:
 *  - active: boolean — whether we're currently in a call (controls polling)
 *  - className: extra tailwind classes for the wrapper
 */
export default function LiveKYCChecklist({ active = true, className = '' }) {
  const [profile, setProfile] = useState(null);
  const intervalRef = useRef(null);

  // Fetch once immediately, then poll while active
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/kyc');
        if (!res.ok) return;
        const data = await res.json();
        setProfile(data.studentProfile || {});
      } catch {
        // silent
      }
    };

    fetchProfile();

    if (active) {
      intervalRef.current = window.setInterval(fetchProfile, 4000);
    }

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [active]);

  const filledCount = profile
    ? CHECKLIST_FIELDS.filter((f) => isFieldFilled(profile[f.key])).length
    : 0;
  const totalCount = CHECKLIST_FIELDS.length;

  return (
    <div className={`flex flex-col rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
        <div>
          <h3 className="ivy-font text-sm font-bold text-foreground">Profile Checklist</h3>
          <p className="ivy-font mt-0.5 text-xs text-muted-foreground">
            {filledCount}/{totalCount} recorded
          </p>
        </div>
        {active && (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
            <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
            <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">Live</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
          <div
            className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-400 transition-all duration-700 ease-out"
            style={{ width: `${Math.round((filledCount / totalCount) * 100)}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        <ul className="space-y-1">
          {CHECKLIST_FIELDS.map((field) => {
            const filled = profile ? isFieldFilled(profile[field.key]) : false;
            return (
              <li
                key={field.key}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                  filled ? 'text-foreground' : 'text-muted-foreground/60'
                }`}
              >
                {filled ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/30" />
                )}
                <span className={`ivy-font text-xs font-medium ${filled ? 'line-through decoration-emerald-500/40' : ''}`}>
                  {field.label}
                </span>
                {filled && profile && (
                  <span className="ml-auto truncate text-[10px] text-muted-foreground max-w-[120px]">
                    {Array.isArray(profile[field.key])
                      ? profile[field.key].join(', ')
                      : profile[field.key]}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
