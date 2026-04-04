"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import {
  CheckCircle2, Lock, MapPin, FileText, Building2,
  PenLine, Send, Stamp, Plane, ChevronRight, X,
} from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────
export const JOURNEY_STEPS = [
  {
    id: 1,
    title: "Profile Completion",
    subtitle: "Foundation",
    icon: MapPin,
    color: "#10b981",
    glow: "rgba(16,185,129,0.55)",
    description: "Build the foundation of your study abroad profile with academic records, background info and target details.",
    actions: ["Fill in personal details", "Add academic history", "Set target country & course"],
    cta: "Complete Profile",
  },
  {
    id: 2,
    title: "IELTS / TOEFL Prep",
    subtitle: "Language Test",
    icon: PenLine,
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.55)",
    description: "Language proficiency is the primary eligibility gate for most universities. Target Band 7.0 or TOEFL 100+.",
    actions: ["Enroll in a prep course", "Take practice tests", "Schedule your test date"],
    cta: "Start IELTS Prep",
  },
  {
    id: 3,
    title: "University Shortlisting",
    subtitle: "Research",
    icon: Building2,
    color: "#818cf8",
    glow: "rgba(129,140,248,0.55)",
    description: "Identify universities that align with your academic profile, budget and career goals. Aim for 8–12 options.",
    actions: ["Filter by ranking, fee & location", "Assess admission requirements", "Finalise your shortlist"],
    cta: "Explore Universities",
  },
  {
    id: 4,
    title: "SOP & LOR",
    subtitle: "Documents",
    icon: FileText,
    color: "#06b6d4",
    glow: "rgba(6,182,212,0.55)",
    description: "Your Statement of Purpose and Letters of Recommendation are often the deciding factor in competitive applications.",
    actions: ["Draft your SOP narrative", "Request LORs from referees", "Proofread & refine"],
    cta: "Begin Writing",
  },
  {
    id: 5,
    title: "Application Submission",
    subtitle: "Apply",
    icon: Send,
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.55)",
    description: "Submit your applications before deadlines. Track each portal and ensure all supporting documents are attached.",
    actions: ["Complete online applications", "Pay application fees", "Upload all documents"],
    cta: "Start Applying",
  },
  {
    id: 6,
    title: "Visa Process",
    subtitle: "Legal",
    icon: Stamp,
    color: "#34d399",
    glow: "rgba(52,211,153,0.55)",
    description: "After receiving your offer letter, begin the student visa application. Keep finances and documents ready.",
    actions: ["Gather financial proof", "Book visa appointment", "Submit visa application"],
    cta: "Visa Checklist",
  },
  {
    id: 7,
    title: "Departure Ready",
    subtitle: "Final Step",
    icon: Plane,
    color: "#fbbf24",
    glow: "rgba(251,191,36,0.55)",
    description: "You've made it! Complete final checks — accommodation, travel insurance, forex, and pre-departure orientation.",
    actions: ["Book flights & accommodation", "Arrange travel insurance", "Complete pre-departure checklist"],
    cta: "View Pre-Departure Guide",
  },
];

