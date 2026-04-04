'use client';

import { ChevronRight, Mic, Sparkles } from 'lucide-react';

export default function CounsellingSidebarCard({ progress, onResumeCall }) {
  const missingLabels = progress?.missingLabels || [];
  const filledCount = progress?.filledCount || 0;
  const totalCount = progress?.totalCount || 13;

  return (
    <aside className="rounded-[28px] border border-border/50 bg-linear-to-br from-card via-card to-emerald-500/6 p-6 shadow-[0_24px_80px_rgba(16,185,129,0.08)] backdrop-blur-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
        <Sparkles className="h-4 w-4" />
        Counselling Progress
      </div>

      <div className="mt-4 rounded-3xl border border-border/40 bg-background/70 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Completion
        </p>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="ivy-font text-4xl font-bold text-foreground">{filledCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">of {totalCount} fields recorded</p>
          </div>
          <div className="min-w-24 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Resume</p>
            <p className="mt-1 text-sm font-medium text-foreground">Still needed</p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted/50">
          <div
            className="h-full rounded-full bg-linear-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-700"
            style={{ width: `${Math.max(8, Math.round((filledCount / totalCount) * 100))}%` }}
          />
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="ivy-font text-lg font-bold text-foreground">Missing Fields</h3>
          <span className="rounded-full border border-border/50 bg-background/70 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {missingLabels.length} left
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {missingLabels.map((label) => (
            <div
              key={label}
              className="rounded-2xl border border-border/40 bg-background/65 px-3 py-2.5 text-sm text-foreground"
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onResumeCall}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.01] hover:from-emerald-600 hover:to-teal-600 cursor-pointer"
      >
        <Mic className="h-4 w-4" />
        Resume Counselling Call
        <ChevronRight className="h-4 w-4" />
      </button>
    </aside>
  );
}