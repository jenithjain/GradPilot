"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Brain, TrendingUp, Calendar, Mic, ChevronRight, Play, RotateCcw,
  Settings, GraduationCap, Star, BookOpen, Award, Activity,
  Globe, DollarSign, CheckCircle2, MessageSquare, BarChart2,
  User,
} from "lucide-react";
import JourneyPath from "@/components/JourneyPath";
import { getCounsellingFieldValue } from "@/lib/counselling-profile";

// ── Static data ──────────────────────────────────────────────────────────────
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
  { date: "Apr 8",  time: "3:00 PM", topic: "University Selection Strategy", color: "bg-cyan-500",   glow: "shadow-cyan-500/60",   status: "upcoming" },
  { date: "Apr 15", time: "4:30 PM", topic: "SOP & LOR Guidance",            color: "bg-violet-500", glow: "shadow-violet-500/60", status: "scheduled" },
  { date: "Apr 22", time: "2:00 PM", topic: "Visa Application Workshop",      color: "bg-indigo-500", glow: "shadow-indigo-500/60", status: "scheduled" },
];

const PIE_COLORS = ["#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899"];



// ── Helper: derive display-friendly values from counselling profile ──────────
function deriveDisplayData(profile) {
  const get = (key) => getCounsellingFieldValue(profile, key);

  const name = get("studentName") || "Student";
  const countries = Array.isArray(get("targetCountries")) ? get("targetCountries") : [];
  const primaryCountry = countries[0] || "UK";
  const course = get("courseInterest") || get("fieldOfStudy") || "Your Course";
  const testStatus = get("englishTestStatus") || "";
  const needsTest = !testStatus || /not|preparing|planning|soon/i.test(testStatus);
  const budget = get("budgetRange") || "—";
  const timeline = get("applicationTimeline") || "In Progress";
  const education = get("educationLevel") || "";
  const field = get("fieldOfStudy") || "";
  const location = get("currentLocation") || "";
  const institution = get("institution") || "";
  const gpa = get("gpaPercentage") || "";
  const phone = get("phoneNumber") || "";
  const email = get("contactEmail") || "";

  // Readiness score calculation
  let readinessScore = 0;
  if (education) readinessScore += 15;
  if (gpa) readinessScore += 12;
  if (!needsTest) readinessScore += 25;
  else if (/preparing|planning|soon/i.test(testStatus)) readinessScore += 10;
  if (budget && budget !== "—") readinessScore += 15;
  if (countries.length > 0) readinessScore += 10;
  if (timeline) readinessScore += 8;
  if (course) readinessScore += 8;
  if (institution) readinessScore += 7;
  readinessScore = Math.min(readinessScore, 100);

  const readinessLabel = readinessScore >= 75 ? "Strong Profile" : readinessScore >= 50 ? "Developing" : "Early Stage";
  const readinessColor = readinessScore >= 75 ? "#10b981" : readinessScore >= 50 ? "#f59e0b" : "#ef4444";

  const matchCount = Math.min((countries.length || 1) * 4, 20);
  const avgFit = `${Math.min(readinessScore + 4, 95)}%`;
  const urgentCount = [needsTest, !gpa, !timeline || timeline === "In Progress"].filter(Boolean).length || 1;

  // Tags
  const profileTags = [
    `${primaryCountry} Target`,
    timeline !== "In Progress" ? timeline : "Next Intake",
    needsTest ? "Test Pending" : "Test Ready",
  ];

  // Radar data for profile strength
  const radarData = [
    { subject: "Academics", A: gpa ? 80 : 40 },
    { subject: "Language", A: needsTest ? (testStatus ? 45 : 25) : 90 },
    { subject: "Finances", A: budget && budget !== "—" ? 70 : 35 },
    { subject: "Clarity", A: course ? 80 : 40 },
    { subject: "Timeline", A: timeline && timeline !== "In Progress" ? 75 : 45 },
  ];

  // Country pie data
  const countryData = (countries.length ? countries : ["UK"]).map((c) => ({ name: c, value: 1 }));

  // Budget bar data
  const budgetBar = [
    { name: "Tuition", pct: budget.includes("80") || budget.includes("high") ? 42 : budget.includes("50") ? 36 : 30 },
    { name: "Living", pct: 22 },
    { name: "Travel", pct: 6 },
    { name: "Misc", pct: 4 },
  ];

  return {
    name, countries, primaryCountry, course, testStatus, needsTest,
    budget, timeline, education, field, location, institution, gpa,
    phone, email,
    readinessScore, readinessLabel, readinessColor,
    matchCount, avgFit, urgentCount, profileTags,
    radarData, countryData, budgetBar,
  };
}