// ─── Status helpers ────────────────────────────────────────────────────────────
function deriveStatuses(readinessScore, data) {
  // first step always complete (they filled the form), derive the rest from data
  const testDone       = data?.testStatus === "Taken";
  const testPreparing  = data?.testStatus === "Preparing";
  const hasShortlist   = (data?.targetCountry?.length || 0) >= 1;
  const hasSOP         = data?.sopStatus === "Done";
  const submitted      = data?.applicationStatus === "Submitted";
  const visaDone       = data?.visaStatus === "Done";

  if (readinessScore >= 90)
    return ["completed","completed","completed","completed","completed","completed","current"];
  if (readinessScore >= 75)
    return ["completed","completed","completed","completed","current","locked","locked"];

  if (testDone)
    return ["completed","completed", hasShortlist ? "current" : "current","locked","locked","locked","locked"];
  if (testPreparing)
    return ["completed","current","locked","locked","locked","locked","locked"];
  return       ["completed","current","locked","locked","locked","locked","locked"];
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ProgressHeader({ statuses, total, isDark }) {
  const completed = statuses.filter((s) => s === "completed").length;
  const pct = Math.round((completed / total) * 100);
  const cardBg   = isDark ? "linear-gradient(135deg,rgba(15,10,40,0.80) 0%,rgba(8,8,28,0.88) 100%)" : "linear-gradient(135deg,rgba(238,242,255,0.90) 0%,rgba(248,250,252,0.95) 100%)";
  const cardBdr  = isDark ? "rgba(255,255,255,0.08)" : "rgba(99,102,241,0.14)";
  const labelClr = isDark ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.40)";
  const titleClr = isDark ? "#ffffff" : "#0f172a";
  const pctBg    = isDark ? "rgba(167,139,250,0.14)" : "rgba(109,40,217,0.10)";
  const pctBdr   = isDark ? "rgba(167,139,250,0.25)" : "rgba(109,40,217,0.20)";
  const pctClr   = isDark ? "#c4b5fd" : "#6d28d9";
  const doneClr  = isDark ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.40)";
  const trackBg  = isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.08)";
  const milesClr = isDark ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.40)";

  return (
    <div
      className="mb-10 overflow-hidden rounded-2xl p-6"
      style={{ background: cardBg, border: `1px solid ${cardBdr}` }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: labelClr }}>Study Abroad Journey</p>
          <h3 className="mt-1 text-2xl font-black" style={{ color: titleClr }}>
            {completed === 0 ? "Just Getting Started 🚀" :
             completed === total ? "Journey Complete! 🎓" :
             `${completed} of ${total} milestones reached`}
          </h3>
        </div>
        <div className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl"
          style={{ background: pctBg, border: `1px solid ${pctBdr}` }}>
          <span className="text-2xl font-black" style={{ color: pctClr }}>{pct}%</span>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: doneClr }}>Done</span>
        </div>
      </div>

      {/* Track */}
      <div className="relative h-3 overflow-hidden rounded-full" style={{ background: trackBg }}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #10b981, #818cf8, #a78bfa)",
            boxShadow: "0 0 12px rgba(167,139,250,0.50)",
          }}
        />
      </div>

      <div className="mt-3 flex justify-between text-[11px]" style={{ color: milesClr }}>
        <span>Start</span>
        <span>{completed} / {total} Milestones</span>
        <span>Departure</span>
      </div>
    </div>
  );
}

