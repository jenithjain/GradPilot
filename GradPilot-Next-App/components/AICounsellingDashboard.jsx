"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { gsap } from "gsap";
import { useTheme } from "next-themes";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  X, Brain, TrendingUp, Calendar, Mic,
  ChevronRight, Play, RotateCcw, Settings,
  GraduationCap, Star, BookOpen, Award, Activity,
} from "lucide-react";
import JourneyPath from "@/components/JourneyPath";

const PROGRESS_DATA = [
  { month: "Oct", score: 22 },
  { month: "Nov", score: 34 },
  { month: "Dec", score: 41 },
  { month: "Jan", score: 53 },
  { month: "Feb", score: 62 },
  { month: "Mar", score: 73 },
  { month: "Apr", score: 81 },
];

const SESSIONS = [
  { date: "Apr 8",  time: "3:00 PM", topic: "University Selection Strategy", color: "bg-cyan-500",   glow: "shadow-cyan-500/60",   status: "upcoming"  },
  { date: "Apr 15", time: "4:30 PM", topic: "SOP & LOR Guidance",            color: "bg-violet-500", glow: "shadow-violet-500/60", status: "scheduled" },
  { date: "Apr 22", time: "2:00 PM", topic: "Visa Application Workshop",      color: "bg-indigo-500", glow: "shadow-indigo-500/60", status: "scheduled" },
];

const AI_RESPONSES = [
  "Your profile shows strong potential for UK Tier 1 unis. IELTS Band 7 is your primary unlock -- it adds 12 more options instantly.",
  "Academic background is solid. Channel that into a compelling SOP -- focus on your career trajectory, not just grades.",
  "I have found 3 scholarships you have a high chance of qualifying for. Want me to walk you through each one?",
];

const AVATAR_ACCENTS = {
  hulk:      "from-lime-400 to-emerald-500",
  ironman:   "from-amber-400 to-orange-500",
  thor:      "from-sky-400 to-blue-500",
  spiderman: "from-blue-500 to-indigo-600",
};