// ── Radial progress ring ─────────────────────────────────────────────────────
function RadialScore({ value, label, color, delay = 0 }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24">
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="36" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
          <motion.circle
            cx="44" cy="44" r="36" fill="none" stroke={color} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 36}`}
            initial={{ strokeDashoffset: 2 * Math.PI * 36 }}
            animate={{ strokeDashoffset: 2 * Math.PI * 36 * (1 - value / 100) }}
            transition={{ duration: 1.5, ease: "easeOut", delay }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black text-foreground">{value}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

// ── Waveform ──────────────────────────────────────────────────────────────────
function Waveform({ active }) {
  return (
    <div className="flex h-10 items-center justify-center gap-1">
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${active ? "animate-pulse" : ""}`}
          style={{
            width: 3,
            height: active ? `${12 + (i % 5) * 8}px` : "6px",
            backgroundColor: active ? `hsl(${185 + i * 8},85%,65%)` : "var(--muted)",
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function CompleteDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatar, setAvatar] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("selectedAvatar");
      if (stored) setAvatar(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/kyc", { cache: "no-store" });
        if (!res.ok) {
          router.push("/dashboard");
          return;
        }
        const data = await res.json();
        const progress = data.counsellingProgress || {};
        if (!progress.isComplete) {
          router.push("/dashboard");
          return;
        }
        setProfile(data.studentProfile || {});
      } catch {
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [router]);

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="ivy-font text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const d = deriveDisplayData(profile);

  const avatarAccents = {
    1: "from-lime-400 to-emerald-500",
    2: "from-amber-400 to-orange-500",
    3: "from-sky-400 to-blue-500",
    4: "from-blue-500 to-indigo-600",
    hulk: "from-lime-400 to-emerald-500",
    ironman: "from-amber-400 to-orange-500",
    thor: "from-sky-400 to-blue-500",
    spiderman: "from-blue-500 to-indigo-600",
  };

  const accent = avatar
    ? avatarAccents[avatar.id] || avatarAccents[avatar.name?.toLowerCase()] || "from-emerald-400 to-teal-500"
    : "from-emerald-400 to-teal-500";

  const aiInsightBody = d.needsTest
    ? `Language test (IELTS/TOEFL) is your primary gap. Clearing Band 7 unlocks ${d.matchCount}+ additional options for ${d.course}.`
    : d.readinessScore >= 75
    ? `Profile aligned for ${d.course} in ${d.primaryCountry}. Focus on strengthening your SOP and securing strong reference letters.`
    : `Core profile is developing. Finalise your intake preferences and institution shortlist to sharpen your matches.`;

  const topPickLabel = !d.needsTest
    ? `Strong shortlist candidate for ${d.primaryCountry} universities`
    : `IELTS clearance will unlock top universities in ${d.primaryCountry}`;

  const recommendations = [
    {
      id: 1, icon: GraduationCap,
      iconBg: "bg-blue-500/15", iconCls: "text-blue-500 dark:text-blue-400",
      title: `Top University in ${d.primaryCountry}`,
      tag: `${Math.min(d.readinessScore + 7, 97)}% Match`,
      tagCls: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
      desc: `${d.course} — ${d.timeline !== "In Progress" ? d.timeline : "Next"} intake`,
      cta: "View Details",
      gradient: "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
      border: "border-blue-200/60 dark:border-blue-800/40",
    },
    {
      id: 2, icon: BookOpen,
      iconBg: d.needsTest ? "bg-rose-500/15" : "bg-emerald-500/15",
      iconCls: d.needsTest ? "text-rose-500 dark:text-rose-400" : "text-emerald-500 dark:text-emerald-400",
      title: d.needsTest ? "Language Test Preparation" : "Application Documents",
      tag: d.needsTest ? "Urgent" : "Next Step",
      tagCls: d.needsTest ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      desc: d.needsTest
        ? `Band 7.0 target — required for ${d.primaryCountry} universities`
        : "SOP & recommendation letters — your next milestone",
      cta: d.needsTest ? "Start Prep" : "Begin Writing",
      gradient: d.needsTest
        ? "from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30"
        : "from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30",
      border: d.needsTest ? "border-rose-200/60 dark:border-rose-800/40" : "border-emerald-200/60 dark:border-emerald-800/40",
    },
    {
      id: 3, icon: Award,
      iconBg: "bg-amber-500/15", iconCls: "text-amber-500 dark:text-amber-400",
      title: "Scholarship Opportunities",
      tag: "Explore",
      tagCls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      desc: `Financial aid options for ${d.primaryCountry} study`,
      cta: "Apply Now",
      gradient: "from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
      border: "border-amber-200/60 dark:border-amber-800/40",
    },
  ];

  // Quick stat pills
  const quickStats = [
    { label: "Target Course", value: d.course || "—", icon: BookOpen, color: "sky" },
    { label: "Intake", value: d.timeline !== "In Progress" ? d.timeline : "—", icon: Globe, color: "violet" },
    { label: "Test Status", value: d.needsTest ? "Pending" : "Ready", icon: CheckCircle2, color: "amber" },
    { label: "Annual Budget", value: d.budget, icon: DollarSign, color: "emerald" },
    { label: "Career Goal", value: d.field || "—", icon: BarChart2, color: "rose" },
    { label: "Contact Via", value: d.email ? "Email" : d.phone ? "Phone" : "—", icon: MessageSquare, color: "teal" },
  ];

  const colorMap = {
    sky:     { bg: "bg-sky-500/10", border: "border-sky-500/30", text: "text-sky-600 dark:text-sky-400" },
    violet:  { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-600 dark:text-violet-400" },
    amber:   { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-600 dark:text-amber-400" },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-600 dark:text-emerald-400" },
    rose:    { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-600 dark:text-rose-400" },
    teal:    { bg: "bg-teal-500/10", border: "border-teal-500/30", text: "text-teal-600 dark:text-teal-400" },
  };

  // Journey data derived from profile
  const journeyData = {
    testStatus: d.needsTest ? (d.testStatus ? "Preparing" : "Not Taken") : "Taken",
    targetCountry: d.countries,
  };

  return (
    <div className="min-h-screen w-full">
      <div className="container mx-auto max-w-[1380px] space-y-6 p-4 sm:p-6 lg:p-8">

        {/* ── Hero Banner ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="relative overflow-hidden border-border/40 bg-card/90 backdrop-blur-sm shadow-2xl">
            <div className={`absolute inset-0 bg-linear-to-br ${accent} opacity-[0.07]`} />
            <div className={`absolute -right-20 -top-20 h-80 w-80 rounded-full bg-linear-to-br ${accent} opacity-20 blur-3xl`} />
            <div className={`absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-linear-to-br ${accent} opacity-10 blur-3xl`} />
            <CardContent className="relative px-8 py-8 sm:px-10 sm:py-10">
              <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
                {/* Avatar */}
                {avatar && (
                  <div className={`flex h-32 w-32 shrink-0 items-center justify-center rounded-3xl bg-linear-to-br ${accent} shadow-2xl ring-4 ring-background`}>
                    <Image src={avatar.src} alt={avatar.name} width={120} height={120}
                      className="h-full w-full object-contain drop-shadow-lg" />
                  </div>
                )}

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <p className="ivy-font text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">
                    Student Profile Summary
                  </p>
                  <h2 className="ivy-font mt-1.5 text-4xl font-extrabold tracking-tight text-foreground leading-tight sm:text-5xl">
                    {d.name}
                  </h2>
                  <p className="ivy-font mt-2 text-base font-medium text-muted-foreground">
                    {[d.education, d.field, d.location].filter(Boolean).join("  ·  ")}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {d.countries.map((c) => (
                      <span key={c} className="ivy-font rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Readiness ring */}
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <div className="relative flex h-36 w-36 items-center justify-center">
                    <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="9" className="text-muted/20" />
                      {mounted && (
                        <motion.circle
                          cx="60" cy="60" r="52" fill="none" stroke={d.readinessColor} strokeWidth="9"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 52}`}
                          initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                          animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - d.readinessScore / 100) }}
                          transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
                        />
                      )}
                    </svg>
                    <div className="text-center">
                      <span className="ivy-font text-4xl font-black text-foreground">{d.readinessScore}</span>
                      <span className="ivy-font block text-sm font-bold text-muted-foreground">/ 100</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="ivy-font block text-xs font-bold uppercase tracking-widest text-muted-foreground">Readiness Score</span>
                    <span className="ivy-font mt-0.5 block text-sm font-extrabold" style={{ color: d.readinessColor }}>{d.readinessLabel}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Quick Stat Pills ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        >
          {quickStats.map(({ label, value, icon: Icon, color }) => {
            const c = colorMap[color];
            return (
              <div key={label} className={`rounded-2xl border ${c.border} ${c.bg} px-4 py-3.5 backdrop-blur-sm`}>
                <div className={`mb-1.5 flex items-center gap-1.5 ${c.text}`}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <p className="ivy-font text-[10px] font-black uppercase tracking-widest">{label}</p>
                </div>
                <p className={`ivy-font text-sm font-extrabold leading-snug ${c.text}`}>{value}</p>
              </div>
            );
          })}
        </motion.div>

        {/* ── Charts Row ── */}
        {mounted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-1 gap-5 md:grid-cols-3"
          >
            {/* Radar Chart - Profile Strength */}
            <Card className="border-border/40 bg-card/80 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-2 pt-6 px-7">
                <CardTitle className="ivy-font text-lg font-extrabold tracking-tight text-foreground">Profile Strength</CardTitle>
                <p className="ivy-font mt-0.5 text-xs font-black uppercase tracking-widest text-muted-foreground">Across 5 key dimensions</p>
              </CardHeader>
              <CardContent className="px-2 pb-5">
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={d.radarData} outerRadius={95}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fontFamily: "inherit", fill: "var(--muted-foreground)", fontWeight: 700 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.35} strokeWidth={2.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie Chart - Target Countries */}
            <Card className="border-border/40 bg-card/80 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-2 pt-6 px-7">
                <CardTitle className="ivy-font text-lg font-extrabold tracking-tight text-foreground">Target Countries</CardTitle>
                <p className="ivy-font mt-0.5 text-xs font-black uppercase tracking-widest text-muted-foreground">Preferred study destinations</p>
              </CardHeader>
              <CardContent className="px-2 pb-5">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={d.countryData} cx="50%" cy="45%"
                      outerRadius={90} innerRadius={45}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {d.countryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Bar Chart - Budget Breakdown */}
            <Card className="border-border/40 bg-card/80 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-2 pt-6 px-7">
                <CardTitle className="ivy-font text-lg font-extrabold tracking-tight text-foreground">Budget Breakdown</CardTitle>
                <p className="ivy-font mt-0.5 text-xs font-black uppercase tracking-widest text-muted-foreground">Estimated allocation (%)</p>
              </CardHeader>
              <CardContent className="px-3 pb-5">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={d.budgetBar} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: "inherit", fill: "var(--muted-foreground)", fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 11, fontFamily: "inherit", fill: "var(--muted-foreground)" }} />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 13, fontWeight: 700 }}
                      formatter={(v) => [`${v}%`, "Share"]}
                    />
                    <Bar dataKey="pct" fill="#10b981" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── AI Insight + Wellbeing ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-1 gap-5 lg:grid-cols-3"
        >
          {/* AI Insight (2/3) */}
          <Card className="relative overflow-hidden border-border/40 bg-card/80 backdrop-blur-sm lg:col-span-2">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-52 w-52 rounded-full bg-indigo-500/10 blur-3xl" />
            <CardContent className="relative p-7">
              <div className="mb-5 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15">
                  <Brain className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <span className="text-sm font-bold text-violet-600 dark:text-violet-400">AI Insight</span>
                <span className="ml-auto rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/25">
                  Live
                </span>
              </div>

              <h3 className="text-xl font-black leading-snug text-foreground lg:text-2xl">
                {d.readinessScore >= 75 ? (
                  <>Your profile shows <span className="bg-linear-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">strong potential</span> for {d.primaryCountry} universities.</>
                ) : d.needsTest ? (
                  <>Your core profile is solid. <span className="bg-linear-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">Language test</span> is your primary gap.</>
                ) : (
                  <>Your profile is <span className="bg-linear-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">on track</span>. Build your shortlist and application documents.</>
                )}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{aiInsightBody}</p>

              {/* Stats */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                {[
                  [d.matchCount, "Matches", "text-indigo-600 dark:text-indigo-400"],
                  [d.avgFit, "Avg Fit", "text-emerald-600 dark:text-emerald-400"],
                  [d.urgentCount, "Urgent", "text-orange-600 dark:text-orange-400"],
                ].map(([num, label, colorCls]) => (
                  <div key={label} className="rounded-xl border border-border/50 bg-muted/30 py-4 text-center">
                    <p className={`text-3xl font-black ${colorCls}`}>{num}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Top pick */}
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3">
                <Star className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                <span className="text-xs font-medium text-violet-600 dark:text-violet-400">{topPickLabel}</span>
              </div>
            </CardContent>
          </Card>

          {/* Wellbeing (1/3) */}
          <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15">
                  <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Wellbeing Scores</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">AI-assessed today</p>
                </div>
              </div>
              <div className="flex items-center justify-around py-2">
                <RadialScore value={72} label="Focus" color="#3b82f6" delay={0.5} />
                <RadialScore value={58} label="Confidence" color="#8b5cf6" delay={0.65} />
                <RadialScore value={44} label="Stress" color="#10b981" delay={0.8} />
              </div>
              <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">AI Assessment</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Focus is high — ideal for tackling complex applications. Stress is manageable; maintain your momentum.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Personalised Recommendations ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="ivy-font text-xl font-black text-foreground">Personalised Recommendations</h2>
              <p className="ivy-font text-sm text-muted-foreground">Curated for your profile · Updated today</p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
              3 New
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className={`group relative cursor-pointer overflow-hidden rounded-2xl border ${rec.border} bg-linear-to-br ${rec.gradient} p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg`}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${rec.iconBg}`}>
                    <rec.icon className={`h-5 w-5 ${rec.iconCls}`} />
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${rec.tagCls}`}>{rec.tag}</span>
                </div>
                <h3 className="text-base font-black text-foreground">{rec.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{rec.desc}</p>
                <button className="mt-5 flex items-center gap-1 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground">
                  {rec.cta}
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Journey Path ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <JourneyPath
            avatar={avatar}
            avatarAccent={accent}
            readinessScore={d.readinessScore}
            data={journeyData}
          />
        </motion.div>

        {/* ── Voice + Follow-Up ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="grid grid-cols-1 gap-5 lg:grid-cols-2"
        >
          {/* Voice Interaction */}
          <Card className="border-border/40 bg-linear-to-b from-cyan-50/60 to-card/90 dark:from-cyan-950/20 dark:to-card/90 backdrop-blur-sm">
            <CardContent className="p-7">
              <div className="mb-6 flex items-center gap-2">
                <Mic className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <span className="text-sm font-bold text-muted-foreground">Voice Interaction</span>
              </div>
              <div className="flex flex-col items-center gap-5 py-2">
                <div className="relative flex items-center justify-center">
                  {isListening && (
                    <>
                      <span className="absolute h-28 w-28 animate-ping rounded-full bg-cyan-500/15 duration-700" />
                      <span className="absolute h-20 w-20 animate-ping rounded-full bg-cyan-500/20" style={{ animationDelay: "0.25s" }} />
                    </>
                  )}
                  <button
                    onClick={() => setIsListening(!isListening)}
                    className={`relative z-10 flex h-[68px] w-[68px] items-center justify-center rounded-full transition-all duration-300 ${
                      isListening ? "scale-110 bg-cyan-500 shadow-[0_0_36px_rgba(6,182,212,0.70)]" : "bg-muted/40 hover:scale-105 hover:bg-muted/60"
                    }`}
                  >
                    <Mic className={`h-7 w-7 ${isListening ? "text-white" : "text-muted-foreground"}`} />
                  </button>
                </div>
                <Waveform active={isListening} />
                <div className="w-full min-h-[60px] rounded-xl border border-border/50 bg-muted/20 px-5 py-4">
                  <p className="text-sm text-muted-foreground">
                    {isListening ? "Listening... speak your question" : "Tap the mic and ask your counsellor anything"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Follow-up Tracker */}
          <Card className="border-border/40 bg-linear-to-b from-indigo-50/60 to-card/90 dark:from-indigo-950/20 dark:to-card/90 backdrop-blur-sm">
            <CardContent className="p-7">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm font-bold text-muted-foreground">Follow-Up Tracker</span>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20">
                  Launch Follow-up
                </Button>
              </div>
              <div className="space-y-3">
                {SESSIONS.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-border/40 bg-muted/15 px-4 py-3.5 transition-colors hover:bg-muted/30">
                    <div className="relative mt-1 flex flex-col items-center">
                      <div className={`h-3 w-3 rounded-full ${s.color} shadow-[0_0_8px] ${s.glow}`} />
                      {i < SESSIONS.length - 1 && <div className="mt-1.5 h-8 w-px bg-border/50" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{s.topic}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.date} · {s.time}</p>
                    </div>
                    <span className={`mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      s.status === "upcoming"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20"
                        : "bg-muted/40 text-muted-foreground"
                    }`}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Readiness Trend ── */}
        {mounted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-7">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="ivy-font text-xl font-black text-foreground">Readiness Trend</h2>
                    <p className="ivy-font text-sm text-muted-foreground">Your improvement over the past 7 months</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3.5 py-1.5 ring-1 ring-emerald-500/20">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+59 pts this period</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={PROGRESS_DATA} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="completeDashAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                    <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 13, color: "var(--foreground)" }}
                      formatter={(v) => [`${v}`, "Readiness"]}
                    />
                    <Area
                      dataKey="score"
                      stroke="#7c3aed" strokeWidth={2.5}
                      fill="url(#completeDashAreaGrad)"
                      dot={{ fill: "#7c3aed", r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: "#6d28d9", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Action Center ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
        >
          <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-7">
              <h2 className="ivy-font mb-6 text-xl font-black text-foreground">Action Center</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: Play,
                    label: "Start New Session",
                    desc: "Begin a fresh AI counselling session",
                    gradient: "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
                    border: "border-blue-200/60 dark:border-blue-800/40",
                    text: "text-blue-600 dark:text-blue-400",
                    iconBg: "bg-blue-500/15",
                  },
                  {
                    icon: RotateCcw,
                    label: "Retake Assessment",
                    desc: "Get an updated readiness evaluation",
                    gradient: "from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30",
                    border: "border-violet-200/60 dark:border-violet-800/40",
                    text: "text-violet-600 dark:text-violet-400",
                    iconBg: "bg-violet-500/15",
                  },
                  {
                    icon: Settings,
                    label: "Update Info",
                    desc: "Edit your profile and preferences",
                    gradient: "from-slate-50 to-gray-50 dark:from-slate-900/30 dark:to-gray-900/30",
                    border: "border-slate-200/60 dark:border-slate-700/40",
                    text: "text-slate-600 dark:text-slate-400",
                    iconBg: "bg-slate-500/10",
                    action: () => router.push("/dashboard"),
                  },
                ].map(({ icon: Icon, label, desc, gradient, border, text, iconBg, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    className={`group flex flex-col gap-4 rounded-2xl border ${border} bg-linear-to-br ${gradient} p-6 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-md ${text}`}
                  >
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-base font-black">{label}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Detail Info Cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          {[
            {
              title: "Academic Background",
              iconColor: "text-sky-500", topBorder: "border-t-2 border-t-sky-500",
              icon: GraduationCap,
              items: [
                ["Education Level", d.education],
                ["Field of Study", d.field],
                ["Institution", d.institution],
                ["GPA / Score", d.gpa],
              ],
            },
            {
              title: "Test & Application",
              iconColor: "text-amber-500", topBorder: "border-t-2 border-t-amber-500",
              icon: BookOpen,
              items: [
                ["Language Test", d.testStatus || "—"],
                ["Score", !d.needsTest ? d.testStatus : "—"],
                ["Apply Timeline", d.timeline],
              ],
            },
            {
              title: "Financial Plan",
              iconColor: "text-emerald-500", topBorder: "border-t-2 border-t-emerald-500",
              icon: DollarSign,
              items: [
                ["Annual Budget", d.budget],
              ],
            },
            {
              title: "Preferences",
              iconColor: "text-violet-500", topBorder: "border-t-2 border-t-violet-500",
              icon: MessageSquare,
              items: [],
            },
            {
              title: "Contact Details",
              iconColor: "text-rose-500", topBorder: "border-t-2 border-t-rose-500",
              icon: User,
              items: [
                ["Full Name", d.name !== "Student" ? d.name : null],
                ["Email", d.email],
                ["Phone", d.phone],
                ["City", d.location],
              ],
            },
            {
              title: "Study Goals",
              iconColor: "text-teal-500", topBorder: "border-t-2 border-t-teal-500",
              icon: Globe,
              items: [
                ["Countries", d.countries.length ? d.countries.join(", ") : "—"],
                ["Course", d.course !== "Your Course" ? d.course : "—"],
                ["Intake", d.timeline !== "In Progress" ? d.timeline : "—"],
              ],
            },
          ].map(({ title, iconColor, topBorder, icon: Icon, items }) => (
            <Card key={title} className={`border-border/40 ${topBorder} bg-card/80 backdrop-blur-sm shadow-sm`}>
              <CardHeader className="pb-3 pt-7 px-7">
                <CardTitle className="ivy-font flex items-center gap-3 text-lg font-extrabold tracking-tight text-foreground">
                  <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} />
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-7 pb-7">
                {items.filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-4 border-b border-border/30 pb-3.5 last:border-0 last:pb-0">
                    <span className="ivy-font text-xs font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">{k}</span>
                    <span className="ivy-font text-sm font-extrabold text-foreground text-right">{v}</span>
                  </div>
                ))}
                {items.filter(([, v]) => v).length === 0 && (
                  <p className="ivy-font text-sm text-muted-foreground">—</p>
                )}
              </CardContent>
            </Card>
          ))}
        </motion.div>

        <div className="h-8" />
      </div>
    </div>
  );
}