function NodeDetailModal({ step, onClose, isDark }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!modalRef.current) return;
    modalRef.current.style.opacity = "0";
    modalRef.current.style.transform = "scale(0.92) translateY(12px)";
    requestAnimationFrame(() => {
      if (modalRef.current) {
        modalRef.current.style.transition = "opacity 0.28s ease, transform 0.28s ease";
        modalRef.current.style.opacity = "1";
        modalRef.current.style.transform = "scale(1) translateY(0)";
      }
    });
  }, []);

  const close = useCallback(() => {
    if (!modalRef.current) return onClose();
    modalRef.current.style.transition = "opacity 0.18s ease, transform 0.18s ease";
    modalRef.current.style.opacity = "0";
    modalRef.current.style.transform = "scale(0.94) translateY(8px)";
    setTimeout(onClose, 180);
  }, [onClose]);

  const Icon = step.icon;

  return (
    <div
      className="fixed inset-0 z-10001 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md overflow-hidden rounded-3xl"
        style={{
          background: isDark
            ? "linear-gradient(160deg,rgba(12,8,32,0.98) 0%,rgba(8,8,22,0.98) 100%)"
            : "linear-gradient(160deg,rgba(255,255,255,0.98) 0%,rgba(248,250,252,0.98) 100%)",
          border: `1px solid ${step.color}44`,
          boxShadow: `0 0 60px ${step.glow}, 0 24px 64px rgba(0,0,0,0.30)`,
        }}
      >
        {/* Glow orb */}
        <div style={{ position: "absolute", right: "-60px", top: "-60px", width: "220px", height: "220px", borderRadius: "50%", background: `radial-gradient(circle, ${step.glow} 0%, transparent 70%)`, opacity: 0.4 }} />

        <div className="relative p-7">
          {/* Header */}
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: `${step.color}22`, boxShadow: `0 0 20px ${step.glow}` }}>
              <Icon style={{ color: step.color }} className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.40)" }}>{step.subtitle}</p>
              <h3 className="mt-0.5 text-xl font-black" style={{ color: isDark ? "#ffffff" : "#0f172a" }}>{step.title}</h3>
            </div>
            <button
              onClick={close}
              className="flex h-8 w-8 items-center justify-center rounded-full transition"
              style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)", color: isDark ? "rgba(255,255,255,0.35)" : "rgba(15,23,42,0.40)" }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Description */}
          <p className="mb-5 text-sm leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.50)" : "rgba(15,23,42,0.60)" }}>{step.description}</p>

          {/* Actions */}
          <div className="mb-6 space-y-2.5">
            {step.actions.map((action, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)", border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.07)"}` }}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                  style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)", color: isDark ? "rgba(255,255,255,0.40)" : "rgba(15,23,42,0.45)" }}>
                  {i + 1}
                </span>
                <span className="text-sm" style={{ color: isDark ? "rgba(255,255,255,0.60)" : "rgba(15,23,42,0.65)" }}>{action}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            className="w-full rounded-2xl px-6 py-3.5 text-sm font-black text-white transition-all hover:brightness-110 hover:scale-[1.02]"
            style={{
              background: `linear-gradient(135deg, ${step.color}cc, ${step.color}88)`,
              boxShadow: `0 0 24px ${step.glow}`,
            }}
          >
            {step.cta}
            <ChevronRight className="ml-1.5 inline h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AvatarMarker({ avatar, step, avatarAccent }) {
  const ref = useRef(null);

  // gentle floating bob
  useEffect(() => {
    if (!ref.current) return;
    let raf;
    let start = null;
    const animate = (ts) => {
      if (!start) start = ts;
      const t = (ts - start) / 1000;
      const y = Math.sin(t * 1.8) * 5;
      if (ref.current) ref.current.style.transform = `translateY(${y}px)`;
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={ref}
      className="absolute -top-16 left-1/2 z-10"
      style={{ transform: "translateX(-50%)" }}
    >
      {/* Pulse rings */}
      <span className="absolute inset-0 flex h-full w-full items-center justify-center">
        <span className="absolute h-16 w-16 animate-ping rounded-full opacity-30"
          style={{ background: step.color, animationDuration: "1.8s" }} />
        <span className="absolute h-12 w-12 animate-ping rounded-full opacity-20"
          style={{ background: step.color, animationDuration: "1.2s", animationDelay: "0.3s" }} />
      </span>
      {avatar ? (
        <div
          className={`relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br ${avatarAccent}`}
          style={{ boxShadow: `0 0 24px ${step.glow}, 0 6px 20px rgba(0,0,0,0.50)`, border: "2px solid rgba(255,255,255,0.18)" }}
        >
          <Image src={avatar.src} alt={avatar.name} width={56} height={56} className="h-full w-full object-contain" />
        </div>
      ) : (
        <div
          className="relative flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${step.color}, ${step.color}88)`,
            boxShadow: `0 0 24px ${step.glow}`,
            border: "2px solid rgba(255,255,255,0.18)",
          }}
        >
          <MapPin className="h-6 w-6 text-white" />
        </div>
      )}
    </div>
  );
}

