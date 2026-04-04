"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Target,
  Rocket,
  Sparkles,
  Mic2,
  PenLine,
  X,
  ChevronRight,
} from "lucide-react";

const AVATARS = [
  { id: 1, name: "Hulk", src: "/avatars/hulk.png", accent: "from-lime-400 to-emerald-500", desc: "Bold and unstoppable" },
  { id: 2, name: "Iron Man", src: "/avatars/ironman.png", accent: "from-amber-400 to-orange-500", desc: "Sharp and visionary" },
  { id: 3, name: "Thor", src: "/avatars/thor.png", accent: "from-sky-400 to-blue-500", desc: "Calm power and focus" },
  { id: 4, name: "Spider-Man", src: "/avatars/spiderman.png", accent: "from-blue-500 to-indigo-600", desc: "Fast, agile, and driven" },
];

export default function Dashboard() {
  const router = useRouter();
  const [showJourneyModal, setShowJourneyModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [showFillMethod, setShowFillMethod] = useState(false);

  const handleAvatarSelect = (avatar) => {
    setSelectedAvatar(avatar);
    setShowFillMethod(true);
  };

  const closeJourneyFlow = () => {
    setShowJourneyModal(false);
    setSelectedAvatar(null);
    setShowFillMethod(false);
  };

  return (
    <div className="min-h-screen w-full">
      <div className="container mx-auto max-w-7xl space-y-8 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="ivy-font mb-2 text-4xl font-bold text-foreground">
              Student Counselling & Lead Dashboard
            </h1>
            <p className="ivy-font text-muted-foreground">
              AI-powered student lead qualification and counselling analytics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="ivy-font px-3 py-1">
              November 2025
            </Badge>
            <Button className="ivy-font bg-emerald-500 text-white hover:bg-emerald-600">
              <Target className="mr-2 h-4 w-4" />
              Launch Follow-up
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center gap-6 py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/30">
              <Rocket className="h-9 w-9 text-white" />
            </div>
            <div className="space-y-2 text-center">
              <h2 className="ivy-font text-2xl font-bold text-foreground">Ready to begin?</h2>
              <p className="ivy-font max-w-sm text-muted-foreground">
                Set up your student profile so we can personalise your counselling journey.
              </p>
            </div>
            <Button
              onClick={() => setShowJourneyModal(true)}
              className="bg-linear-to-r from-emerald-500 to-teal-500 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:scale-105 hover:from-emerald-600 hover:to-teal-600"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Start Your Journey
            </Button>
          </CardContent>
        </Card>

        {showJourneyModal && !showFillMethod && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-6xl rounded-3xl border border-border/50 bg-card p-8 shadow-2xl sm:p-10">
              <button
                type="button"
                onClick={closeJourneyFlow}
                className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="mb-10 text-center">
                <h2 className="ivy-font text-3xl font-bold text-foreground sm:text-4xl">Choose Your Avatar</h2>
                <p className="ivy-font mt-1 text-sm text-muted-foreground">
                  Pick the persona that best describes you
                </p>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => handleAvatarSelect(avatar)}
                    className="group flex cursor-pointer flex-col items-center gap-5 rounded-2xl border border-border/50 bg-muted/30 p-6 transition-all duration-200 hover:scale-[1.03] hover:border-emerald-500/50 hover:bg-muted/60"
                  >
                    <div className={`flex h-56 w-full items-center justify-center rounded-2xl bg-linear-to-br ${avatar.accent} p-4 shadow-lg shadow-black/20 sm:h-64`}>
                      <Image
                        src={avatar.src}
                        alt={avatar.name}
                        width={240}
                        height={240}
                        className="h-full w-full object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
                      />
                    </div>
                    <div className="text-center">
                      <p className="ivy-font text-lg font-semibold text-foreground">{avatar.name}</p>
                      <p className="ivy-font text-sm text-muted-foreground">{avatar.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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
                    closeJourneyFlow();
                    router.push("/onboarding?mode=voice");
                  }}
                  className="group flex flex-col items-center gap-4 rounded-xl border border-border/50 bg-muted/30 p-6 transition-all duration-200 hover:scale-105 hover:border-violet-500/60 hover:bg-violet-500/10"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 transition-colors group-hover:bg-violet-500/20">
                    <Mic2 className="h-6 w-6 text-violet-500" />
                  </div>
                  <div className="text-center">
                    <p className="ivy-font font-semibold text-foreground">Fill with Voice Agent</p>
                    <p className="ivy-font mt-1 text-xs text-muted-foreground">
                      Let our AI guide you by voice
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-violet-500" />
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
      </div>
    </div>
  );
}
