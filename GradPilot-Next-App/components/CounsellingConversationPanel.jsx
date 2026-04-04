'use client';

import { Clock3, MessageSquareText, Mic, PhoneOff } from 'lucide-react';

function formatDuration(seconds = 0) {
  const totalSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatTimestamp(seconds = 0) {
  return formatDuration(seconds);
}

export default function CounsellingConversationPanel({ conversation, progress }) {
  const studentMessages = Array.isArray(conversation?.messages)
    ? conversation.messages.filter((message) => message.role === 'user' && message.message?.trim())
    : [];

  const lastUpdated = conversation?.createdAt
    ? new Date(conversation.createdAt).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const remainingCount = progress?.missingFields?.length || 0;
  const isComplete = !!progress?.isComplete;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-4xl border border-border/50 bg-linear-to-br from-card via-card to-emerald-500/6 p-6 shadow-[0_28px_90px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-7 lg:p-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)] lg:items-start">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MessageSquareText className="h-4 w-4 text-emerald-500" />
              Latest Counselling Log
            </div>
            <h2 className="ivy-font text-3xl font-bold leading-tight text-foreground sm:text-[2.1rem]">
              {isComplete ? 'Conversation completed' : 'Conversation can be resumed'}
            </h2>
            <p className="ivy-font max-w-3xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
              {conversation?.summary || 'The latest saved call summary will appear here once the agent has captured enough context.'}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-3xl border border-border/40 bg-background/78 px-4 py-4 shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                Last Saved
              </div>
              <p className="ivy-font mt-3 text-base font-semibold leading-6 text-foreground">
                {lastUpdated || 'Waiting for the first saved call'}
              </p>
            </div>

            <div className="rounded-3xl border border-border/40 bg-background/78 px-4 py-4 shadow-sm">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {isComplete ? <PhoneOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                Status
              </div>
              <p className="ivy-font mt-3 text-base font-semibold leading-6 text-foreground">
                {isComplete
                  ? 'All required counselling fields are covered.'
                  : `${remainingCount} field${remainingCount === 1 ? '' : 's'} still missing.`}
              </p>
              {conversation?.callDurationSecs ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Last call length: {formatDuration(conversation.callDurationSecs)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-4xl border border-border/50 bg-card/70 p-6 shadow-sm backdrop-blur-sm sm:p-7 lg:p-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="ivy-font text-xl font-bold text-foreground">What You Already Shared</h3>
            <p className="ivy-font mt-1 text-sm text-muted-foreground">
              Saved from the most recent ElevenLabs counselling conversation.
            </p>
          </div>
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">
            {studentMessages.length} statement{studentMessages.length === 1 ? '' : 's'}
          </span>
        </div>

        {studentMessages.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/50 bg-background/40 px-4 py-10 text-center text-sm text-muted-foreground">
            No saved student transcript lines yet. Start or resume the call and the dashboard will fill in automatically.
          </div>
        ) : (
          <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {studentMessages.map((message, index) => (
              <div
                key={`${message.timeInCallSecs}-${index}`}
                className="rounded-3xl border border-border/40 bg-background/70 px-4 py-3.5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-500">
                    Student
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatTimestamp(message.timeInCallSecs)}
                  </span>
                </div>
                <p className="ivy-font mt-2 text-sm leading-relaxed text-foreground">
                  {message.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}