function JourneyNode({ step, status, isLast, isRight, avatar, avatarAccent, index, isDark }) {
  const nodeRef    = useRef(null);
  const [visible,  setVisible]  = useState(false);
  const [open,     setOpen]     = useState(false);

  // Intersection Observer fade-in
  useEffect(() => {
    if (!nodeRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.2 },
    );
    obs.observe(nodeRef.current);
    return () => obs.disconnect();
  }, []);

  const isCompleted = status === "completed";
  const isCurrent   = status === "current";
  const isLocked    = status === "locked";

  const Icon = step.icon;

  const nodeColor = isCompleted ? step.color :
                    isCurrent   ? step.color :
                    isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.15)";

  const nodeBg = isCompleted
    ? `linear-gradient(135deg, ${step.color}33, ${step.color}1a)`
    : isCurrent
    ? `linear-gradient(135deg, ${step.color}28, ${step.color}14)`
    : isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)";

  const nodeBorder = isCompleted
    ? `2px solid ${step.color}88`
    : isCurrent
    ? `2px solid ${step.color}66`
    : isDark ? "2px solid rgba(255,255,255,0.08)" : "2px solid rgba(15,23,42,0.10)";

  const delay = `${index * 80}ms`;

  return (
    <>
      {open && <NodeDetailModal step={step} onClose={() => setOpen(false)} isDark={isDark} />}

      {/* Row wrapper: alternates sides on desktop */}
      <div
        ref={nodeRef}
        className={`relative flex items-center gap-0 transition-all duration-700 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        } ${isRight ? "lg:flex-row-reverse" : "lg:flex-row"} flex-row`}
        style={{ transitionDelay: delay }}
      >
        {/* ── Left / Right content card (hidden on mobile, shown on desktop) ── */}
        <div className={`hidden flex-1 lg:flex ${isRight ? "lg:justify-start lg:pl-10" : "lg:justify-end lg:pr-10"}`}>
          {!isLocked && (
            <button
              onClick={() => setOpen(true)}
              className="group max-w-xs overflow-hidden rounded-2xl p-5 text-left transition-all duration-300 hover:scale-[1.03] hover:brightness-110"
              style={{
                background: nodeBg,
                border: nodeBorder,
                boxShadow: isCurrent ? `0 0 28px ${step.glow}` : "none",
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.40)" }}>{step.subtitle}</p>
              <p className="mt-1 text-base font-black" style={{ color: isLocked ? (isDark ? "rgba(255,255,255,0.20)" : "rgba(15,23,42,0.25)") : (isDark ? "#ffffff" : "#0f172a") }}>{step.title}</p>
              {!isLocked && (
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(15,23,42,0.50)" }}>{step.description}</p>
              )}
              {isCurrent && (
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold"
                  style={{ color: step.color }}>
                  In Progress <ChevronRight className="h-3 w-3" />
                </span>
              )}
              {isCompleted && (
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold" style={{ color: isDark ? "#34d399" : "#059669" }}>
                  Completed <CheckCircle2 className="h-3 w-3" />
                </span>
              )}
            </button>
          )}
          {isLocked && (
            <div className="max-w-xs rounded-2xl p-5" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "rgba(15,23,42,0.02)", border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.06)"}` }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.20)" }}>{step.subtitle}</p>
              <p className="mt-1 text-base font-black" style={{ color: isDark ? "rgba(255,255,255,0.15)" : "rgba(15,23,42,0.20)" }}>{step.title}</p>
            </div>
          )}
        </div>

        {/* ── Centre column: connector line + node ── */}
        <div className="flex flex-col items-center" style={{ minWidth: 80 }}>
          {/* Top connector */}
          {index > 0 && (
            <div
              className="w-0.5 transition-all duration-1000"
              style={{
                height: 40,
                background: isCompleted
                  ? `linear-gradient(to bottom, ${step.color}88, ${step.color}44)`
                  : isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.10)",
              }}
            />
          )}

          {/* Node circle */}
          <div className="relative flex items-center justify-center" style={{ padding: isCurrent ? 0 : 0 }}>
            {isCurrent && (
              <span className="absolute h-20 w-20 animate-ping rounded-full opacity-20"
                style={{ background: step.color, animationDuration: "2s" }} />
            )}

            {/* Avatar floats above current node */}
            {isCurrent && avatar && (
              <AvatarMarker avatar={avatar} step={step} avatarAccent={avatarAccent} />
            )}

            <button
              disabled={isLocked}
              onClick={isLocked ? undefined : () => setOpen(true)}
              className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 ${
                isCurrent ? "scale-110" : ""
              } ${isLocked ? "cursor-default" : "cursor-pointer hover:scale-110 hover:brightness-110"}`}
              style={{
                background: nodeBg,
                border: nodeBorder,
                boxShadow: isCurrent
                  ? `0 0 0 4px ${step.color}22, 0 0 36px ${step.glow}`
                  : isCompleted
                  ? `0 0 16px ${step.glow.replace("0.55","0.28")}`
                  : "none",
              }}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-7 w-7" style={{ color: step.color }} />
              ) : isLocked ? (
                <Lock className="h-6 w-6 text-white/15" />
              ) : (
                <Icon className="h-7 w-7" style={{ color: step.color }} />
              )}
            </button>

            {/* Step number badge */}
            <span
              className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black"
              style={{
                background: isCompleted || isCurrent ? step.color : (isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)"),
                color: isLocked ? (isDark ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.30)") : "#fff",
              }}
            >
              {step.id}
            </span>
          </div>

          {/* Bottom connector */}
          {!isLast && (
            <div
              className="w-0.5"
              style={{
                height: 40,
                background: isCompleted
                  ? `linear-gradient(to bottom, ${step.color}44, ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"})`
                  : isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.10)",
              }}
            />
          )}
        </div>

        {/* ── Mobile card (always shown below node on small screens, hidden on lg) ── */}
        <div className="flex flex-1 lg:hidden">
          {!isLocked ? (
            <button
              onClick={() => setOpen(true)}
              className="ml-4 flex-1 overflow-hidden rounded-2xl p-4 text-left transition-all hover:brightness-110"
              style={{
                background: nodeBg,
                border: nodeBorder,
                boxShadow: isCurrent ? `0 0 20px ${step.glow}` : "none",
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.40)" }}>{step.subtitle}</p>
              <p className="mt-0.5 text-sm font-black" style={{ color: isDark ? "#ffffff" : "#0f172a" }}>{step.title}</p>
              {isCurrent && (
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold"
                  style={{ color: step.color }}>
                  In Progress <ChevronRight className="h-3 w-3" />
                </span>
              )}
            </button>
          ) : (
            <div className="ml-4 flex-1 rounded-2xl p-4"
              style={{ background: isDark ? "rgba(255,255,255,0.02)" : "rgba(15,23,42,0.02)", border: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.06)"}` }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.20)" }}>{step.subtitle}</p>
              <p className="mt-0.5 text-sm font-black" style={{ color: isDark ? "rgba(255,255,255,0.15)" : "rgba(15,23,42,0.20)" }}>{step.title}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main exported component ───────────────────────────────────────────────────
export default function JourneyPath({ avatar, avatarAccent, readinessScore, data }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const statuses = deriveStatuses(readinessScore ?? 65, data);
  const wrapBg  = isDark ? "linear-gradient(160deg,rgba(10,6,30,0.82) 0%,rgba(6,6,20,0.90) 100%)" : "linear-gradient(160deg,rgba(238,242,255,0.90) 0%,rgba(248,250,252,0.95) 100%)";
  const wrapBdr = isDark ? "rgba(255,255,255,0.07)" : "rgba(99,102,241,0.14)";
  const labelClr = isDark ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.40)";
  const titleClr = isDark ? "#ffffff" : "#0f172a";
  const badgeBg  = isDark ? "rgba(139,92,246,0.14)" : "rgba(109,40,217,0.10)";
  const badgeBdr = isDark ? "rgba(139,92,246,0.24)" : "rgba(109,40,217,0.20)";
  const badgeTxt = isDark ? "#c4b5fd" : "#6d28d9";

  return (
    <div
      className="rounded-2xl p-6 sm:p-8 lg:p-10"
      style={{ background: wrapBg, border: `1px solid ${wrapBdr}` }}
    >
      {/* Section heading */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: labelClr }}>Your Path</p>
          <h2 className="mt-1 text-2xl font-black" style={{ color: titleClr }}>Study Abroad Journey</h2>
        </div>
        <span
          className="rounded-full px-3.5 py-1.5 text-xs font-bold"
          style={{ background: badgeBg, border: `1px solid ${badgeBdr}`, color: badgeTxt }}
        >
          {statuses.filter((s) => s === "completed").length} / {JOURNEY_STEPS.length} Done
        </span>
      </div>

      <ProgressHeader statuses={statuses} total={JOURNEY_STEPS.length} isDark={isDark} />

      {/* Path nodes */}
      <div className="relative mx-auto max-w-3xl">
        {JOURNEY_STEPS.map((step, i) => (
          <JourneyNode
            key={step.id}
            step={step}
            status={statuses[i]}
            isLast={i === JOURNEY_STEPS.length - 1}
            isRight={i % 2 === 1}
            avatar={statuses[i] === "current" ? avatar : null}
            avatarAccent={avatarAccent}
            index={i}
            isDark={isDark}
          />
        ))}
      </div>
    </div>
  );
}
