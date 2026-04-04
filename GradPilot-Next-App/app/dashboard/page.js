"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Rocket,
  Sparkles,
  Mic2,
  PenLine,
  X,
  ChevronRight,
} from "lucide-react";

const ElevenLabsVoiceAgent = dynamic(() => import('@/components/ElevenLabsVoiceAgent'), { ssr: false });
const AICounsellingDashboard = dynamic(() => import('@/components/AICounsellingDashboard'), { ssr: false, loading: () => null });
const StudentProfileCard = dynamic(() => import('@/components/StudentProfileCard'), { ssr: false });
const LiveKYCChecklist = dynamic(() => import('@/components/LiveKYCChecklist'), { ssr: false });

const AVATARS = [
  { id: 1, name: "Hulk",       src: "/avatars/hulk.png",       accent: "from-lime-400 to-emerald-500",  ringColor: "ring-emerald-500", desc: "Bold and unstoppable" },
  { id: 2, name: "Iron Man",   src: "/avatars/ironman.png",    accent: "from-amber-400 to-orange-500",  ringColor: "ring-orange-500",  desc: "Sharp and visionary" },
  { id: 3, name: "Thor",       src: "/avatars/thor.png",       accent: "from-sky-400 to-blue-500",     ringColor: "ring-sky-500",     desc: "Calm power and focus" },
  { id: 4, name: "Spider-Man", src: "/avatars/spiderman.png", accent: "from-blue-500 to-indigo-600",  ringColor: "ring-indigo-500",  desc: "Fast, agile, and driven" },
];