// ── Theme palette ─────────────────────────────────────────────────────────────
function getTheme(isDark) {
  if (isDark) return {
    rootBg:           "#030711",
    gradBg:           "linear-gradient(135deg,#030711 0%,#070b1e 35%,#0e0924 65%,#040810 100%)",
    orb1:             "radial-gradient(circle,rgba(124,58,237,0.38) 0%,transparent 65%)",
    orb2:             "radial-gradient(circle,rgba(6,182,212,0.24) 0%,transparent 65%)",
    orb3:             "radial-gradient(circle,rgba(99,102,241,0.14) 0%,transparent 70%)",
    gridLine:         "rgba(255,255,255,0.6)",
    topbarBg:         "rgba(3,7,17,0.90)",
    topbarBorder:     "rgba(255,255,255,0.06)",
    textPrimary:      "#ffffff",
    textSecondary:    "rgba(255,255,255,0.55)",
    textMuted:        "rgba(255,255,255,0.30)",
    textLabel:        "rgba(255,255,255,0.25)",
    textFaint:        "rgba(255,255,255,0.55)",
    divider:          "rgba(255,255,255,0.07)",
    profileBg:        "linear-gradient(135deg,rgba(15,18,52,0.96) 0%,rgba(22,12,50,0.92) 50%,rgba(12,16,44,0.96) 100%)",
    profileBorder:    "rgba(139,92,246,0.22)",
    profileOrb1:      "radial-gradient(circle,rgba(139,92,246,0.28) 0%,transparent 70%)",
    profileOrb2:      "radial-gradient(circle,rgba(99,102,241,0.18) 0%,transparent 70%)",
    profileOverlay:   "0.08",
    tagBg:            "rgba(139,92,246,0.18)",
    tagBorder:        "rgba(139,92,246,0.28)",
    tagText:          "#c4b5fd",
    ringTrack:        "rgba(255,255,255,0.07)",
    metricVal:        ["#fbbf24","#34d399","#22d3ee","#a78bfa"],
    aiInsightBg:      "linear-gradient(135deg,rgba(88,28,135,0.32) 0%,rgba(67,20,120,0.26) 50%,rgba(30,27,75,0.32) 100%)",
    aiInsightBorder:  "rgba(139,92,246,0.28)",
    aiOrb1:           "radial-gradient(circle,rgba(139,92,246,0.38) 0%,transparent 70%)",
    aiOrb2:           "radial-gradient(circle,rgba(99,102,241,0.28) 0%,transparent 70%)",
    aiIconBg:         "rgba(139,92,246,0.25)",
    aiIconText:       "text-violet-300",
    aiLabel:          "text-violet-200",
    aiBadgeBg:        "rgba(139,92,246,0.22)",
    aiBadgeBorder:    "rgba(139,92,246,0.35)",
    aiBadgeText:      "text-violet-300",
    aiHeadGrad1:      "linear-gradient(90deg,#c4b5fd,#818cf8)",
    aiHeadGrad2:      "linear-gradient(90deg,#fca5a5,#f472b6)",
    aiHeadGrad3:      "linear-gradient(90deg,#fcd34d,#fb923c)",
    statBg:           "rgba(255,255,255,0.07)",
    statBorder:       "rgba(255,255,255,0.09)",
    statNums:         ["#818cf8","#34d399","#fb923c"],
    statLabel:        "rgba(255,255,255,0.30)",
    aiStarBg:         "rgba(139,92,246,0.16)",
    aiStarBorder:     "rgba(139,92,246,0.22)",
    aiStarText:       "text-violet-300",
    wellBg:           "linear-gradient(135deg,rgba(5,78,59,0.30) 0%,rgba(6,46,36,0.24) 50%,rgba(7,28,58,0.30) 100%)",
    wellBorder:       "rgba(16,185,129,0.24)",
    wellIconBg:       "rgba(16,185,129,0.22)",
    wellIconText:     "text-emerald-400",
    wellNoteText:     "text-white/70",
    wellNoteLabelTxt: "rgba(255,255,255,0.30)",
    wellNoteBg:       "rgba(16,185,129,0.10)",
    wellNoteBorder:   "rgba(16,185,129,0.14)",
    wellNoteBody:     "rgba(255,255,255,0.55)",
    radialTrack:      "rgba(255,255,255,0.07)",
    radialNum:        "#ffffff",
    radialLabel:      "rgba(255,255,255,0.40)",
    recBg1:           "linear-gradient(135deg,rgba(30,58,138,0.32) 0%,rgba(49,46,129,0.28) 100%)",
    recBorder1:       "rgba(59,130,246,0.28)",
    recBg2u:          "linear-gradient(135deg,rgba(136,19,55,0.30) 0%,rgba(159,18,57,0.24) 100%)",
    recBorder2u:      "rgba(244,63,94,0.28)",
    recBg2ok:         "linear-gradient(135deg,rgba(5,78,59,0.30) 0%,rgba(6,55,40,0.24) 100%)",
    recBorder2ok:     "rgba(16,185,129,0.28)",
    recBg3:           "linear-gradient(135deg,rgba(120,53,15,0.30) 0%,rgba(146,64,14,0.24) 100%)",
    recBorder3:       "rgba(245,158,11,0.28)",
    recIconCls1:      "text-blue-300",
    recIconCls2u:     "text-rose-300",
    recIconCls2ok:    "text-emerald-300",
    recIconCls3:      "text-amber-300",
    recTag1:          "bg-blue-500/20 text-blue-300",
    recTag2u:         "bg-rose-500/20 text-rose-300",
    recTag2ok:        "bg-emerald-500/20 text-emerald-300",
    recTag3:          "bg-amber-500/20 text-amber-300",
    recTitle:         "#ffffff",
    recDesc:          "rgba(255,255,255,0.45)",
    recCta:           "rgba(255,255,255,0.50)",
    recCtaHover:      "rgba(255,255,255,1)",
    recNewBg:         "rgba(16,185,129,0.14)",
    recNewBorder:     "rgba(16,185,129,0.24)",
    recNewText:       "text-emerald-400",
    voiceBg:          "linear-gradient(180deg,rgba(6,182,212,0.12) 0%,rgba(15,23,42,0.72) 100%)",
    voiceBorder:      "rgba(6,182,212,0.18)",
    voiceIconText:    "text-cyan-400",
    voiceLabel:       "rgba(255,255,255,0.60)",
    micIdleBg:        "rgba(255,255,255,0.08)",
    micIdleIcon:      "rgba(255,255,255,0.45)",
    micBubbleBg:      "rgba(255,255,255,0.04)",
    micBubbleBorder:  "rgba(255,255,255,0.07)",
    micEmptyText:     "rgba(255,255,255,0.20)",
    micRespText:      "rgba(255,255,255,0.65)",
    waveformIdle:     "rgba(255,255,255,0.18)",
    followBg:         "linear-gradient(180deg,rgba(99,102,241,0.14) 0%,rgba(15,23,42,0.72) 100%)",
    followBorder:     "rgba(99,102,241,0.20)",
    followIconText:   "text-indigo-400",
    followLabel:      "rgba(255,255,255,0.60)",
    followBtnBg:      "rgba(99,102,241,0.20)",
    followBtnBorder:  "rgba(99,102,241,0.30)",
    followBtnText:    "text-indigo-300",
    sessBg:           "rgba(255,255,255,0.04)",
    sessBorder:       "rgba(255,255,255,0.06)",
    sessHover:        "rgba(255,255,255,0.07)",
    sessLine:         "rgba(255,255,255,0.08)",
    sessTopic:        "#ffffff",
    sessMeta:         "rgba(255,255,255,0.35)",
    sessSchBg:        "rgba(255,255,255,0.08)",
    sessSchText:      "rgba(255,255,255,0.35)",
    chartBg:          "linear-gradient(180deg,rgba(20,10,50,0.65) 0%,rgba(7,10,25,0.82) 100%)",
    chartBorder:      "rgba(129,140,248,0.20)",
    chartGrid:        "rgba(255,255,255,0.05)",
    chartTick:        "rgba(255,255,255,0.30)",
    chartTipBg:       "#0a0820",
    chartTipBorder:   "rgba(139,92,246,0.40)",
    chartTipText:     "#fff",
    chartCursorStroke:"rgba(167,139,250,0.30)",
    chartStroke:      "#a78bfa",
    chartDot:         "#a78bfa",
    chartActiveDot:   "#c4b5fd",
    chartGradStop1:   "#a78bfa",
    chartGradStop2:   "#818cf8",
    chartGradOp1:     "0.55",
    trendBg:          "rgba(16,185,129,0.13)",
    trendBorder:      "rgba(16,185,129,0.24)",
    trendIcon:        "text-emerald-400",
    trendText:        "text-emerald-400",
    actionBg:         "linear-gradient(180deg,rgba(15,10,35,0.68) 0%,rgba(7,10,22,0.82) 100%)",
    actionBorder:     "rgba(255,255,255,0.07)",
    actionTitle:      "#ffffff",
    actIconBg:        "rgba(255,255,255,0.09)",
    act1Bg:           "linear-gradient(135deg,rgba(37,99,235,0.24) 0%,rgba(67,56,202,0.24) 100%)",
    act1Border:       "rgba(59,130,246,0.30)",
    act1Text:         "text-blue-300",
    act2Bg:           "linear-gradient(135deg,rgba(124,58,237,0.24) 0%,rgba(109,40,217,0.24) 100%)",
    act2Border:       "rgba(139,92,246,0.30)",
    act2Text:         "text-violet-300",
    act3Bg:           "linear-gradient(135deg,rgba(51,65,85,0.30) 0%,rgba(30,41,59,0.30) 100%)",
    act3Border:       "rgba(100,116,139,0.28)",
    act3Text:         "text-slate-300",
    actDesc:          "rgba(255,255,255,0.35)",
    closeBg:          "rgba(255,255,255,0.06)",
    closeIcon:        "rgba(255,255,255,0.35)",
    aiGlowHi:         "0 0 0 1px rgba(139,92,246,0.60),0 0 50px rgba(139,92,246,0.28),0 0 90px rgba(139,92,246,0.10)",
    aiGlowLo:         "0 0 0 1px rgba(109,40,217,0.30),0 0 20px rgba(109,40,217,0.12),0 0 40px rgba(109,40,217,0.05)",
  };

  // LIGHT
  return {
    rootBg:           "#f8fafc",
    gradBg:           "linear-gradient(135deg,#f0f4ff 0%,#ede9fe 35%,#faf5ff 65%,#f8faff 100%)",
    orb1:             "radial-gradient(circle,rgba(124,58,237,0.10) 0%,transparent 65%)",
    orb2:             "radial-gradient(circle,rgba(6,182,212,0.08) 0%,transparent 65%)",
    orb3:             "radial-gradient(circle,rgba(99,102,241,0.07) 0%,transparent 70%)",
    gridLine:         "rgba(99,102,241,0.25)",
    topbarBg:         "rgba(248,250,252,0.92)",
    topbarBorder:     "rgba(0,0,0,0.08)",
    textPrimary:      "#0f172a",
    textSecondary:    "rgba(15,23,42,0.60)",
    textMuted:        "rgba(15,23,42,0.45)",
    textLabel:        "rgba(15,23,42,0.40)",
    textFaint:        "rgba(15,23,42,0.60)",
    divider:          "rgba(0,0,0,0.08)",
    profileBg:        "linear-gradient(135deg,rgba(238,242,255,0.98) 0%,rgba(245,243,255,0.95) 50%,rgba(240,245,255,0.98) 100%)",
    profileBorder:    "rgba(109,40,217,0.18)",
    profileOrb1:      "radial-gradient(circle,rgba(139,92,246,0.12) 0%,transparent 70%)",
    profileOrb2:      "radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 70%)",
    profileOverlay:   "0.05",
    tagBg:            "rgba(109,40,217,0.10)",
    tagBorder:        "rgba(109,40,217,0.20)",
    tagText:          "#6d28d9",
    ringTrack:        "rgba(15,23,42,0.10)",
    metricVal:        ["#d97706","#059669","#0891b2","#7c3aed"],
    aiInsightBg:      "linear-gradient(135deg,rgba(237,233,254,0.92) 0%,rgba(243,232,255,0.88) 50%,rgba(238,242,255,0.92) 100%)",
    aiInsightBorder:  "rgba(109,40,217,0.20)",
    aiOrb1:           "radial-gradient(circle,rgba(139,92,246,0.16) 0%,transparent 70%)",
    aiOrb2:           "radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 70%)",
    aiIconBg:         "rgba(109,40,217,0.12)",
    aiIconText:       "text-violet-700",
    aiLabel:          "text-violet-700",
    aiBadgeBg:        "rgba(109,40,217,0.10)",
    aiBadgeBorder:    "rgba(109,40,217,0.22)",
    aiBadgeText:      "text-violet-700",
    aiHeadGrad1:      "linear-gradient(90deg,#7c3aed,#4f46e5)",
    aiHeadGrad2:      "linear-gradient(90deg,#dc2626,#db2777)",
    aiHeadGrad3:      "linear-gradient(90deg,#d97706,#ea580c)",
    statBg:           "rgba(99,102,241,0.07)",
    statBorder:       "rgba(99,102,241,0.14)",
    statNums:         ["#4f46e5","#059669","#ea580c"],
    statLabel:        "rgba(15,23,42,0.45)",
    aiStarBg:         "rgba(109,40,217,0.08)",
    aiStarBorder:     "rgba(109,40,217,0.18)",
    aiStarText:       "text-violet-700",
    wellBg:           "linear-gradient(135deg,rgba(209,250,229,0.80) 0%,rgba(187,247,208,0.70) 50%,rgba(220,252,231,0.80) 100%)",
    wellBorder:       "rgba(16,185,129,0.28)",
    wellIconBg:       "rgba(16,185,129,0.16)",
    wellIconText:     "text-emerald-600",
    wellNoteText:     "text-slate-700",
    wellNoteLabelTxt: "rgba(15,23,42,0.45)",
    wellNoteBg:       "rgba(16,185,129,0.08)",
    wellNoteBorder:   "rgba(16,185,129,0.20)",
    wellNoteBody:     "rgba(15,23,42,0.60)",
    radialTrack:      "rgba(15,23,42,0.08)",
    radialNum:        "#0f172a",
    radialLabel:      "rgba(15,23,42,0.45)",
    recBg1:           "linear-gradient(135deg,rgba(219,234,254,0.90) 0%,rgba(224,231,255,0.85) 100%)",
    recBorder1:       "rgba(59,130,246,0.28)",
    recBg2u:          "linear-gradient(135deg,rgba(255,228,230,0.90) 0%,rgba(254,226,226,0.85) 100%)",
    recBorder2u:      "rgba(244,63,94,0.26)",
    recBg2ok:         "linear-gradient(135deg,rgba(209,250,229,0.90) 0%,rgba(187,247,208,0.85) 100%)",
    recBorder2ok:     "rgba(16,185,129,0.26)",
    recBg3:           "linear-gradient(135deg,rgba(254,243,199,0.90) 0%,rgba(253,230,138,0.70) 100%)",
    recBorder3:       "rgba(245,158,11,0.28)",
    recIconCls1:      "text-blue-600",
    recIconCls2u:     "text-rose-600",
    recIconCls2ok:    "text-emerald-600",
    recIconCls3:      "text-amber-600",
    recTag1:          "bg-blue-500/20 text-blue-700",
    recTag2u:         "bg-rose-500/20 text-rose-700",
    recTag2ok:        "bg-emerald-500/20 text-emerald-700",
    recTag3:          "bg-amber-500/20 text-amber-700",
    recTitle:         "#0f172a",
    recDesc:          "rgba(15,23,42,0.55)",
    recCta:           "rgba(15,23,42,0.45)",
    recCtaHover:      "#0f172a",
    recNewBg:         "rgba(16,185,129,0.10)",
    recNewBorder:     "rgba(16,185,129,0.22)",
    recNewText:       "text-emerald-700",
    voiceBg:          "linear-gradient(180deg,rgba(207,250,254,0.80) 0%,rgba(248,250,252,0.90) 100%)",
    voiceBorder:      "rgba(6,182,212,0.26)",
    voiceIconText:    "text-cyan-600",
    voiceLabel:       "rgba(15,23,42,0.60)",
    micIdleBg:        "rgba(15,23,42,0.07)",
    micIdleIcon:      "rgba(15,23,42,0.45)",
    micBubbleBg:      "rgba(15,23,42,0.04)",
    micBubbleBorder:  "rgba(15,23,42,0.08)",
    micEmptyText:     "rgba(15,23,42,0.35)",
    micRespText:      "rgba(15,23,42,0.65)",
    waveformIdle:     "rgba(15,23,42,0.20)",
    followBg:         "linear-gradient(180deg,rgba(224,231,255,0.80) 0%,rgba(248,250,252,0.90) 100%)",
    followBorder:     "rgba(99,102,241,0.26)",
    followIconText:   "text-indigo-600",
    followLabel:      "rgba(15,23,42,0.60)",
    followBtnBg:      "rgba(99,102,241,0.12)",
    followBtnBorder:  "rgba(99,102,241,0.24)",
    followBtnText:    "text-indigo-700",
    sessBg:           "rgba(15,23,42,0.04)",
    sessBorder:       "rgba(15,23,42,0.08)",
    sessHover:        "rgba(15,23,42,0.07)",
    sessLine:         "rgba(15,23,42,0.08)",
    sessTopic:        "#0f172a",
    sessMeta:         "rgba(15,23,42,0.45)",
    sessSchBg:        "rgba(15,23,42,0.06)",
    sessSchText:      "rgba(15,23,42,0.40)",
    chartBg:          "linear-gradient(180deg,rgba(238,242,255,0.90) 0%,rgba(248,250,252,0.95) 100%)",
    chartBorder:      "rgba(99,102,241,0.18)",
    chartGrid:        "rgba(15,23,42,0.06)",
    chartTick:        "rgba(15,23,42,0.40)",
    chartTipBg:       "#ffffff",
    chartTipBorder:   "rgba(99,102,241,0.28)",
    chartTipText:     "#0f172a",
    chartCursorStroke:"rgba(124,58,237,0.25)",
    chartStroke:      "#7c3aed",
    chartDot:         "#7c3aed",
    chartActiveDot:   "#6d28d9",
    chartGradStop1:   "#7c3aed",
    chartGradStop2:   "#4f46e5",
    chartGradOp1:     "0.28",
    trendBg:          "rgba(16,185,129,0.10)",
    trendBorder:      "rgba(16,185,129,0.22)",
    trendIcon:        "text-emerald-600",
    trendText:        "text-emerald-700",
    actionBg:         "linear-gradient(180deg,rgba(238,242,255,0.88) 0%,rgba(248,250,252,0.94) 100%)",
    actionBorder:     "rgba(15,23,42,0.08)",
    actionTitle:      "#0f172a",
    actIconBg:        "rgba(99,102,241,0.10)",
    act1Bg:           "linear-gradient(135deg,rgba(219,234,254,0.80) 0%,rgba(224,231,255,0.75) 100%)",
    act1Border:       "rgba(59,130,246,0.28)",
    act1Text:         "text-blue-700",
    act2Bg:           "linear-gradient(135deg,rgba(237,233,254,0.80) 0%,rgba(243,232,255,0.75) 100%)",
    act2Border:       "rgba(139,92,246,0.26)",
    act2Text:         "text-violet-700",
    act3Bg:           "linear-gradient(135deg,rgba(241,245,249,0.90) 0%,rgba(226,232,240,0.80) 100%)",
    act3Border:       "rgba(100,116,139,0.22)",
    act3Text:         "text-slate-600",
    actDesc:          "rgba(15,23,42,0.45)",
    closeBg:          "rgba(15,23,42,0.06)",
    closeIcon:        "rgba(15,23,42,0.40)",
    aiGlowHi:         "0 0 0 1px rgba(109,40,217,0.30),0 0 24px rgba(109,40,217,0.14),0 0 48px rgba(109,40,217,0.06)",
    aiGlowLo:         "0 0 0 1px rgba(109,40,217,0.10),0 0 10px rgba(109,40,217,0.06),0 0 20px rgba(109,40,217,0.02)",
  };
}

