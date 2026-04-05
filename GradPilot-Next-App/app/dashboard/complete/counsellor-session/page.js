"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Mic, Square, Pause, Play, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const EMBED_SRC = "https://embed.liveavatar.com/v1/d940c726-321d-45d7-9461-529dad277422";
const EMBED_ORIGIN = "https://embed.liveavatar.com";

function buildEvent(messageEvent) {
  const data = messageEvent.data;
  const eventType =
    (data && typeof data === "object" && (data.type || data.event || data.name)) ||
    "message";

  return {
    eventType,
    origin: messageEvent.origin || "",
    payload: data,
    timestamp: new Date().toISOString(),
  };
}

// Deep-extract any text from a LiveAvatar postMessage payload
function extractTextFromPayload(data) {
  if (!data) return null;
  if (typeof data === "string") return data.trim() || null;
  if (typeof data !== "object") return null;

  // Common LiveAvatar event fields
  const textFields = [
    "text", "message", "content", "transcript",
    "userText", "assistantText", "user_text", "assistant_text",
    "input", "output", "response", "query", "answer",
    "user_message", "bot_message", "agent_message",
  ];
  for (const field of textFields) {
    if (typeof data[field] === "string" && data[field].trim()) {
      return data[field].trim();
    }
  }

  // Nested event/data objects
  for (const nested of ["event", "data", "detail", "payload"]) {
    if (data[nested] && typeof data[nested] === "object") {
      const found = extractTextFromPayload(data[nested]);
      if (found) return found;
    }
  }

  return null;
}

