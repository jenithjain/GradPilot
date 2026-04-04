'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import StaggeredMenu from '@/components/StaggeredMenu';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Loader2, ChevronRight, ChevronLeft, CheckCircle2,
  User, GraduationCap, Globe, BookOpen, DollarSign,
  MessageSquare, BarChart2, Sparkles,
} from 'lucide-react';

// ── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 'basic',     label: 'Basic Info',          icon: User },
  { id: 'academic',  label: 'Academic Background',  icon: GraduationCap },
  { id: 'goals',     label: 'Study Goals',          icon: Globe },
  { id: 'test',      label: 'Test & Readiness',     icon: BookOpen },
  { id: 'financial', label: 'Financial Details',    icon: DollarSign },
  { id: 'prefs',     label: 'Preferences',          icon: MessageSquare },
];

// ── Reusable field components ─────────────────────────────────────────────────
function TextInput({ label, name, value, onChange, placeholder, type = 'text' }) {
  return (
    <div className="space-y-1.5">
      <Label className="ivy-font text-sm font-medium text-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        className="ivy-font"
      />
    </div>
  );
}

function SelectGrid({ label, name, options, value, onChange, multi = false }) {
  const selected = multi ? (value || []) : value;
  const toggle = (opt) => {
    if (multi) {
      const arr = selected.includes(opt) ? selected.filter((v) => v !== opt) : [...selected, opt];
      onChange(name, arr);
    } else {
      onChange(name, opt);
    }
  };
  return (
    <div className="space-y-2">
      <Label className="ivy-font text-sm font-medium text-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((opt) => {
          const active = multi ? selected.includes(opt) : selected === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`rounded-lg border-2 px-3 py-2.5 text-left text-sm ivy-font transition-all duration-150
                ${active
                  ? 'border-emerald-500 bg-emerald-500/10 text-foreground font-medium'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-emerald-500/40 hover:bg-muted/50'}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Avatar corner badge ────────────────────────────────────────────────────────
function AvatarBadge({ avatar }) {
  if (!avatar) return null;
  const accents = {
    hulk:      'from-lime-400 to-emerald-500',
    ironman:   'from-amber-400 to-orange-500',
    thor:      'from-sky-400 to-blue-500',
    spiderman: 'from-blue-500 to-indigo-600',
  };
  const accent = accents[avatar.id] || 'from-emerald-400 to-teal-500';
  return (
    <div className={`absolute -top-5 right-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br ${accent} shadow-lg shadow-black/20 ring-2 ring-background`}>
      <Image src={avatar.src} alt={avatar.name} width={56} height={56} className="h-full w-full object-contain drop-shadow-md" />
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ current, total }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="mb-8 space-y-2">
      <div className="flex items-center justify-between text-sm ivy-font">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{pct}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/40">
        <motion.div
          className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-400"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const Icon = s.icon;
          return (
            <div key={s.id} className="flex flex-col items-center gap-1" style={{ width: `${100 / STEPS.length}%` }}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300
                ${done  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                       : active ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                               : 'border-border bg-muted/30 text-muted-foreground'}`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={`hidden text-center text-[10px] leading-tight sm:block ivy-font
                ${active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Card slide variants ───────────────────────────────────────────────────────
const cardVariants = {
  enter:  (dir) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
  center: { opacity: 1, x: 0 },
  exit:   (dir) => ({ opacity: 0, x: dir > 0 ? -60 : 60 }),
};

// ── Final dashboard ───────────────────────────────────────────────────────────
function FinalDashboard({ data, avatar, onRestart }) {
  const readinessScore = (() => {
    let score = 0;
    if (data.educationLevel) score += 20;
    if (data.gpa) score += 15;
    if (data.testStatus === 'Taken') score += 25;
    else if (data.testStatus === 'Preparing') score += 12;
    if (data.budget) score += 15;
    if (data.targetCountry?.length) score += 10;
    if (data.intakeYear) score += 15;
    return Math.min(score, 100);
  })();

  const radarData = [
    { subject: 'Academics', A: data.gpa ? 80 : 40 },
    { subject: 'Language',  A: data.testStatus === 'Taken' ? 90 : data.testStatus === 'Preparing' ? 55 : 25 },
    { subject: 'Finances',  A: data.budget === '₹80L+' ? 90 : data.budget === '₹50L–80L' ? 65 : 45 },
    { subject: 'Clarity',   A: data.careerGoal && data.careerGoal !== 'Undecided' ? 85 : 40 },
    { subject: 'Timeline',  A: data.applicationTimeline === 'Immediately' ? 90 : data.applicationTimeline === 'Within 1 Month' ? 70 : 50 },
  ];

  const countryData = (data.targetCountry?.length ? data.targetCountry : ['UK']).map((c) => ({ name: c, value: 1 }));
  const COLORS = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

  const budgetBar = [
    { name: 'Tuition',  pct: data.budget === '₹80L+' ? 68 : data.budget === '₹50L–80L' ? 58 : 40 },
    { name: 'Living',   pct: 22 },
    { name: 'Travel',   pct: 6 },
    { name: 'Misc',     pct: 4 },
  ];

  const accents = {
    hulk: 'from-lime-400 to-emerald-500', ironman: 'from-amber-400 to-orange-500',
    thor: 'from-sky-400 to-blue-500',     spiderman: 'from-blue-500 to-indigo-600',
  };
  const accent = avatar ? (accents[avatar.id] || 'from-emerald-400 to-teal-500') : 'from-emerald-400 to-teal-500';

  // Stat pills for quick-glance metrics
  const stats = [
    { label: 'Target Course',   value: data.courseInterest || '—',        color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
    { label: 'Intake',          value: data.intakeMonth && data.intakeYear ? `${data.intakeMonth} ${data.intakeYear}` : '—', color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
    { label: 'Test Status',     value: data.testStatus || '—',            color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    { label: 'Budget',          value: data.budget || '—',                color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { label: 'Career Goal',     value: data.careerGoal || '—',            color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
    { label: 'Contact Via',     value: data.contactMethod || '—',         color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55 }}
      className="w-full space-y-5"
    >
      {/* ── Hero banner ── */}
      <Card className="relative overflow-hidden border-border/40 bg-card/90 backdrop-blur-sm shadow-xl">
        <div className={`absolute inset-0 bg-linear-to-br ${accent} opacity-[0.07]`} />
        {/* decorative arc */}
        <div className={`absolute -right-16 -top-16 h-64 w-64 rounded-full bg-linear-to-br ${accent} opacity-20 blur-3xl`} />
        <CardContent className="relative px-8 py-7">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {/* Avatar */}
            {avatar && (
              <div className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-3xl bg-linear-to-br ${accent} shadow-xl ring-4 ring-background`}>
                <Image src={avatar.src} alt={avatar.name} width={108} height={108} className="h-full w-full object-contain drop-shadow-lg" />
              </div>
            )}

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <p className="ivy-font text-sm font-medium uppercase tracking-widest text-muted-foreground">Student Profile</p>
              <h2 className="ivy-font mt-0.5 text-4xl font-extrabold text-foreground leading-tight">{data.fullName || 'Your Name'}</h2>
              <p className="ivy-font mt-1.5 text-base text-muted-foreground">
                {[data.educationLevel, data.fieldOfStudy, data.city].filter(Boolean).join('  ·  ')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(data.targetCountry || []).map((c) => (
                  <span key={c} className="rounded-full bg-emerald-500/15 px-3.5 py-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400 ivy-font">{c}</span>
                ))}
              </div>
            </div>

            {/* Readiness ring */}
            <div className="flex shrink-0 flex-col items-center gap-2">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/30" />
                  <motion.circle
                    cx="60" cy="60" r="52" fill="none" stroke="#10b981" strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 52}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - readinessScore / 100) }}
                    transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
                  />
                </svg>
                <div className="text-center">
                  <span className="ivy-font text-4xl font-extrabold text-foreground">{readinessScore}</span>
                  <span className="ivy-font block text-xs text-muted-foreground">/ 100</span>
                </div>
              </div>
              <span className="ivy-font text-sm font-medium text-muted-foreground">Readiness Score</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Quick-stat pills ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(({ label, value, color }) => (
          <div key={label} className={`rounded-2xl border border-border/40 bg-card/80 px-4 py-3 backdrop-blur-sm ${color.includes('bg') ? '' : ''}`}>
            <p className="ivy-font text-xs text-muted-foreground">{label}</p>
            <p className={`ivy-font mt-1 text-sm font-bold leading-snug ${color.split(' ').slice(1).join(' ')}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Radar – Profile Strength */}
        <Card className="border-border/40 bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-1 pt-5 px-6">
            <CardTitle className="ivy-font text-lg font-bold text-foreground">Profile Strength</CardTitle>
            <p className="ivy-font text-xs text-muted-foreground mt-0.5">Across 5 key dimensions</p>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} outerRadius={85}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fontFamily: 'inherit', fill: 'var(--muted-foreground)', fontWeight: 500 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.35} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie – Target Countries */}
        <Card className="border-border/40 bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-1 pt-5 px-6">
            <CardTitle className="ivy-font text-lg font-bold text-foreground">Target Countries</CardTitle>
            <p className="ivy-font text-xs text-muted-foreground mt-0.5">Your preferred study destinations</p>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={countryData} cx="50%" cy="45%"
                  outerRadius={85} innerRadius={40}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {countryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar – Budget split */}
        <Card className="border-border/40 bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-1 pt-5 px-6">
            <CardTitle className="ivy-font text-lg font-bold text-foreground">Budget Breakdown</CardTitle>
            <p className="ivy-font text-xs text-muted-foreground mt-0.5">Estimated allocation (%)</p>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={budgetBar} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: 'inherit', fill: 'var(--muted-foreground)' }} />
                <YAxis tick={{ fontSize: 12, fontFamily: 'inherit', fill: 'var(--muted-foreground)' }} />
                <Tooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13 }}
                  formatter={(v) => [`${v}%`, 'Share']}
                />
                <Bar dataKey="pct" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Detail info cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          {
            title: 'Academic Background',
            color: 'text-sky-500',
            icon: GraduationCap,
            items: [
              ['Education Level', data.educationLevel],
              ['Field of Study',  data.fieldOfStudy],
              ['Institution',     data.institution],
              ['GPA / Score',     data.gpa],
              ['Backlogs / Gaps', data.backlogs],
            ],
          },
          {
            title: 'Test & Application',
            color: 'text-amber-500',
            icon: BookOpen,
            items: [
              ['Language Test',   data.testStatus],
              ['Score',           data.testScore || (data.testStatus === 'Taken' ? 'Not entered' : '—')],
              ['Apply Timeline',  data.applicationTimeline],
            ],
          },
          {
            title: 'Financial Plan',
            color: 'text-emerald-500',
            icon: DollarSign,
            items: [
              ['Annual Budget',   data.budget],
              ['Scholarship',     data.scholarshipInterest],
            ],
          },
          {
            title: 'Preferences',
            color: 'text-violet-500',
            icon: MessageSquare,
            items: [
              ['Study Environment', data.studyEnv],
              ['Decision Style',    data.decisionStyle],
            ],
          },
          {
            title: 'Contact Details',
            color: 'text-rose-500',
            icon: User,
            items: [
              ['Full Name',         data.fullName],
              ['Email',             data.email],
              ['Phone',             data.phone],
              ['City',              data.city],
              ['Preferred Contact', data.contactMethod],
            ],
          },
          {
            title: 'Study Goals',
            color: 'text-teal-500',
            icon: Globe,
            items: [
              ['Countries',   (data.targetCountry || []).join(', ') || '—'],
              ['Course',      data.courseInterest],
              ['Intake',      data.intakeMonth && data.intakeYear ? `${data.intakeMonth} ${data.intakeYear}` : '—'],
              ['Career Goal', data.careerGoal],
            ],
          },
        ].map(({ title, color, icon: Icon, items }) => (
          <Card key={title} className="border-border/40 bg-card/80 backdrop-blur-sm shadow-sm">
            <CardHeader className="pb-2 pt-5 px-6">
              <CardTitle className="ivy-font flex items-center gap-2 text-base font-bold text-foreground">
                <Icon className={`h-5 w-5 ${color}`} />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-5 space-y-3">
              {items.map(([k, v]) => v ? (
                <div key={k} className="flex items-start justify-between gap-3 border-b border-border/30 pb-2 last:border-0 last:pb-0">
                  <span className="ivy-font text-sm text-muted-foreground whitespace-nowrap">{k}</span>
                  <span className="ivy-font text-sm font-semibold text-foreground text-right">{v}</span>
                </div>
              ) : null)}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
        <Button variant="outline" size="lg" className="ivy-font w-full sm:w-auto" onClick={onRestart}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Edit Responses
        </Button>
        <Button size="lg" className="ivy-font w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
          onClick={() => { window.location.href = '/dashboard'; }}>
          <Sparkles className="mr-2 h-4 w-4" /> Go to Dashboard
        </Button>
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [menuBtnColor, setMenuBtnColor] = useState('#000000');
  const [avatar, setAvatar] = useState(null);
  const [data, setData] = useState({
    // Basic
    fullName: '', phone: '', email: '', city: '',
    // Academic
    educationLevel: '', fieldOfStudy: '', institution: '', gpa: '', backlogs: '',
    // Goals
    targetCountry: [], courseInterest: '', intakeMonth: '', intakeYear: '', careerGoal: '',
    // Test
    testStatus: '', testScore: '', applicationTimeline: '',
    // Financial
    budget: '', scholarshipInterest: '',
    // Prefs + contact
    studyEnv: '', decisionStyle: '', contactMethod: '',
  });

  // Load avatar from localStorage (set by dashboard on journey start)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('selectedAvatar');
      if (stored) setAvatar(JSON.parse(stored));
    } catch {}
  }, []);

  // Theme color sync
  useEffect(() => {
    const update = () => {
      setMenuBtnColor(document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000');
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // Redirect counsellors
  useEffect(() => {
    if (session?.user?.role === 'counsellor') router.push('/dashboard');
  }, [session, router]);

  const set = (name, value) => setData((d) => ({ ...d, [name]: value }));

  const goNext = () => {
    setDir(1);
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else handleSubmit();
  };
  const goBack = () => { setDir(-1); setStep((s) => s - 1); };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await fetch('/api/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {}
    setIsSubmitting(false);
    setDone(true);
  };

  // ── Step card contents ──
  const stepContent = [
    // 0 – Basic Info
    <div key="basic" className="space-y-4">
      <TextInput label="Full Name" name="fullName" value={data.fullName} onChange={set} placeholder="Jane Doe" />
      <TextInput label="Phone Number" name="phone" value={data.phone} onChange={set} placeholder="+91 9000000000" type="tel" />
      <TextInput label="Email Address" name="email" value={data.email} onChange={set} placeholder="you@email.com" type="email" />
      <TextInput label="Current City / Location" name="city" value={data.city} onChange={set} placeholder="Mumbai, India" />
    </div>,

    // 1 – Academic Background
    <div key="academic" className="space-y-5">
      <SelectGrid label="Current Education Level" name="educationLevel" value={data.educationLevel} onChange={set}
        options={['10th / SSC', '12th / HSC', 'Diploma', 'Graduate (Bachelor\'s)', 'Postgraduate (Master\'s)', 'PhD', 'Other']} />
      <TextInput label="Field of Study / Subject" name="fieldOfStudy" value={data.fieldOfStudy} onChange={set} placeholder="e.g. Computer Science, Commerce" />
      <TextInput label="Institution Name" name="institution" value={data.institution} onChange={set} placeholder="University / School name" />
      <TextInput label="GPA / Percentage" name="gpa" value={data.gpa} onChange={set} placeholder="e.g. 8.5 / 10 or 85%" />
      <SelectGrid label="Any Backlogs or Education Gaps?" name="backlogs" value={data.backlogs} onChange={set}
        options={['No', 'Yes – minor gap', 'Yes – with backlogs']} />
    </div>,

    // 2 – Study Goals
    <div key="goals" className="space-y-5">
      <SelectGrid label="Target Country" name="targetCountry" value={data.targetCountry} onChange={set} multi
        options={['UK', 'Ireland', 'USA', 'Canada', 'Australia', 'Germany', 'New Zealand', 'Other']} />
      <SelectGrid label="Course Interest" name="courseInterest" value={data.courseInterest} onChange={set}
        options={['MBA', 'MS / M.Tech', 'Undergraduate (UG)', 'Foundation Year', 'PhD / Research', 'English Language', 'Other']} />
      <div className="grid grid-cols-2 gap-4">
        <SelectGrid label="Intended Intake Month" name="intakeMonth" value={data.intakeMonth} onChange={set}
          options={['January', 'May', 'September']} />
        <SelectGrid label="Year" name="intakeYear" value={data.intakeYear} onChange={set}
          options={['2025', '2026', '2027']} />
      </div>
      <SelectGrid label="Career Goal" name="careerGoal" value={data.careerGoal} onChange={set}
        options={['Job Abroad', 'Return to India', 'Research / Academia', 'PhD', 'Immigration / PR', 'Undecided']} />
    </div>,

    // 3 – Test & Readiness
    <div key="test" className="space-y-5">
      <SelectGrid label="IELTS / TOEFL / PTE Status" name="testStatus" value={data.testStatus} onChange={set}
        options={['Taken', 'Preparing', 'Not Started', 'Not Required']} />
      {data.testStatus === 'Taken' && (
        <TextInput label="Score" name="testScore" value={data.testScore} onChange={set} placeholder="e.g. IELTS 7.0 / TOEFL 105" />
      )}
      <SelectGrid label="Application Timeline" name="applicationTimeline" value={data.applicationTimeline} onChange={set}
        options={['Immediately', 'Within 1 Month', '1–3 Months', '3–6 Months', '6+ Months']} />
    </div>,

    // 4 – Financial Details
    <div key="financial" className="space-y-5">
      <SelectGrid label="Budget Range (per year)" name="budget" value={data.budget} onChange={set}
        options={['₹30L–50L', '₹50L–80L', '₹80L+']} />
      <SelectGrid label="Scholarship Interest" name="scholarshipInterest" value={data.scholarshipInterest} onChange={set}
        options={['Yes – definitely need it', 'Interested but not essential', 'No – self-funded', 'Planning education loan']} />
    </div>,

    // 5 – Preferences & Contact
    <div key="prefs" className="space-y-5">
      <SelectGrid label="Preferred Study Environment" name="studyEnv" value={data.studyEnv} onChange={set}
        options={['Big city / metro', 'Affordable / smaller city', 'No preference']} />
      <SelectGrid label="Decision Making Style" name="decisionStyle" value={data.decisionStyle} onChange={set}
        options={['Independent', 'With family', 'With counsellor guidance']} />
      <SelectGrid label="Preferred Contact Method" name="contactMethod" value={data.contactMethod} onChange={set}
        options={['WhatsApp', 'Call', 'Email']} />
    </div>,
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-50 via-emerald-50/30 to-teal-50 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-950">
        <div className="absolute top-20 left-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
      </div>

      {/* Navbar */}
      <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <StaggeredMenu
            position="right" isFixed={true} logoUrl="/gradpilot.svg"
            accentColor="#22c55e" colors={['#0f172a', '#111827', '#1f2937']}
            menuButtonColor={menuBtnColor} openMenuButtonColor="#22c55e"
            items={[
              { label: 'Home',      link: '/',          ariaLabel: 'Go to Home' },
              { label: 'Dashboard', link: '/dashboard', ariaLabel: 'View Dashboard' },
              { label: 'Profile',   link: '/profile',   ariaLabel: 'View Profile' },
            ]}
          />
        </div>
      </div>

      <div className="relative flex min-h-screen items-start justify-center p-4 pt-24 pb-16">
        <div className={`w-full ${done ? 'max-w-7xl' : 'max-w-2xl'}`}>
          {done ? (
            <FinalDashboard data={data} avatar={avatar} onRestart={() => { setDone(false); setStep(0); }} />
          ) : (
            <>
              <ProgressBar current={step} total={STEPS.length} />

              <AnimatePresence mode="wait" custom={dir}>
                <motion.div
                  key={step}
                  custom={dir}
                  variants={cardVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                >
                  <Card className="relative overflow-visible border-border/40 bg-card/80 pt-8 backdrop-blur-sm shadow-xl">
                    <AvatarBadge avatar={avatar} />
                    <CardHeader className="pb-2">
                      <CardTitle className="ivy-font flex items-center gap-2 text-xl text-foreground">
                        {(() => { const Icon = STEPS[step].icon; return <Icon className="h-5 w-5 text-emerald-500" />; })()}
                        {STEPS[step].label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-8">
                      {stepContent[step]}

                      {/* Navigation */}
                      <div className="mt-8 flex items-center justify-between gap-3">
                        {step > 0 ? (
                          <Button variant="outline" onClick={goBack} className="ivy-font">
                            <ChevronLeft className="mr-1 h-4 w-4" /> Back
                          </Button>
                        ) : <div />}
                        <Button
                          onClick={goNext}
                          disabled={isSubmitting}
                          className="ivy-font ml-auto bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60"
                        >
                          {isSubmitting ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                          ) : step === STEPS.length - 1 ? (
                            <><CheckCircle2 className="mr-2 h-4 w-4" /> Complete</>
                          ) : (
                            <>Next <ChevronRight className="ml-1 h-4 w-4" /></>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </AnimatePresence>

              <p className="mt-4 text-center text-xs text-muted-foreground ivy-font">
                Step {step + 1} of {STEPS.length} — {STEPS[step].label}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