// Radial progress ring
function RadialScore({ value, label, color, delay = 0, T }) {
  const circleRef = useRef(null);
  const r = 36;
  const circ = 2 * Math.PI * r;
  const target = circ - (value / 100) * circ;

  useEffect(() => {
    if (!circleRef.current) return;
    gsap.fromTo(circleRef.current,
      { strokeDashoffset: circ },
      { strokeDashoffset: target, duration: 1.5, ease: "power3.out", delay },
    );
  }, [circ, target, delay]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24">
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={r} fill="none" stroke={T.radialTrack} strokeWidth="8" />
          <circle
            ref={circleRef}
            cx="44" cy="44" r={r} fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black" style={{ color: T.radialNum }}>{value}</span>
        </div>
      </div>
      <span className="text-xs font-medium" style={{ color: T.radialLabel }}>{label}</span>
    </div>
  );
}

// Animated waveform
function Waveform({ active, T }) {
  const barsRef = useRef([]);

  useEffect(() => {
    const bars = barsRef.current.filter(Boolean);
    if (!bars.length) return;
    const tweens = bars.map((bar, i) => {
      if (!active) return gsap.to(bar, { scaleY: 0.15, duration: 0.35, ease: "power2.out" });
      const dur = 0.25 + (i % 4) * 0.08;
      const peak = 0.7 + (i % 5) * 0.22;
      return gsap.to(bar, { scaleY: peak, duration: dur, ease: "sine.inOut", yoyo: true, repeat: -1, delay: i * 0.055 });
    });
    return () => tweens.forEach((t) => t?.kill());
  }, [active]);

  return (
    <div className="flex h-10 items-center justify-center gap-1">
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { barsRef.current[i] = el; }}
          style={{
            width: 3, height: "100%", borderRadius: 99, transformOrigin: "center",
            transform: "scaleY(0.15)",
            backgroundColor: active ? `hsl(${185 + i * 8},85%,65%)` : T.waveformIdle,
          }}
        />
      ))}
    </div>
  );
}

