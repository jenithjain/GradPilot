'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || 'agent_8401kncp2mpdexkt4cwhncy0szjf';

/**
 * mode:
 *   - "onboarding"  →  KYC collection flow. After the conversation ends the
 *                       transcript is sent to Gemini for structured extraction
 *                       and saved to the student's MongoDB profile automatically.
 *   - "buddy"       →  Persistent memory buddy that remembers everything.
 *
 * onComplete is called when the session finishes.
 */
export default function ElevenLabsVoiceAgent({ onComplete, mode = 'onboarding' }) {
  const widgetContainerRef = useRef(null);
  const conversationIdRef = useRef(null);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [disconnectReason, setDisconnectReason] = useState(''); // 'quota' | 'guardrail' | ''
  const [retryCount, setRetryCount] = useState(0);
  const memoryContextRef = useRef('');
  const studentNameRef = useRef('');
  const hasExtractedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const modeRef = useRef(mode);

  // Keep refs in sync without triggering effect re-runs
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Fetch persistent memory before mounting the widget
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/voice-agent/memory');
        if (res.ok) {
          const data = await res.json();
          memoryContextRef.current = data.context || '';
          studentNameRef.current = data.studentName || '';
        }
      } catch (err) {
        console.error('[ElevenLabs] Failed to load memory:', err);
      }
      if (!cancelled) setMemoryLoaded(true);
    })();

    return () => { cancelled = true; };
  }, []);

  // Mount the widget once memory is loaded (or on retry)
  useEffect(() => {
    if (!memoryLoaded) return;
    setDisconnected(false);

    let widget = null;
    let script = document.querySelector('script[data-elevenlabs-convai-widget]');
    let ownsScript = false;
    const timeoutIds = [];

    const fireExpandEvent = () => {
      document.dispatchEvent(
        new CustomEvent('elevenlabs-agent:expand', {
          detail: { action: 'expand' },
          bubbles: true,
          composed: true,
        })
      );
    };

    const scheduleAutoExpand = () => {
      timeoutIds.push(window.setTimeout(fireExpandEvent, 300));
      timeoutIds.push(window.setTimeout(fireExpandEvent, 800));
    };

    // ── Extract KYC from transcript via Gemini (onboarding mode) ──
    const extractAndSaveKyc = async () => {
      if (hasExtractedRef.current) return;
      hasExtractedRef.current = true;

      const cid = conversationIdRef.current;
      if (!cid) {
        console.warn('[ElevenLabs] No conversation ID — cannot extract KYC');
        return;
      }

      setExtracting(true);
      try {
        // First save the conversation to memory
        await fetch('/api/voice-agent/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: cid, mode: 'onboarding' }),
        });

        // Then extract structured KYC from the transcript via Gemini
        const res = await fetch('/api/voice-agent/extract-kyc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: cid }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Extraction failed');

        if (data.partial) {
          toast.success('Progress saved! Continue next time to complete your profile.');
        } else {
          toast.success('Profile extracted and saved!');
        }
        window.setTimeout(() => onCompleteRef.current?.(), 1500);
      } catch (err) {
        console.error('[ElevenLabs] KYC extraction error:', err);
        toast.error('Could not extract profile. You can fill manually.');
        window.setTimeout(() => onCompleteRef.current?.(), 2000);
      } finally {
        setExtracting(false);
      }
    };

    // ── Client tool: signal conversation complete (onboarding) ──
    const finishOnboarding = async () => {
      extractAndSaveKyc();
      return 'Thank you! I am now extracting your profile from our conversation. This will just take a moment.';
    };

    // ── Client tool: end buddy chat ──
    const endBuddyChat = async () => {
      await saveConversation('buddy');
      toast.success('Chat saved! See you next time 👋');
      window.setTimeout(() => onCompleteRef.current?.(), 1000);
      return 'Conversation saved. Say goodbye warmly.';
    };

    // ── Save conversation to MongoDB ──
    const saveConversation = async (convMode) => {
      const cid = conversationIdRef.current;
      try {
        if (cid) {
          await fetch('/api/voice-agent/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: cid, mode: convMode }),
          });
        } else {
          await fetch('/api/voice-agent/conversations/sync-latest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: convMode }),
          });
        }
      } catch (err) {
        console.error('[ElevenLabs] Failed to save conversation:', err);
      }
    };

    // ── Handle call event: inject memory + tools ──
    const handleCall = (event) => {
      const config = event.detail.config;

      if (modeRef.current === 'onboarding') {
        config.clientTools = { saveStudentProfile: finishOnboarding };
      } else {
        config.clientTools = { endConversation: endBuddyChat };
      }

      // Inject persistent memory via dynamic variables
      const memoryCtx = memoryContextRef.current;
      const studentName = studentNameRef.current;

      if (memoryCtx || studentName) {
        config.dynamicVariables = {
          ...(config.dynamicVariables || {}),
          student_name: studentName,
          student_memory: memoryCtx,
        };
      }
    };

    // ── Handle conversation ID from metadata ──
    const handleMessage = (event) => {
      if (event.detail?.conversationId) {
        conversationIdRef.current = event.detail.conversationId;
      }
    };

    // ── Handle disconnect (guardrail, quota, network error, user ended call) ──
    const handleDisconnect = (event) => {
      const cid = conversationIdRef.current;

      // Classify the error type from ElevenLabs event detail
      const detail = event?.detail || {};
      const reason = (detail.reason || detail.message || '').toLowerCase();
      const isQuota = /quota|limit|exceed|credit|billing/i.test(reason);
      const isGuardrail = /guardrail/i.test(reason);

      if (isQuota) {
        // Quota errors can't be retried — no point saving/extracting
        setDisconnectReason('quota');
        setDisconnected(true);
        return;
      }

      if (!cid) {
        setDisconnectReason('');
        setDisconnected(true);
        return;
      }

      // Always save the conversation first
      saveConversation(modeRef.current === 'onboarding' ? 'onboarding' : 'buddy');

      // For onboarding: attempt to extract whatever was collected
      if (modeRef.current === 'onboarding' && !hasExtractedRef.current) {
        window.setTimeout(() => extractAndSaveKyc(), 1500);
      }

      if (isGuardrail) {
        toast.error('The conversation was interrupted. Your progress has been saved — you can continue.', { duration: 5000 });
      }

      // Show the disconnected UI with retry option
      hasExtractedRef.current = false; // allow re-extraction on retry
      conversationIdRef.current = null;
      setDisconnectReason(isGuardrail ? 'guardrail' : '');
      setDisconnected(true);
    };

    widget = document.createElement('elevenlabs-convai');
    widget.setAttribute('agent-id', AGENT_ID);
    widget.setAttribute('default-expanded', 'true');
    widget.setAttribute('always-expanded', 'true');
    widget.addEventListener('elevenlabs-convai:call', handleCall);
    widget.addEventListener('elevenlabs-convai:conversation', handleMessage);
    widget.addEventListener('elevenlabs-convai:error', handleDisconnect);

    if (widgetContainerRef.current) {
      widgetContainerRef.current.appendChild(widget);
    }

    if (!script) {
      script = document.createElement('script');
      script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
      script.async = true;
      script.type = 'text/javascript';
      script.dataset.elevenlabsConvaiWidget = 'true';
      document.body.appendChild(script);
      ownsScript = true;
    }

    scheduleAutoExpand();

    // When conversation ends (user navigates away), save it
    const handleBeforeUnload = () => {
      const cid = conversationIdRef.current;
      const endpoint = cid
        ? '/api/voice-agent/conversations'
        : '/api/voice-agent/conversations/sync-latest';
      const payload = cid
        ? JSON.stringify({ conversationId: cid, mode: modeRef.current })
        : JSON.stringify({ mode: modeRef.current });
      navigator.sendBeacon(endpoint, payload);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      timeoutIds.forEach((id) => window.clearTimeout(id));

      // On unmount: save conversation, and extract KYC if onboarding
      if (conversationIdRef.current) {
        if (modeRef.current === 'onboarding') {
          extractAndSaveKyc();
        } else {
          saveConversation(modeRef.current);
        }
      }

      if (widget) {
        widget.removeEventListener('elevenlabs-convai:call', handleCall);
        widget.removeEventListener('elevenlabs-convai:conversation', handleMessage);
        widget.removeEventListener('elevenlabs-convai:error', handleDisconnect);
        widget.remove();
      }

      if (ownsScript && script) {
        script.remove();
      }
    };
  }, [memoryLoaded, retryCount]);

  // ── Disconnected UI ──
  if (disconnected) {
    const isQuotaError = disconnectReason === 'quota';
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
          <div className={`h-14 w-14 rounded-full flex items-center justify-center ${isQuotaError ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 ${isQuotaError ? 'text-red-500' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
            </svg>
          </div>
          <p className="ivy-font text-base font-semibold text-foreground">
            {isQuotaError ? 'Voice quota exceeded' : 'Conversation interrupted'}
          </p>
          <p className="ivy-font text-sm text-muted-foreground">
            {isQuotaError
              ? 'Your ElevenLabs account has reached its conversation limit. Please upgrade your plan at elevenlabs.io or try again later.'
              : 'Don\'t worry — your progress has been saved. You can pick up right where you left off.'}
          </p>
          <div className="flex gap-3 mt-2">
            {!isQuotaError && (
              <button
                onClick={() => setRetryCount((c) => c + 1)}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                Continue Conversation
              </button>
            )}
            {isQuotaError && (
              <a
                href="https://elevenlabs.io/subscription"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                Upgrade Plan
              </a>
            )}
            <button
              onClick={() => onCompleteRef.current?.()}
              className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (extracting) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
          <p className="ivy-font text-base font-medium text-foreground">
            Extracting your profile from the conversation...
          </p>
          <p className="ivy-font text-sm text-muted-foreground">
            This takes a few seconds
          </p>
        </div>
      </div>
    );
  }

  if (!memoryLoaded) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="ivy-font text-sm text-muted-foreground">Preparing your session...</p>
        </div>
      </div>
    );
  }

  return <div ref={widgetContainerRef} className="h-full w-full" />;
}