export default function Dashboard() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const [showJourneyModal, setShowJourneyModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [showFillMethod, setShowFillMethod] = useState(false);
  const [showVoiceAgent, setShowVoiceAgent] = useState(false);

  // KYC status state
  const [kycStatus, setKycStatus] = useState('loading'); // 'loading' | 'completed' | 'in-progress' | 'new'
  const [studentProfile, setStudentProfile] = useState(null);
  const [savedAvatar, setSavedAvatar] = useState(null);
  // Counter to force StudentProfileCard refresh after voice agent completes
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);

  // Check KYC status on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/kyc');
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;

        setStudentProfile(data.studentProfile || null);

        if (data.hasCompletedKYC && data.studentProfile) {
          setKycStatus('completed');
        } else if (data.studentProfile && Object.keys(data.studentProfile).length > 0) {
          // Has partial data from a previous conversation
          setKycStatus('in-progress');
        } else {
          setKycStatus('new');
        }
      } catch {
        if (!cancelled) setKycStatus('new');
      }

      // Load saved avatar from localStorage
      try {
        const stored = localStorage.getItem('selectedAvatar');
        if (stored && !cancelled) setSavedAvatar(JSON.parse(stored));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [profileRefreshKey]);

  const handleVoiceComplete = useCallback(async () => {
    setShowVoiceAgent(false);
    // Refresh the profile card + KYC status
    setProfileRefreshKey((k) => k + 1);
    try {
      const res = await fetch('/api/kyc');
      if (res.ok) {
        const data = await res.json();
        setStudentProfile(data.studentProfile || null);
        if (data.hasCompletedKYC && data.studentProfile) {
          setKycStatus('completed');
          await updateSession({ hasCompletedKYC: true });
        } else if (data.studentProfile && Object.keys(data.studentProfile).length > 0) {
          setKycStatus('in-progress');
        }
      }
    } catch {}
  }, [updateSession]);

  const handleAvatarSelect = (avatar) => {
    setSelectedAvatar(avatar);
  };

  const handleConfirmAvatar = () => {
    setShowFillMethod(true);
  };

  const closeJourneyFlow = () => {
    setShowJourneyModal(false);
    setSelectedAvatar(AVATARS[0]);
    setShowFillMethod(false);
  };

  // ── Loading state ──
  if (kycStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="ivy-font text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // ── KYC Completed → Show the AI counselling dashboard with profile card ──
  if (kycStatus === 'completed' && studentProfile) {
    const avatar = savedAvatar || AVATARS[0];
    const dashData = {
      fullName: studentProfile.studentName || session?.user?.name || '',
      educationLevel: studentProfile.educationLevel || '',
      fieldOfStudy: studentProfile.fieldOfStudy || '',
      institution: studentProfile.institution || '',
      gpa: studentProfile.gpaPercentage || '',
      targetCountry: studentProfile.targetCountries || [],
      courseInterest: studentProfile.courseInterest || '',
      testStatus: studentProfile.testStatus || '',
      testScore: studentProfile.testScore || '',
      budget: studentProfile.budgetRange || '',
      scholarshipInterest: studentProfile.scholarshipInterest || '',
      applicationTimeline: studentProfile.applicationTimeline || '',
      careerGoal: studentProfile.primaryObjective || '',
    };
    return (
      <div className="min-h-screen w-full">
        <AICounsellingDashboard avatar={avatar} data={dashData} onClose={() => {}} />
        <div className="container mx-auto max-w-7xl px-6 pb-12">
          <StudentProfileCard refreshKey={profileRefreshKey} />
        </div>
      </div>
    );
  }

  // ── In-progress: show profile card with collected data + resume option ──
  // ── New: show onboarding prompt ──
  return (
    <div className="min-h-screen w-full">
      <div className="container mx-auto max-w-7xl space-y-8 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="ivy-font mb-2 text-4xl font-bold text-foreground">
              Student Dashboard
            </h1>
            <p className="ivy-font text-muted-foreground">
              AI-powered student lead qualification and counselling analytics
            </p>
          </div>
        </div>

        {/* ── Show profile card if any data has been collected ── */}
        {kycStatus === 'in-progress' && (
          <StudentProfileCard
            onResumeCall={() => setShowVoiceAgent(true)}
            refreshKey={profileRefreshKey}
          />
        )}

        {/* ── Onboarding prompt (shown when NO data yet) ── */}
        {kycStatus === 'new' && (
          <Card className="relative overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm">
            <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />

            <CardContent className="relative flex flex-col items-center justify-center gap-10 py-24 sm:py-32">
              <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-linear-to-br from-emerald-400 to-teal-500 shadow-2xl shadow-emerald-500/40 ring-4 ring-emerald-500/20">
                <Rocket className="h-14 w-14 text-white" />
              </div>

              <div className="space-y-4 text-center">
                <h2 className="ivy-font text-4xl font-extrabold text-foreground sm:text-5xl lg:text-6xl">
                  Ready to begin?
                </h2>
                <p className="ivy-font mx-auto max-w-xl text-lg text-muted-foreground sm:text-xl">
                  Set up your student profile so we can personalise your counselling journey and match you with the best universities.
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {[
                  { icon: "🎓", label: "University Matching" },
                  { icon: "🗺️", label: "Personalised Roadmap" },
                  { icon: "💬", label: "AI Counselling" },
                  { icon: "📊", label: "Readiness Score" },
                ].map(({ icon, label }) => (
                  <span
                    key={label}
                    className="ivy-font flex items-center gap-2 rounded-full border border-border/50 bg-muted/40 px-5 py-2 text-sm font-medium text-foreground backdrop-blur-sm"
                  >
                    <span>{icon}</span>{label}
                  </span>
                ))}
              </div>

              <Button
                onClick={() => setShowJourneyModal(true)}
                className="h-14 bg-linear-to-r from-emerald-500 to-teal-500 px-10 text-lg font-bold text-white shadow-xl shadow-emerald-500/30 transition-all duration-300 hover:scale-105 hover:from-emerald-600 hover:to-teal-600"
              >
                <Sparkles className="mr-2.5 h-6 w-6" />
                Start Your Journey
              </Button>
            </CardContent>
          </Card>
        )}
        {/* ── Avatar Picker Modal ── */}
        {showJourneyModal && !showFillMethod && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/50 bg-card shadow-2xl">
              <button
                type="button"
                onClick={closeJourneyFlow}
                className="absolute right-4 top-4 z-10 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>

              <AvatarPicker
                avatars={AVATARS}
                selectedId={selectedAvatar?.id}
                onSelect={handleAvatarSelect}
              />

              <div className="px-8 pb-8">
                <button
                  type="button"
                  onClick={handleConfirmAvatar}
                  className="ivy-font w-full rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:scale-[1.02] hover:from-emerald-600 hover:to-teal-600"
                >
                  Continue with {selectedAvatar?.name}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Fill Method Modal ── */}
        {showJourneyModal && showFillMethod && selectedAvatar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl rounded-3xl border border-border/50 bg-card p-8 shadow-2xl sm:p-10">
              <button
                type="button"
                onClick={closeJourneyFlow}
                className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="mb-8 flex flex-col items-center gap-4">
                <div className={`flex h-48 w-48 items-center justify-center rounded-3xl bg-linear-to-br ${selectedAvatar.accent} p-5 shadow-lg shadow-black/20`}>
                  <Image
                    src={selectedAvatar.src}
                    alt={selectedAvatar.name}
                    width={220}
                    height={220}
                    className="h-full w-full object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
                  />
                </div>
                <p className="ivy-font text-2xl font-semibold text-foreground">{selectedAvatar.name}</p>
              </div>
              <div className="mb-6 text-center">
                <h2 className="ivy-font text-2xl font-bold text-foreground">
                  How would you like to fill your profile?
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    try { localStorage.setItem('selectedAvatar', JSON.stringify(selectedAvatar)); } catch {}
                    closeJourneyFlow();
                    router.push("/onboarding");
                  }}
                  className="group flex flex-col items-center gap-4 rounded-xl border border-border/50 bg-muted/30 p-6 transition-all duration-200 hover:scale-105 hover:border-emerald-500/60 hover:bg-emerald-500/10"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 transition-colors group-hover:bg-emerald-500/20">
                    <PenLine className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="ivy-font font-semibold text-foreground">Fill Manually</p>
                    <p className="ivy-font mt-1 text-xs text-muted-foreground">
                      Fill in your details using the form
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-emerald-500" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    try { localStorage.setItem('selectedAvatar', JSON.stringify(selectedAvatar)); } catch {}
                    closeJourneyFlow();
                    setShowVoiceAgent(true);
                  }}
                  className="group flex flex-col items-center gap-4 rounded-xl border border-border/50 bg-muted/30 p-6 transition-all duration-200 hover:scale-105 hover:border-emerald-500/60 hover:bg-emerald-500/10"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 transition-colors group-hover:bg-emerald-500/20">
                    <Mic2 className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="ivy-font font-semibold text-foreground">Fill with Voice Agent</p>
                    <p className="ivy-font mt-1 text-xs text-muted-foreground">
                      Let our AI guide you by voice
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-emerald-500" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowFillMethod(false)}
                className="mt-6 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Back to avatar selection
              </button>
            </div>
          </div>
        )}

        {/* ── Voice Agent with side-by-side Checklist ── */}
        {showVoiceAgent && (
          <div className="fixed inset-0 z-50 flex bg-background">
            {/* Live checklist sidebar — left */}
            <div className="hidden w-72 border-r border-border/40 lg:flex">
              <LiveKYCChecklist active className="w-full rounded-none border-0" />
            </div>
            {/* Voice agent — takes most of the space */}
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setShowVoiceAgent(false)}
                className="absolute right-4 top-4 z-10 rounded-full border border-border/50 bg-card p-2 text-muted-foreground shadow-md transition-colors hover:text-foreground"
                aria-label="Close voice agent"
              >
                <X className="h-5 w-5" />
              </button>
              <ElevenLabsVoiceAgent
                mode="onboarding"
                onComplete={handleVoiceComplete}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