export default function AICounsellingDashboard({ onClose, avatar, data }) {
  const overlayRef  = useRef(null);
  const contentRef  = useRef(null);
  const aiCardRef   = useRef(null);
  const cardRefs    = useRef([]);
  const [mounted,     setMounted]     = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [aiThinking,  setAiThinking]  = useState(false);
  const [aiResponse,  setAiResponse]  = useState("");
  const [responseIdx, setResponseIdx] = useState(0);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const T = getTheme(isDark);

  const avatarAccent = avatar
    ? (AVATAR_ACCENTS[avatar.id] || AVATAR_ACCENTS[avatar.name?.toLowerCase()] || "from-violet-500 to-indigo-600")
    : "from-violet-500 to-indigo-600";

  // ── Derived from form data ────────────────────────────────────────────────
  const readinessScore = (() => {
    if (!data) return 65;
    let s = 0;
    if (data.educationLevel) s += 20;
    if (data.gpa)            s += 15;
    if (data.testStatus === "Taken")         s += 25;
    else if (data.testStatus === "Preparing") s += 12;
    if (data.budget)                s += 15;
    if (data.targetCountry?.length) s += 10;
    if (data.intakeYear)            s += 15;
    return Math.min(s, 100);
  })();

  const primaryCountry = data?.targetCountry?.[0] || "UK";
  const needsTest      = !data?.testStatus || data.testStatus === "Not Taken" || data.testStatus === "Preparing";
  const matchCount     = Math.min((data?.targetCountry?.length || 1) * 4, 20);
  const avgFit         = `${Math.min(readinessScore + 4, 95)}%`;
  const urgentCount    = [needsTest, !data?.gpa, !data?.intakeYear].filter(Boolean).length || 1;
  const displayName    = data?.fullName || "Student";
  const displayCourse  = data?.courseInterest || data?.fieldOfStudy || "Your Course";
  const intakeLabel    = data?.intakeMonth && data?.intakeYear ? `${data.intakeMonth} ${data.intakeYear}` : "Sep 2026";

  const profileTags = [
    `${primaryCountry} Target`,
    intakeLabel,
    data?.testStatus === "Taken" ? "Test Complete" : data?.testStatus === "Preparing" ? "Test Prep" : "Test Pending",
  ];

  const aiInsightBody = needsTest
    ? `Language test (IELTS/TOEFL) is your primary gap. Clearing Band 7 unlocks ${matchCount}+ additional options for ${displayCourse}.`
    : readinessScore >= 75
    ? `Profile aligned for ${displayCourse} in ${primaryCountry}. Focus on strengthening your SOP and securing strong reference letters.`
    : `Core profile is developing. Finalise your intake year and institution preferences to sharpen your shortlist.`;

  const topPickLabel = data?.testStatus === "Taken"
    ? `Strong shortlist candidate for ${primaryCountry} universities`
    : `IELTS clearance will unlock top universities in ${primaryCountry}`;

  const recommendations = [
    {
      id: 1, icon: GraduationCap, iconCls: T.recIconCls1, iconBg: "bg-blue-500/15",
      title: `Top University in ${primaryCountry}`,
      tag: `${Math.min(readinessScore + 7, 97)}% Match`, tagClass: T.recTag1,
      desc: `${displayCourse} -- ${intakeLabel} intake`,
      cta: "View Details",
      cardStyle: { background: T.recBg1, border: `1px solid ${T.recBorder1}` },
    },
    {
      id: 2, icon: BookOpen,
      iconCls: needsTest ? T.recIconCls2u : T.recIconCls2ok,
      iconBg:  needsTest ? "bg-rose-500/15" : "bg-emerald-500/15",
      title:   needsTest ? "Language Test Preparation" : "Application Documents",
      tag:     needsTest ? "Urgent" : "Next Step",
      tagClass: needsTest ? T.recTag2u : T.recTag2ok,
      desc: needsTest
        ? `Band 7.0 target -- required for ${primaryCountry} universities`
        : (data?.testScore ? `Score: ${data.testScore} -- SOP & LOR next` : "SOP & recommendation letters"),
      cta: needsTest ? "Start Prep" : "Begin Writing",
      cardStyle: needsTest
        ? { background: T.recBg2u,  border: `1px solid ${T.recBorder2u}` }
        : { background: T.recBg2ok, border: `1px solid ${T.recBorder2ok}` },
    },
    {
      id: 3, icon: Award, iconCls: T.recIconCls3, iconBg: "bg-amber-500/15",
      title: "Scholarship Opportunities",
      tag: data?.scholarshipInterest === "Yes" ? "Eligible" : "Explore",
      tagClass: T.recTag3,
      desc: data?.scholarshipInterest === "Yes"
        ? `Merit-based funding in ${primaryCountry} -- you qualify`
        : `Financial aid options for ${primaryCountry} study`,
      cta: "Apply Now",
      cardStyle: { background: T.recBg3, border: `1px solid ${T.recBorder3}` },
    },
  ];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (!contentRef.current) return;
    gsap.fromTo(contentRef.current, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power2.out" });
  }, [mounted]);

  useEffect(() => {
    const cards = cardRefs.current.filter(Boolean);
    if (!cards.length) return;
    gsap.fromTo(cards,
      { y: 36, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: "power3.out", delay: 0.35 },
    );
  }, [mounted]);

  useEffect(() => {
    if (!aiCardRef.current) return;
    const glowHi = getTheme(isDark).aiGlowHi;
    const glowLo = getTheme(isDark).aiGlowLo;
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(aiCardRef.current, { boxShadow: glowHi, duration: 2, ease: "power2.inOut" })
      .to(aiCardRef.current, { boxShadow: glowLo, duration: 2, ease: "power2.inOut" });
    return () => tl.kill();
  }, [mounted, isDark]);

  const handleMic = useCallback(() => {
    if (isListening) {
      setIsListening(false);
      setAiThinking(true);
      setAiResponse("");
      setTimeout(() => {
        setAiThinking(false);
        setAiResponse(AI_RESPONSES[responseIdx % AI_RESPONSES.length]);
        setResponseIdx((n) => n + 1);
      }, 1800);
    } else {
      setIsListening(true);
      setAiResponse("");
    }
  }, [isListening, responseIdx]);

  const handleClose = useCallback(() => {
    gsap.to(contentRef.current, { opacity: 0, duration: 0.3, ease: "power2.in", onComplete: onClose });
  }, [onClose]);

  const ref = (i) => (el) => { cardRefs.current[i] = el; };

  if (!mounted) return null;

  return createPortal(
    <div
      ref={overlayRef}
      style={{
        position: "fixed", inset: 0, zIndex: 9999, isolation: "isolate",
        display: "flex", flexDirection: "column",
        backgroundColor: T.rootBg,
      }}
    >
      {/* Layered background */}
      <div style={{ position: "absolute", inset: 0, background: T.gradBg }}>
        <div style={{ position: "absolute", left: "-160px", top: "-160px", width: "700px", height: "700px", borderRadius: "50%", background: T.orb1 }} />
        <div style={{ position: "absolute", right: "-160px", bottom: "-160px", width: "600px", height: "600px", borderRadius: "50%", background: T.orb2 }} />
        <div style={{ position: "absolute", left: "50%", top: "40%", transform: "translate(-50%,-50%)", width: "500px", height: "500px", borderRadius: "50%", background: T.orb3 }} />
        <div style={{ position: "absolute", inset: 0, opacity: 0.025, backgroundImage: `linear-gradient(${T.gridLine} 1px,transparent 1px),linear-gradient(90deg,${T.gridLine} 1px,transparent 1px)`, backgroundSize: "52px 52px" }} />
      </div>

      {/* Scrollable content pane */}
      <div ref={contentRef} className="no-scrollbar" style={{ position: "relative", flex: 1, overflowY: "auto", scrollBehavior: "smooth" }}>

        {/* Sticky topbar */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, borderBottom: `1px solid ${T.topbarBorder}`, background: T.topbarBg, backdropFilter: "blur(20px)" }}>
          <div className="flex items-center justify-between px-5 py-4 sm:px-8 lg:px-14">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: T.textFaint }}>
                GradPilot &middot; AI Counselling
              </span>
            </div>
            <div className="flex items-center gap-4">
              {avatar && (
                <div className="hidden items-center gap-2.5 sm:flex">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-linear-to-br ${avatarAccent} ring-1 ring-white/15`}>
                    <Image src={avatar.src} alt={avatar.name} width={28} height={28} className="h-full w-full object-contain" />
                  </div>
                  <span className="text-sm font-medium" style={{ color: T.textSecondary }}>{displayName}</span>
                </div>
              )}
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-all hover:opacity-100"
                style={{ background: T.closeBg, color: T.closeIcon }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="w-full space-y-6 px-5 py-8 sm:px-8 lg:px-14">

          {/* ── Profile hero ── */}
          <div ref={ref(0)} className="relative overflow-hidden rounded-2xl"
            style={{ background: T.profileBg, border: `1px solid ${T.profileBorder}` }}>
            <div className={`absolute inset-0 bg-linear-to-r ${avatarAccent} opacity-[${T.profileOverlay}]`} />
            <div style={{ position: "absolute", right: "-80px", top: "-80px", width: "300px", height: "300px", borderRadius: "50%", background: T.profileOrb1 }} />
            <div style={{ position: "absolute", left: "-60px", bottom: "-60px", width: "250px", height: "250px", borderRadius: "50%", background: T.profileOrb2 }} />

            <div className="relative p-7 lg:p-10">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-center">

                {/* Avatar + identity */}
                <div className="flex items-center gap-5">
                  {avatar ? (
                    <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br ${avatarAccent}`}
                      style={{ boxShadow: "0 0 32px rgba(139,92,246,0.30),0 8px 24px rgba(0,0,0,0.20)" }}>
                      <Image src={avatar.src} alt={avatar.name} width={76} height={76} className="h-full w-full object-contain drop-shadow-md" />
                    </div>
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 0 28px rgba(124,58,237,0.30)" }}>
                      <GraduationCap className="h-8 w-8 text-white" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: T.textLabel }}>Student Profile</p>
                    <h2 className="mt-1 text-2xl font-black lg:text-3xl" style={{ color: T.textPrimary }}>{displayName}</h2>
                    <p className="mt-1 text-sm" style={{ color: T.textSecondary }}>{displayCourse}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {profileTags.map((tag) => (
                        <span key={tag} className="rounded-full px-3 py-0.5 text-xs font-semibold"
                          style={{ background: T.tagBg, border: `1px solid ${T.tagBorder}`, color: T.tagText }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="hidden h-20 w-px shrink-0 lg:block" style={{ background: T.divider }} />

                {/* Key metrics */}
                <div className="flex flex-1 flex-wrap gap-x-10 gap-y-5">
                  {[
                    ["Status",    data?.applicationTimeline || "In Progress", T.metricVal[0]],
                    ["Readiness", `${readinessScore} / 100`,                   T.metricVal[1]],
                    ["Budget",    data?.budget || "--",                        T.metricVal[2]],
                    ["Intake",    intakeLabel,                                  T.metricVal[3]],
                  ].map(([k, v, c]) => (
                    <div key={k} className="flex flex-col">
                      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: T.textLabel }}>{k}</span>
                      <span className="mt-1 text-lg font-black leading-none" style={{ color: c }}>{v}</span>
                    </div>
                  ))}
                </div>

                <div className="hidden h-20 w-px shrink-0 lg:block" style={{ background: T.divider }} />

                {/* Readiness ring */}
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <div className="relative flex h-24 w-24 items-center justify-center">
                    <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 88 88">
                      <circle cx="44" cy="44" r="36" fill="none" stroke={T.ringTrack} strokeWidth="7" />
                      <circle cx="44" cy="44" r="36" fill="none"
                        stroke={readinessScore >= 75 ? "#10b981" : readinessScore >= 50 ? "#f59e0b" : "#ef4444"}
                        strokeWidth="7" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 36}`}
                        strokeDashoffset={`${2 * Math.PI * 36 * (1 - readinessScore / 100)}`}
                      />
                    </svg>
                    <div className="text-center">
                      <span className="text-2xl font-black" style={{ color: T.textPrimary }}>{readinessScore}</span>
                      <span className="block text-[10px]" style={{ color: T.textLabel }}>/100</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: T.textLabel }}>Readiness</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── AI Insight + Wellbeing ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

            {/* AI Insight (2/3) */}
            <div
              ref={(el) => { cardRefs.current[1] = el; aiCardRef.current = el; }}
              className="relative overflow-hidden rounded-2xl p-7 lg:col-span-2"
              style={{ background: T.aiInsightBg, border: `1px solid ${T.aiInsightBorder}` }}
            >
              <div style={{ position: "absolute", right: "-60px", top: "-60px", width: "250px", height: "250px", borderRadius: "50%", background: T.aiOrb1 }} />
              <div style={{ position: "absolute", left: "-60px", bottom: "-60px", width: "220px", height: "220px", borderRadius: "50%", background: T.aiOrb2 }} />
              <div className="relative">
                <div className="mb-5 flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.aiIconBg }}>
                    <Brain className={`h-5 w-5 ${T.aiIconText}`} />
                  </div>
                  <span className={`text-sm font-bold ${T.aiLabel}`}>AI Insight</span>
                  <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${T.aiBadgeText}`}
                    style={{ background: T.aiBadgeBg, border: `1px solid ${T.aiBadgeBorder}` }}>Live</span>
                </div>
                <h3 className="text-xl font-black leading-snug lg:text-2xl" style={{ color: T.textPrimary }}>
                  {readinessScore >= 75
                    ? (<>Your profile shows <span style={{ background: T.aiHeadGrad1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>strong potential</span> for {primaryCountry} universities.</>)
                    : needsTest
                    ? (<>Your core profile is solid. <span style={{ background: T.aiHeadGrad2, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Language test</span> is your primary gap.</>)
                    : (<>Your profile is <span style={{ background: T.aiHeadGrad3, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>on track</span>. Build your shortlist and application documents.</>)
                  }
                </h3>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: T.textSecondary }}>{aiInsightBody}</p>
                <div className="mt-6 grid grid-cols-3 gap-4">
                  {[
                    [`${matchCount}`, "Matches", T.statNums[0]],
                    [avgFit,          "Avg Fit",  T.statNums[1]],
                    [`${urgentCount}`,"Urgent",   T.statNums[2]],
                  ].map(([n, l, c]) => (
                    <div key={l} className="rounded-xl py-4 text-center"
                      style={{ background: T.statBg, border: `1px solid ${T.statBorder}` }}>
                      <p className="text-3xl font-black" style={{ color: c }}>{n}</p>
                      <p className="mt-0.5 text-xs" style={{ color: T.statLabel }}>{l}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-2 rounded-xl px-4 py-3"
                  style={{ background: T.aiStarBg, border: `1px solid ${T.aiStarBorder}` }}>
                  <Star className={`h-3.5 w-3.5 ${T.aiStarText}`} />
                  <span className={`text-xs ${T.aiStarText}`}>{topPickLabel}</span>
                </div>
              </div>
            </div>

            {/* Wellbeing (1/3) */}
            <div ref={ref(2)} className="rounded-2xl p-6"
              style={{ background: T.wellBg, border: `1px solid ${T.wellBorder}` }}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: T.wellIconBg }}>
                  <Activity className={`h-5 w-5 ${T.wellIconText}`} />
                </div>
                <div>
                  <p className={`text-sm font-bold ${T.wellNoteText}`}>Wellbeing Scores</p>
                  <p className="text-xs font-medium uppercase tracking-widest" style={{ color: T.wellNoteLabelTxt }}>AI-assessed today</p>
                </div>
              </div>
              <div className="flex items-center justify-around py-2">
                <RadialScore value={72} label="Focus"      color="#3b82f6" delay={0.55} T={T} />
                <RadialScore value={58} label="Confidence" color="#8b5cf6" delay={0.70} T={T} />
                <RadialScore value={44} label="Stress"     color="#10b981" delay={0.85} T={T} />
              </div>
              <div className="mt-5 rounded-xl px-4 py-3"
                style={{ background: T.wellNoteBg, border: `1px solid ${T.wellNoteBorder}` }}>
                <p className="text-xs" style={{ color: T.wellNoteLabelTxt }}>AI Assessment</p>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: T.wellNoteBody }}>
                  Focus is high -- ideal for tackling complex applications. Stress is manageable; maintain your momentum.
                </p>
              </div>
            </div>
          </div>

          {/* ── Recommendations ── */}
          <div ref={ref(3)}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black" style={{ color: T.textPrimary }}>Personalised Recommendations</h2>
                <p className="text-sm" style={{ color: T.textSecondary }}>Curated for your profile &middot; Updated today</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${T.recNewText}`}
                style={{ background: T.recNewBg, border: `1px solid ${T.recNewBorder}` }}>3 New</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {recommendations.map((rec) => (
                <div key={rec.id}
                  className="group relative cursor-pointer overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:brightness-105"
                  style={rec.cardStyle}>
                  <div className="mb-4 flex items-start justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${rec.iconBg}`}>
                      <rec.icon className={`h-5 w-5 ${rec.iconCls}`} />
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${rec.tagClass}`}>{rec.tag}</span>
                  </div>
                  <h3 className="text-base font-black" style={{ color: T.recTitle }}>{rec.title}</h3>
                  <p className="mt-1.5 text-sm" style={{ color: T.recDesc }}>{rec.desc}</p>
                  <button className="mt-5 flex items-center gap-1 text-sm font-bold transition-colors"
                    style={{ color: T.recCta }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = T.recCtaHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = T.recCta; }}>
                    {rec.cta}
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Journey Path ── */}
          <JourneyPath avatar={avatar} avatarAccent={avatarAccent} readinessScore={readinessScore} data={data} />

          {/* ── Voice + Follow-Up ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

            {/* Voice */}
            <div ref={ref(4)} className="rounded-2xl p-7"
              style={{ background: T.voiceBg, border: `1px solid ${T.voiceBorder}` }}>
              <div className="mb-6 flex items-center gap-2">
                <Mic className={`h-4 w-4 ${T.voiceIconText}`} />
                <span className="text-sm font-bold" style={{ color: T.voiceLabel }}>Voice Interaction</span>
              </div>
              <div className="flex flex-col items-center gap-6 py-2">
                <div className="relative flex items-center justify-center">
                  {isListening && (
                    <>
                      <span className="absolute h-28 w-28 animate-ping rounded-full bg-cyan-500/15 duration-700" />
                      <span className="absolute h-20 w-20 animate-ping rounded-full bg-cyan-500/20" style={{ animationDelay: "0.25s" }} />
                    </>
                  )}
                  <button onClick={handleMic}
                    className={`relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full transition-all duration-300 ${isListening ? "scale-110" : "hover:scale-105"}`}
                    style={isListening
                      ? { background: "#06b6d4", boxShadow: "0 0 36px rgba(6,182,212,0.70)" }
                      : { background: T.micIdleBg }
                    }>
                    <Mic className="h-7 w-7" style={{ color: isListening ? "#ffffff" : T.micIdleIcon }} />
                  </button>
                </div>
                <Waveform active={isListening} T={T} />
                <div className="w-full min-h-[72px] rounded-xl px-5 py-4"
                  style={{ background: T.micBubbleBg, border: `1px solid ${T.micBubbleBorder}` }}>
                  {aiThinking ? (
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-medium text-violet-600 dark:text-violet-300">AI Thinking</span>
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  ) : aiResponse ? (
                    <p className="text-sm leading-relaxed" style={{ color: T.micRespText }}>{aiResponse}</p>
                  ) : (
                    <p className="text-sm" style={{ color: T.micEmptyText }}>
                      {isListening ? "Listening... speak your question" : "Tap the mic and ask your counsellor anything"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Follow-up */}
            <div ref={ref(5)} className="rounded-2xl p-7"
              style={{ background: T.followBg, border: `1px solid ${T.followBorder}` }}>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className={`h-4 w-4 ${T.followIconText}`} />
                  <span className="text-sm font-bold" style={{ color: T.followLabel }}>Follow-Up Tracker</span>
                </div>
                <Button size="sm" className={`h-8 text-xs font-semibold ${T.followBtnText}`}
                  style={{ background: T.followBtnBg, border: `1px solid ${T.followBtnBorder}` }}>
                  Launch Follow-up
                </Button>
              </div>
              <div className="space-y-3">
                {SESSIONS.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3.5 transition-colors"
                    style={{ background: T.sessBg, border: `1px solid ${T.sessBorder}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = T.sessHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = T.sessBg; }}>
                    <div className="relative mt-1 flex flex-col items-center">
                      <div className={`h-3 w-3 rounded-full ${s.color} shadow-[0_0_8px] ${s.glow}`} />
                      {i < SESSIONS.length - 1 && <div className="mt-1.5 h-8 w-px" style={{ background: T.sessLine }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: T.sessTopic }}>{s.topic}</p>
                      <p className="mt-0.5 text-xs" style={{ color: T.sessMeta }}>{s.date} &middot; {s.time}</p>
                    </div>
                    <span className={`mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      s.status === "upcoming"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20"
                        : ""
                    }`}
                      style={s.status !== "upcoming" ? { background: T.sessSchBg, color: T.sessSchText } : {}}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Readiness Trend chart ── */}
          <div ref={ref(6)} className="rounded-2xl p-7"
            style={{ background: T.chartBg, border: `1px solid ${T.chartBorder}` }}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black" style={{ color: T.textPrimary }}>Readiness Trend</h2>
                <p className="text-sm" style={{ color: T.textSecondary }}>Your improvement over the past 7 months</p>
              </div>
              <div className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 ${T.trendText}`}
                style={{ background: T.trendBg, border: `1px solid ${T.trendBorder}` }}>
                <TrendingUp className={`h-3.5 w-3.5 ${T.trendIcon}`} />
                <span className="text-xs font-bold">+59 pts this period</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={PROGRESS_DATA} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="aiDashAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={T.chartGradStop1} stopOpacity={parseFloat(T.chartGradOp1)} />
                    <stop offset="100%" stopColor={T.chartGradStop2} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} />
                <XAxis dataKey="month" tick={{ fill: T.chartTick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: T.chartTick, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: T.chartTipBg, border: `1px solid ${T.chartTipBorder}`, borderRadius: 12, fontSize: 13, color: T.chartTipText }}
                  cursor={{ stroke: T.chartCursorStroke, strokeWidth: 1 }}
                  formatter={(v) => [`${v}`, "Readiness"]}
                />
                <Area dataKey="score"
                  stroke={T.chartStroke} strokeWidth={2.5}
                  fill="url(#aiDashAreaGrad)"
                  dot={{ fill: T.chartDot, r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: T.chartActiveDot, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Action Center ── */}
          <div ref={ref(7)} className="rounded-2xl p-7"
            style={{ background: T.actionBg, border: `1px solid ${T.actionBorder}` }}>
            <h2 className="mb-6 text-xl font-black" style={{ color: T.actionTitle }}>Action Center</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { icon: Play,      label: "Start New Session",    desc: "Begin a fresh AI counselling session",    bg: T.act1Bg, border: T.act1Border, text: T.act1Text },
                { icon: RotateCcw, label: "Retake Assessment",    desc: "Get an updated readiness evaluation",     bg: T.act2Bg, border: T.act2Border, text: T.act2Text },
                { icon: Settings,  label: "Update Info",          desc: "Edit your profile and preferences",       bg: T.act3Bg, border: T.act3Border, text: T.act3Text },
              ].map(({ icon: Icon, label, desc, bg, border, text }) => (
                <button key={label}
                  className={`group flex flex-col gap-4 rounded-2xl p-6 text-left transition-all duration-200 hover:scale-[1.02] hover:brightness-105 ${text}`}
                  style={{ background: bg, border: `1px solid ${border}` }}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: T.actIconBg }}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-base font-black">{label}</p>
                    <p className="mt-0.5 text-sm" style={{ color: T.actDesc }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="h-10" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
