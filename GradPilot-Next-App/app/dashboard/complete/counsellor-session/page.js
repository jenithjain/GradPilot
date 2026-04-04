"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const EMBED_SRC = "https://embed.liveavatar.com/v1/4d99945d-c582-48ca-b6b6-bfb5ea3657ae";
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

export default function CounsellorSessionPage() {
  const router = useRouter();
  const iframeRef = useRef(null);
  const flushTimerRef = useRef(null);
  const bufferRef = useRef([]);
  const sessionIdRef = useRef(null);

  const [status, setStatus] = useState("initializing");
  const [sessionId, setSessionId] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [transcriptEvents, setTranscriptEvents] = useState(0);

  const canEnd = useMemo(() => !!sessionId && status !== "ended", [sessionId, status]);

  const flushEvents = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || bufferRef.current.length === 0 || sending) return;

    const events = bufferRef.current.splice(0, bufferRef.current.length);
    setSending(true);
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
      // Push back to retry later
      bufferRef.current.unshift(...events);
    } finally {
      setSending(false);
    }
  }, [sending]);

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

  useEffect(() => {
    let cancelled = false;

    const startSession = async () => {
      try {
        setStatus("initializing");
        const res = await fetch("/api/counsellor-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "liveavatar", embedUrl: EMBED_SRC }),
        });

        if (!res.ok) {
          throw new Error(`Unable to create session (${res.status})`);
        }

        const data = await res.json();
        if (cancelled) return;

        sessionIdRef.current = data.sessionId;
        setSessionId(data.sessionId);
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

  useEffect(() => {
    if (!sessionId) return;

    const onMessage = (event) => {
      if (event.origin !== EMBED_ORIGIN) return;
      if (!iframeRef.current?.contentWindow) return;
      if (event.source !== iframeRef.current.contentWindow) return;

      bufferRef.current.push(buildEvent(event));
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
              <p className="ivy-font text-sm font-bold text-foreground">Live AI Counsellor Session</p>
              <p className="ivy-font text-xs text-muted-foreground">
                Session {sessionId ? `#${sessionId.slice(-8)}` : "starting..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {status === "live" ? "Live" : status === "ended" ? "Ended" : status === "error" ? "Error" : "Starting"}
            </span>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
              Events saved: {transcriptEvents}
            </span>
            <Button onClick={endSession} disabled={!canEnd} className="gap-1.5 bg-rose-500 hover:bg-rose-600 text-white">
              <Square className="h-3.5 w-3.5" /> End Session
            </Button>
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
          <CardContent className="p-0">
            {status === "initializing" ? (
              <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
                <p className="ivy-font text-sm text-muted-foreground">Preparing voice counsellor session...</p>
              </div>
            ) : (
              <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
                <iframe
                  ref={iframeRef}
                  src={EMBED_SRC}
                  allow="microphone"
                  title="LiveAvatar Embed"
                  className="h-full w-full border-0"
                  style={{ aspectRatio: "16/9" }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="rounded-2xl border border-border/50 bg-card/50 px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Mic className="h-3.5 w-3.5 text-cyan-500" />
            Conversation events are being captured and stored for counsellor review.
          </div>
        </div>
      </div>
    </div>
  );
}
