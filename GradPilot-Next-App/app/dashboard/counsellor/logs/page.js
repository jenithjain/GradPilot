"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CounsellorLogsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/counsellor-sessions?limit=50", { cache: "no-store" });
      const data = await res.json();
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      if (!selectedId && data.sessions?.length) {
        setSelectedId(data.sessions[0].id);
      }
    } catch (err) {
      console.error("[counsellor-logs] list failed:", err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadSession = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/counsellor-sessions/${id}`, { cache: "no-store" });
      const data = await res.json();
      setSelected(data.session || null);
    } catch (err) {
      console.error("[counsellor-logs] detail failed:", err);
      setSelected(null);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    loadSession(selectedId);
  }, [selectedId, loadSession]);

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="container mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-card/70 p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/complete")}> 
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <p className="ivy-font text-sm font-bold text-foreground">Counsellor Conversation Logs</p>
              <p className="ivy-font text-xs text-muted-foreground">Review stored communication to support counselling decisions.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadSessions} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="flex min-h-[240px] flex-col items-center justify-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-violet-500" />
              <p className="ivy-font text-sm text-muted-foreground">Loading session logs...</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1 border-border/50 bg-card/80">
              <CardContent className="space-y-2 p-3">
                {sessions.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No conversation logs yet.</p>
                ) : (
                  sessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selectedId === s.id
                          ? "border-violet-500/50 bg-violet-500/10"
                          : "border-border/50 bg-muted/20 hover:bg-muted/35"
                      }`}
                    >
                      <p className="text-sm font-semibold text-foreground">{s.title || `Session ${s.id.slice(-6)}`}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Status: {s.status} · Entries: {s.transcriptCount}</p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-border/50 bg-card/80">
              <CardContent className="p-4">
                {!selected ? (
                  <p className="text-sm text-muted-foreground">Select a session to view transcript.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-border/50 bg-muted/15 p-3">
                      <p className="text-sm font-semibold text-foreground">{selected.title || `Session ${selected.id.slice(-6)}`}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{selected.status} · Started {new Date(selected.startedAt).toLocaleString()}</p>
                    </div>

                    <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                      {(selected.transcript || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No transcript entries captured yet.</p>
                      ) : (
                        selected.transcript.map((entry, idx) => (
                          <div key={`${idx}-${entry.timestamp}`} className="rounded-lg border border-border/40 bg-muted/10 p-3">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{entry.role}</p>
                            <p className="mt-1 text-sm text-foreground">{entry.text}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ""}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