export default function CounsellorSessionPage() {
  const router = useRouter();
  const iframeRef = useRef(null);
  const flushTimerRef = useRef(null);
  const bufferRef = useRef([]);
  const sessionIdRef = useRef(null);
  const contextSentRef = useRef(false);
  const flushLockRef = useRef(false);

  const [status, setStatus] = useState("initializing");
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState("");
  const [transcriptEvents, setTranscriptEvents] = useState(0);
  const [studentName, setStudentName] = useState("");
  const [contextLoaded, setContextLoaded] = useState(false);

  const canEnd = useMemo(() => !!sessionId && status !== "ended", [sessionId, status]);
  const canPause = useMemo(() => !!sessionId && status === "live", [sessionId, status]);
  const canResume = useMemo(() => !!sessionId && status === "paused", [sessionId, status]);

  const flushEvents = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || bufferRef.current.length === 0 || flushLockRef.current) return;

    flushLockRef.current = true;
    const events = bufferRef.current.splice(0, bufferRef.current.length);
    try {
      const res = await fetch(`/api/counsellor-sessions/${sid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });

      if (!res.ok) {
        throw new Error(`Failed to persist events (${res.status})`);
      }

      setTranscriptEvents((count) => count + events.length);
    } catch (err) {
      console.error("[counsellor-session] flush failed:", err);
      bufferRef.current.unshift(...events);
    } finally {
      flushLockRef.current = false;
    }
  }, []);

  const endSession = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    await flushEvents();

    try {
      await fetch(`/api/counsellor-sessions/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
    } catch (err) {
      console.error("[counsellor-session] end failed:", err);
    }

    setStatus("ended");
  }, [flushEvents]);

  const pauseSession = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    await flushEvents();

    try {
      await fetch(`/api/counsellor-sessions/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paused" }),
      });
    } catch (err) {
      console.error("[counsellor-session] pause failed:", err);
    }

    setStatus("paused");
  }, [flushEvents]);

  const resumeSession = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    try {
      await fetch(`/api/counsellor-sessions/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
    } catch (err) {
      console.error("[counsellor-session] resume failed:", err);
    }

    setStatus("live");
  }, []);

  useEffect(() => {
    let cancelled = false;

    const startSession = async () => {
      try {
        setStatus("initializing");

        // Fetch context and create session in parallel
        const [ctxRes, sessionRes] = await Promise.all([
          fetch("/api/counsellor-sessions/context").then((r) => r.ok ? r.json() : null).catch(() => null),
          fetch("/api/counsellor-sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "liveavatar", embedUrl: EMBED_SRC }),
          }),
        ]);

        if (!sessionRes.ok) {
          throw new Error(`Unable to create session (${sessionRes.status})`);
        }

        const data = await sessionRes.json();
        if (cancelled) return;

        sessionIdRef.current = data.sessionId;
        setSessionId(data.sessionId);

        if (ctxRes) {
          setStudentName(ctxRes.studentName || "");
          setContextLoaded(true);
          // Store context to inject once iframe loads
          contextSentRef.current = false;
          window.__counsellorContext = ctxRes.contextPrompt || "";
        }

        setStatus("live");
      } catch (err) {
        console.error("[counsellor-session] start failed:", err);
        if (!cancelled) {
          setError(err.message || "Failed to start session");
          setStatus("error");
        }
      }
    };

    startSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Inject context into LiveAvatar iframe once it loads
  useEffect(() => {
    if (status !== "live" || contextSentRef.current) return;

    const injectContext = () => {
      const iframe = iframeRef.current;
      const context = window.__counsellorContext;
      if (!iframe?.contentWindow || !context) return;

      iframe.contentWindow.postMessage(
        {
          type: "set_context",
          context: context,
        },
        EMBED_ORIGIN
      );
      contextSentRef.current = true;
    };

    // Try immediately, and also on iframe load
    const timer = setTimeout(injectContext, 1500);
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener("load", injectContext);
    }

    return () => {
      clearTimeout(timer);
      if (iframe) {
        iframe.removeEventListener("load", injectContext);
      }
    };
  }, [status]);

  useEffect(() => {
    if (!sessionId) return;

    const onMessage = (event) => {
      // Accept messages from the LiveAvatar iframe (any origin — some embeds use different domains)
      if (!iframeRef.current?.contentWindow) return;
      if (event.source !== iframeRef.current.contentWindow) return;

      const builtEvent = buildEvent(event);

      // Also try to extract readable text for direct transcript storage
      const extractedText = extractTextFromPayload(event.data);
      if (extractedText) {
        builtEvent.extractedText = extractedText;
      }

      bufferRef.current.push(builtEvent);
      if (bufferRef.current.length >= 4) {
        flushEvents();
      }
    };

    window.addEventListener("message", onMessage);
    flushTimerRef.current = window.setInterval(() => {
      flushEvents();
    }, 2500);

    return () => {
      window.removeEventListener("message", onMessage);
      if (flushTimerRef.current) {
        window.clearInterval(flushTimerRef.current);
      }
      flushEvents();
    };
  }, [sessionId, flushEvents]);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (!sessionIdRef.current) return;
      if (bufferRef.current.length === 0) return;

      const payload = JSON.stringify({ events: bufferRef.current });
      navigator.sendBeacon(`/api/counsellor-sessions/${sessionIdRef.current}`, payload);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="container mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/70 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/complete")}> 
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <p className="ivy-font text-sm font-bold text-foreground">
                {studentName ? `Counselling — ${studentName}` : "Live AI Counsellor Session"}
              </p>
              <p className="ivy-font text-xs text-muted-foreground">
                Session {sessionId ? `#${sessionId.slice(-8)}` : "starting..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${
              status === "live"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : status === "paused"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : status === "ended"
                ? "border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                : status === "error"
                ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                : "border-border bg-muted text-muted-foreground"
            }`}>
              {status === "live" ? "● Live" : status === "paused" ? "❚❚ Paused" : status === "ended" ? "Ended" : status === "error" ? "Error" : "Starting"}
            </span>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
              Events: {transcriptEvents}
            </span>
          </div>
        </div>

        {error ? (
          <Card className="border-rose-500/30 bg-rose-500/10">
            <CardContent className="p-6">
              <p className="ivy-font font-semibold text-rose-600 dark:text-rose-400">{error}</p>
            </CardContent>
          </Card>
        ) : null}

        <Card className="overflow-hidden border-border/40 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-0 relative">
            {status === "initializing" ? (
              <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
                <p className="ivy-font text-sm text-muted-foreground">Preparing voice counsellor session...</p>
              </div>
            ) : status === "ended" ? (
              <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
                <div className="rounded-full bg-zinc-100 dark:bg-zinc-800 p-6">
                  <PhoneOff className="h-10 w-10 text-zinc-400" />
                </div>
                <p className="ivy-font text-lg font-semibold text-foreground">Session Ended</p>
                <p className="ivy-font text-sm text-muted-foreground max-w-md text-center">
                  Your conversation has been saved. A summary and follow-up questions have been sent to your WhatsApp.
                </p>
                <Button onClick={() => router.push("/dashboard/complete")} className="mt-2 gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
                </Button>
              </div>
            ) : (
              <>
                <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
                  <iframe
                    ref={iframeRef}
                    src={EMBED_SRC}
                    allow="microphone"
                    title="LiveAvatar Embed"
                    className="h-full w-full border-0"
                    style={{ aspectRatio: "16/9" }}
                  />

                  {status === "paused" && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-3">
                        <Pause className="h-14 w-14 text-white/80" />
                        <p className="ivy-font text-lg font-semibold text-white">Session Paused</p>
                        <Button onClick={resumeSession} className="gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white">
                          <Play className="h-4 w-4" /> Resume Session
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Google Meet-style bottom control bar */}
                <div className="flex items-center justify-center gap-4 py-4 px-6 bg-zinc-900/95 dark:bg-zinc-950/95">
                  <Button
                    onClick={canPause ? pauseSession : resumeSession}
                    disabled={!canPause && !canResume}
                    className={`h-12 w-12 rounded-full p-0 ${
                      status === "paused"
                        ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                        : "bg-zinc-700 hover:bg-zinc-600 text-white"
                    }`}
                    title={status === "paused" ? "Resume Session" : "Pause Session"}
                  >
                    {status === "paused" ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                  </Button>

                  <Button
                    onClick={endSession}
                    disabled={!canEnd}
                    className="h-12 px-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white gap-2 text-sm font-semibold"
                    title="End Session"
                  >
                    <PhoneOff className="h-5 w-5" /> End Session
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {status !== "ended" && (
          <div className="rounded-2xl border border-border/50 bg-card/50 px-4 py-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mic className="h-3.5 w-3.5 text-cyan-500" />
              Conversation events are being captured and stored for counsellor review.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
