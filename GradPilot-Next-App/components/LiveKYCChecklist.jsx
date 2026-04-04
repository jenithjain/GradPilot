'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import {
  COUNSELLING_FIELDS,
  getCounsellingFieldValue,
  isMeaningfulCounsellingValue,
} from '@/lib/counselling-profile';

function formatValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value || '';
}

export default function LiveKYCChecklist({ active = true, className = '' }) {
  const [profile, setProfile] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/kyc');
        if (!res.ok) return;

        const data = await res.json();
        setProfile(data.studentProfile || {});
      } catch {
        // Silent poll failure.
      }
    };

    const handleProfileUpdate = () => {
      fetchProfile();
    };

    fetchProfile();
    window.addEventListener('counselling-profile:updated', handleProfileUpdate);

    if (active) {
      intervalRef.current = window.setInterval(fetchProfile, 3000);
    }

    return () => {
      window.removeEventListener('counselling-profile:updated', handleProfileUpdate);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [active]);

  const filledCount = profile
    ? COUNSELLING_FIELDS.filter((field) =>
        isMeaningfulCounsellingValue(getCounsellingFieldValue(profile, field.key))
      ).length
    : 0;
  const totalCount = COUNSELLING_FIELDS.length;

  return (
    <div className={`flex flex-col rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
        <div>
          <h3 className="ivy-font text-sm font-bold text-foreground">Counselling Checklist</h3>
          <p className="ivy-font mt-0.5 text-xs text-muted-foreground">
            {filledCount}/{totalCount} recorded
          </p>
        </div>
        {active && (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
            <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500">Live</span>
          </div>
        )}
      </div>

      <div className="px-5 pt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
          <div
            className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-400 transition-all duration-700 ease-out"
            style={{ width: `${Math.round((filledCount / totalCount) * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3">
        <ul className="space-y-1">
          {COUNSELLING_FIELDS.map((field) => {
            const value = getCounsellingFieldValue(profile || {}, field.key);
            const filled = isMeaningfulCounsellingValue(value);

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
                {filled && (
                  <span className="ml-auto max-w-[120px] truncate text-[10px] text-muted-foreground">
                    {formatValue(value)}
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