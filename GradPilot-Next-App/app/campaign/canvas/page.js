'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/navigation';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  applyNodeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Play,
  RotateCcw,
  Download,
  Sparkles,
  X,
  Settings2,
  Home,
  UploadCloud,
  ZoomIn,
  Globe,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
// Removed ScrollArea (using native overflow containers for side panels)
import AgentNode from '@/components/campaign/AgentNode';
import SmartEdge from '@/components/campaign/SmartEdge';
import { useCampaignStore } from '@/lib/store';
import { getExecutionOrder, canExecuteNode } from '@/lib/execution-engine';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea as ModalScrollArea } from '@/components/ui/scroll-area';

const nodeTypes = {
  agentNode: AgentNode,
};

const edgeTypes = {
  smartEdge: SmartEdge,
};

const nodeTypeLabels = {
  strategy: 'Strategy Module',
  copy: 'Copy Module',
  image: 'Image Module',
  video: 'Video Module',
  research: 'Research Module',
  exa_research: 'Web Research Module',
  timeline: 'Timeline Module',
  distribution: 'Distribution Module',
  linkedin: 'LinkedIn Module',
  twitter: 'Twitter Module',
  email: 'Email Module',
};

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function htmlToPlainText(value) {
  const input = String(value || '');
  if (!input.includes('<')) return input;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return input.replace(/<[^>]+>/g, ' ');
  }

  const withBreaks = input
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|h1|h2|h3|h4|h5|h6|ul|ol)\s*>/gi, '\n');

  const container = document.createElement('div');
  container.innerHTML = withBreaks;
  return container.textContent || container.innerText || '';
}

function cleanForPdf(value, { preserveLines = true } = {}) {
  const text = String(value || '')
    .replace(/\r/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/×/g, 'x')
    .replace(/[•]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ');

  if (!preserveLines) {
    return text
      .replace(/\b(?:[A-Za-z]\s){2,}[A-Za-z]\b/g, (m) => m.replace(/\s/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
  }

  return text
    .split('\n')
    .map((line) => line
      .replace(/\b(?:[A-Za-z]\s){2,}[A-Za-z]\b/g, (m) => m.replace(/\s/g, ''))
      .replace(/\s+/g, ' ')
      .trim()
    )
    .filter((line, idx, arr) => line || (idx > 0 && arr[idx - 1]))
    .join('\n')
    .trim();
}

function normalizeOutputText(value) {
  return cleanForPdf(value, { preserveLines: true });
}

function markdownToReadableText(value) {
  return cleanForPdf(
    htmlToPlainText(String(value || ''))
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/^\s{0,3}#{1,6}\s*/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*```[\s\S]*?```\s*$/gm, '')
      .replace(/\|\s*:?-{2,}:?\s*/g, ' ')
      .replace(/^\s*[-]{2,}\s*$/gm, ''),
    { preserveLines: true }
  );
}

function toReadableLines(text, { maxLines = 12, maxLineLength = 180 } = {}) {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('|'))
    .filter((line) => !line.startsWith('```'))
    .filter((line) => !/^[-_]{3,}$/.test(line))
    .map((line) => line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter((line) => line.length > 2);

  const deduped = [];
  const seen = new Set();
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(line.length > maxLineLength ? `${line.slice(0, maxLineLength - 3)}...` : line);
    if (deduped.length >= maxLines) break;
  }
  return deduped;
}

function summarizeStrategy(strategyText) {
  const lines = toReadableLines(markdownToReadableText(strategyText), { maxLines: 10, maxLineLength: 170 });
  if (!lines.length) return ['No strategy narrative available.'];
  return lines;
}

function summarizeGenericModuleOutput(raw, { maxLines = 10 } = {}) {
  const readable = markdownToReadableText(raw);
  const lines = toReadableLines(readable, { maxLines, maxLineLength: 170 });
  return lines.length ? lines : ['No clear business summary available for this module output.'];
}

function humanizeFieldKey(key) {
  return String(key || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function summarizeVoiceCounselling(voiceData) {
  const studentProfile = voiceData?.studentProfile || {};
  const counsellingProgress = voiceData?.counsellingProgress || {};
  const latestConversation = voiceData?.latestConversation || null;

  const profileEntries = Object.entries(studentProfile || {}).filter(([key, value]) => {
    if (key === 'submittedAt' || key === 'submittedVia') return false;
    if (value === null || value === undefined) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'string' && !value.trim()) return false;
    return true;
  });

  const profileHighlights = profileEntries.slice(0, 10).map(([key, value]) => {
    const rendered = Array.isArray(value) ? value.join(', ') : String(value);
    return `${humanizeFieldKey(key)}: ${cleanForPdf(rendered, { preserveLines: false })}`;
  });

  const voiceLines = [];
  voiceLines.push(`Profile fields captured by voice counselling: ${typeof counsellingProgress?.filledCount === 'number' ? counsellingProgress.filledCount : profileEntries.length}`);
  if (typeof counsellingProgress?.totalCount === 'number') {
    voiceLines.push(`Profile completion status: ${counsellingProgress.filledCount}/${counsellingProgress.totalCount}`);
  }
  if (Array.isArray(counsellingProgress?.missingLabels) && counsellingProgress.missingLabels.length > 0) {
    voiceLines.push(`Missing details to complete profile: ${counsellingProgress.missingLabels.slice(0, 6).join(', ')}`);
  }
  if (latestConversation?.summary) {
    voiceLines.push(`Latest voice call summary: ${cleanForPdf(latestConversation.summary, { preserveLines: false }).slice(0, 240)}`);
  }
  if (latestConversation?.callDurationSecs) {
    const minutes = Math.max(1, Math.round(Number(latestConversation.callDurationSecs) / 60));
    voiceLines.push(`Latest voice call duration: ~${minutes} minute(s)`);
  }

  return {
    profileHighlights,
    voiceLines,
  };
}

function dedupeContactsByEmail(items = []) {
  const map = new Map();
  items.forEach((item) => {
    const email = normalizeText(item?.email).toLowerCase();
    if (!email || !email.includes('@')) return;
    if (!map.has(email)) {
      map.set(email, {
        name: normalizeText(item?.name) || 'Lead',
        email,
        score: typeof item?.score === 'number' ? item.score : undefined,
      });
    }
  });
  return Array.from(map.values());
}

function safeModuleName(node) {
  return normalizeText(node?.data?.label || nodeTypeLabels[node?.data?.type] || node?.id || 'Module')
    .replace(/\bagent\b/gi, 'Module');
}

function isLikelyBusinessContact(contact) {
  const email = normalizeText(contact?.email).toLowerCase();
  const name = normalizeText(contact?.name).toLowerCase();
  if (!email.includes('@')) return false;

  const domain = email.split('@')[1] || '';
  const personalProviders = new Set([
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'icloud.com',
    'protonmail.com',
    'aol.com',
    'live.com',
  ]);

  if (personalProviders.has(domain)) {
    return /consult|admission|overseas|study abroad|education|counsell|mentor/i.test(name);
  }

  return /admit|consult|education|overseas|visa|university|college|fateh|edulytic|uni/i.test(domain + ' ' + name);
}

function extractNodeOutputForBusinessReport(node) {
  const raw = String(node?.data?.output || '').trim();
  if (!raw) return 'No output available.';

  if (node?.data?.type === 'image') {
    try {
      const parsed = JSON.parse(raw);
      const images = Array.isArray(parsed?.images) ? parsed.images : [];
      if (images.length > 0) {
        const lines = [`Generated visual creatives: ${images.length}`];
        images.forEach((img, idx) => {
          const theme = cleanForPdf(img?.theme || `Creative ${idx + 1}`, { preserveLines: false });
          const url = cleanForPdf(img?.url || '', { preserveLines: false });
          lines.push(`${idx + 1}. ${theme}`);
          if (url) lines.push(`   URL: ${url}`);
        });
        return lines.join('\n');
      }
    } catch {}
  }

  if (node?.data?.type === 'video') {
    try {
      const parsed = JSON.parse(raw);
      const prompts = Array.isArray(parsed?.visualPrompts) ? parsed.visualPrompts : [];
      if (prompts.length > 0) {
        const lines = [`Generated video concept scenes: ${prompts.length}`];
        prompts.forEach((scene, idx) => {
          lines.push(`${idx + 1}. ${cleanForPdf(scene?.sceneName || `Scene ${idx + 1}`, { preserveLines: false })}`);
          if (scene?.mood) lines.push(`   Mood: ${cleanForPdf(scene.mood, { preserveLines: false })}`);
          if (scene?.onScreenText) lines.push(`   On-screen text: ${cleanForPdf(scene.onScreenText, { preserveLines: false })}`);
        });
        return lines.join('\n');
      }
    } catch {}
  }

  if (node?.data?.type === 'copy') {
    const readable = markdownToReadableText(raw);
    const subjects = Array.from(readable.matchAll(/Subject:\s*([^\n]+)/gi)).map((m) => cleanForPdf(m[1], { preserveLines: false }));
    const ctas = Array.from(readable.matchAll(/\b(Book Free Counselling|Check Your Eligibility|Talk to an Expert)\b/gi)).map((m) => m[1]);
    const uniqueCtas = Array.from(new Set(ctas.map((v) => v.trim())));

    const lines = [];
    lines.push('Prepared 4-week nurture communication pack with email, social, and ad messaging.');
    if (subjects.length > 0) {
      lines.push(`Email subjects prepared: ${Math.min(subjects.length, 4)} highlighted below.`);
      subjects.slice(0, 4).forEach((s, idx) => lines.push(`${idx + 1}. ${s}`));
    }
    if (uniqueCtas.length > 0) {
      lines.push(`Primary calls-to-action: ${uniqueCtas.join(', ')}`);
    }
    return lines.join('\n');
  }

  if (node?.data?.type === 'timeline') {
    const readable = markdownToReadableText(raw);
    const weekMatches = Array.from(readable.matchAll(/Week\s*([1-4])\s*[:\-]?\s*([^\n]+)/gi));
    const lines = [];
    lines.push('Generated phased campaign timeline with weekly execution rhythm.');
    if (weekMatches.length > 0) {
      weekMatches.slice(0, 4).forEach((m) => {
        lines.push(`Week ${m[1]} focus: ${cleanForPdf(m[2], { preserveLines: false })}`);
      });
    } else {
      lines.push(...summarizeGenericModuleOutput(readable, { maxLines: 6 }));
    }
    return lines.join('\n');
  }

  if (node?.data?.type === 'exa_research') {
    const metadata = node?.data?.metadata || {};
    const studentLeads = typeof metadata.studentLeads === 'number' ? metadata.studentLeads : null;
    const emailable = typeof metadata.emailableLeads === 'number' ? metadata.emailableLeads : null;
    const sendable = typeof metadata.emailableSendableLeads === 'number' ? metadata.emailableSendableLeads : null;
    const lines = ['Research and lead discovery completed with categorized lead scoring.'];
    if (studentLeads !== null) lines.push(`Student leads identified: ${studentLeads}`);
    if (emailable !== null) lines.push(`Leads with email found: ${emailable}`);
    if (sendable !== null) lines.push(`Sendable leads (non-competitor/community): ${sendable}`);
    if (lines.length > 1) return lines.join('\n');
  }

  if (node?.data?.type === 'email') {
    const metadata = node?.data?.metadata || {};
    const subject = cleanForPdf(metadata.subject || '', { preserveLines: false });
    const sent = metadata?.sendStats?.sent;
    const total = metadata?.sendStats?.total;
    const sequenceLen = metadata.sequenceLength || metadata.sequenceCount;
    const lines = ['Email outreach execution completed with tracked delivery metrics.'];
    if (subject) lines.push(`Subject used: ${subject}`);
    if (typeof sent === 'number' && typeof total === 'number') lines.push(`Delivered: ${sent} of ${total}`);
    if (typeof sequenceLen === 'number') lines.push(`Sequence steps: ${sequenceLen}`);
    return lines.join('\n');
  }

  return summarizeGenericModuleOutput(raw, { maxLines: 8 }).join('\n');
}

function collectBusinessData(nodes = []) {
  const webNodes = nodes.filter((n) => n?.data?.type === 'exa_research');
  const emailNodes = nodes.filter((n) => n?.data?.type === 'email');
  const socialNodes = nodes.filter((n) => n?.data?.type === 'linkedin' || n?.data?.type === 'twitter');
  const completedOutputs = nodes.filter((n) => normalizeText(n?.data?.output));

  const studentLeads = dedupeContactsByEmail(
    webNodes.flatMap((n) => Array.isArray(n?.data?.metadata?.studentLeadsWithEmail) ? n.data.metadata.studentLeadsWithEmail : [])
  );

  const allLeads = dedupeContactsByEmail(
    webNodes.flatMap((n) => {
      const sourceA = Array.isArray(n?.data?.metadata?.allLeadsWithEmail) ? n.data.metadata.allLeadsWithEmail : [];
      const sourceB = Array.isArray(n?.data?.metadata?.leadsWithEmail) ? n.data.metadata.leadsWithEmail : [];
      return [...sourceA, ...sourceB];
    })
  );

  const sendStats = emailNodes.reduce(
    (acc, node) => {
      const stats = node?.data?.metadata?.sendStats || {};
      const sent = typeof stats.sent === 'number' ? stats.sent : 0;
      const total = typeof stats.total === 'number' ? stats.total : 0;
      const recipients = typeof node?.data?.metadata?.recipientDiscovery?.finalRecipients === 'number'
        ? node.data.metadata.recipientDiscovery.finalRecipients
        : 0;
      const sequenceLength = typeof node?.data?.metadata?.sequenceLength === 'number'
        ? node.data.metadata.sequenceLength
        : (typeof node?.data?.metadata?.sequenceCount === 'number' ? node.data.metadata.sequenceCount : 0);
      acc.sent += sent;
      acc.total += total;
      acc.recipients = Math.max(acc.recipients, recipients);
      acc.sequenceLength = Math.max(acc.sequenceLength, sequenceLength);
      return acc;
    },
    { sent: 0, total: 0, recipients: 0, sequenceLength: 0 }
  );

  const imageCount = nodes.reduce((acc, node) => {
    if (node?.data?.type !== 'image') return acc;
    try {
      const parsed = JSON.parse(node?.data?.output || '{}');
      return acc + (Array.isArray(parsed?.images) ? parsed.images.length : 0);
    } catch {
      return acc;
    }
  }, 0);

  const videoCount = nodes.reduce((acc, node) => {
    if (node?.data?.type !== 'video') return acc;
    const generatedVideos = node?.data?.generatedVideos;
    if (generatedVideos && typeof generatedVideos === 'object') {
      return acc + Object.keys(generatedVideos).length;
    }
    return acc;
  }, 0);

  const socialCount = socialNodes.filter((n) => normalizeText(n?.data?.output)).length;

  const directTargets = dedupeContactsByEmail(
    allLeads.filter((lead) => !isLikelyBusinessContact(lead))
  );

  const businessContacts = dedupeContactsByEmail(
    allLeads.filter((lead) => isLikelyBusinessContact(lead))
  );

  const counsellorTargets = studentLeads.length > 0 ? studentLeads : directTargets;

  return {
    studentLeads,
    allLeads,
    directTargets,
    businessContacts,
    counsellorTargets,
    sendStats,
    imageCount,
    videoCount,
    socialCount,
    completedOutputs,
  };
}

function renderPdfLine(doc, state, text, options = {}) {
  const {
    size = 11,
    style = 'normal',
    color = [17, 24, 39],
    indent = 0,
    gap = 4,
  } = options;

  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2 - indent;

  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);

  const lines = doc.splitTextToSize(String(text || ''), Math.max(40, maxWidth));
  const lineHeight = size * 1.35;

  lines.forEach((line) => {
    if (state.y + lineHeight > pageHeight - margin) {
      doc.addPage();
      state.y = margin;
    }
    doc.text(line, margin + indent, state.y);
    state.y += lineHeight;
  });

  state.y += gap;
}

async function generateBusinessPdf({ brief, strategy, nodes, voiceData = null }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const state = { y: 48 };
  const data = collectBusinessData(nodes);
  const now = new Date();
  const totalReachable = data.counsellorTargets.length;
  const studentReachable = data.studentLeads.length;
  const strategyText = cleanForPdf(htmlToPlainText(strategy?.rationale || ''), { preserveLines: true }) || 'No strategy narrative available.';
  const briefText = cleanForPdf(brief || '', { preserveLines: true }) || 'No campaign brief available.';
  const voiceSummary = summarizeVoiceCounselling(voiceData);

  renderPdfLine(doc, state, 'Campaign Business Report', { size: 20, style: 'bold', color: [5, 150, 105], gap: 8 });
  renderPdfLine(doc, state, `Generated: ${now.toLocaleString()}`, { size: 10, color: [75, 85, 99], gap: 14 });

  renderPdfLine(doc, state, '1) Executive Summary', { size: 14, style: 'bold', color: [17, 24, 39], gap: 6 });
  renderPdfLine(doc, state, `- Total campaign modules with output: ${data.completedOutputs.length}`);
  renderPdfLine(doc, state, `- Counsellor-ready contacts (email): ${totalReachable}`);
  renderPdfLine(doc, state, `- Student-only contacts (email): ${studentReachable}`);
  renderPdfLine(doc, state, `- Total contactable leads found: ${Math.max(data.allLeads.length, totalReachable)}`);
  renderPdfLine(doc, state, `- Business/partner-like contacts separated out: ${data.businessContacts.length}`);
  renderPdfLine(doc, state, `- Personalized email sequence steps prepared: ${data.sendStats.sequenceLength || 0}`);
  renderPdfLine(doc, state, `- Email messages delivered: ${data.sendStats.sent}`);
  renderPdfLine(doc, state, `- Social post drafts ready: ${data.socialCount}`);
  renderPdfLine(doc, state, `- Creative assets ready (images/videos): ${data.imageCount}/${data.videoCount}`, { gap: 10 });

  renderPdfLine(doc, state, '2) Business Opportunity View', { size: 14, style: 'bold', color: [17, 24, 39], gap: 6 });
  renderPdfLine(doc, state, 'This campaign creates a counsellor outreach funnel from discovered leads to personalized follow-up and booking conversion.');
  renderPdfLine(doc, state, 'Revenue planning formula (use your own numbers):');
  renderPdfLine(doc, state, 'Potential Counselling Revenue = Counsellor-ready contacts x Expected conversion rate x Average counselling value', { style: 'bold', indent: 10 });
  renderPdfLine(doc, state, `Current counsellor-ready contacts from this run: ${totalReachable}`, { indent: 10, gap: 2 });
  renderPdfLine(doc, state, `Current student-only contacts from this run: ${studentReachable}`, { indent: 10, gap: 10 });

  renderPdfLine(doc, state, '3) Counsellor Action Plan (Next 7 Days)', { size: 14, style: 'bold', color: [17, 24, 39], gap: 6 });
  renderPdfLine(doc, state, '- Day 1-2: Prioritize direct contacts for first personalized outreach call or WhatsApp introduction.', { indent: 6, gap: 2 });
  renderPdfLine(doc, state, '- Day 3-4: Offer IELTS-focused value content and invite to a counselling slot.', { indent: 6, gap: 2 });
  renderPdfLine(doc, state, '- Day 5-6: Follow up non-responders with concise benefit-led message and booking link.', { indent: 6, gap: 2 });
  renderPdfLine(doc, state, '- Day 7: Review responses and move high-intent contacts into admissions counselling workflow.', { indent: 6, gap: 10 });

  renderPdfLine(doc, state, '4) Counsellor Target List (Priority)', { size: 14, style: 'bold', color: [17, 24, 39], gap: 6 });
  if (data.counsellorTargets.length === 0) {
    renderPdfLine(doc, state, 'No direct counsellor target list is available yet from this run.', { color: [107, 114, 128], gap: 2 });
    renderPdfLine(doc, state, 'Recommendation: run one more web research cycle focused on student emails and form-capture channels.', { color: [107, 114, 128], gap: 10 });
  } else {
    const prioritized = [...data.counsellorTargets]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 25);
    prioritized.forEach((lead, idx) => {
      const scoreText = typeof lead.score === 'number' ? ` | Priority Score: ${lead.score}` : '';
      renderPdfLine(doc, state, `${idx + 1}. ${lead.name} | ${lead.email}${scoreText}`, { indent: 8, gap: 2 });
    });
    state.y += 6;
  }

  if (data.businessContacts.length > 0) {
    renderPdfLine(doc, state, 'Separated Business/Partner Contacts (Do Not Use For Student Counselling Outreach)', { size: 12, style: 'bold', color: [180, 83, 9], gap: 4 });
    data.businessContacts.slice(0, 20).forEach((lead, idx) => {
      renderPdfLine(doc, state, `${idx + 1}. ${lead.name} | ${lead.email}`, { indent: 8, color: [180, 83, 9], gap: 2 });
    });
    state.y += 6;
  }

  renderPdfLine(doc, state, '5) Campaign Brief (Business Context)', { size: 14, style: 'bold', color: [17, 24, 39], gap: 6 });
  toReadableLines(briefText, { maxLines: 4, maxLineLength: 180 }).forEach((line) => {
    renderPdfLine(doc, state, `- ${line}`, { indent: 6, gap: 2 });
  });
  state.y += 8;

  renderPdfLine(doc, state, '6) Strategy Narrative (Business Language)', { size: 14, style: 'bold', color: [17, 24, 39], gap: 6 });
  summarizeStrategy(strategyText).forEach((line) => {
    renderPdfLine(doc, state, `- ${line}`, { indent: 6, gap: 2 });
  });
  state.y += 8;

  renderPdfLine(doc, state, '7) Voice Counselling Insights (ElevenLabs)', { size: 14, style: 'bold', color: [17, 24, 39], gap: 6 });
  if (!voiceData || (voiceSummary.profileHighlights.length === 0 && voiceSummary.voiceLines.length === 0)) {
    renderPdfLine(doc, state, '- No ElevenLabs voice counselling data found for this user yet.', { indent: 6, gap: 2 });
    renderPdfLine(doc, state, '- Recommendation: run one voice counselling call to capture richer student profile and intent signals.', { indent: 6, gap: 8 });
  } else {
    voiceSummary.voiceLines.forEach((line) => {
      renderPdfLine(doc, state, `- ${line}`, { indent: 6, gap: 2 });
    });
    if (voiceSummary.profileHighlights.length > 0) {
      renderPdfLine(doc, state, 'Top profile details captured:', { indent: 6, style: 'bold', size: 11, gap: 2 });
      voiceSummary.profileHighlights.forEach((line) => {
        renderPdfLine(doc, state, `- ${line}`, { indent: 12, gap: 2 });
      });
    }
    state.y += 6;
  }

  renderPdfLine(doc, state, '8) Module Deliverables (Readable Highlights)', { size: 14, style: 'bold', color: [17, 24, 39], gap: 6 });
  if (data.completedOutputs.length === 0) {
    renderPdfLine(doc, state, 'No generated outputs were found to include.', { color: [107, 114, 128], gap: 10 });
  } else {
    data.completedOutputs.forEach((node, idx) => {
      const title = safeModuleName(node);
      renderPdfLine(doc, state, `${idx + 1}. ${title}`, { size: 12, style: 'bold', color: [5, 150, 105], gap: 4 });
      const summaryLines = extractNodeOutputForBusinessReport(node)
        .split('\n')
        .map((line) => cleanForPdf(line, { preserveLines: false }))
        .filter(Boolean)
        .slice(0, 12);
      summaryLines.forEach((line) => {
        renderPdfLine(doc, state, `- ${line}`, { indent: 8, gap: 2 });
      });
      state.y += 6;
    });
  }

  return doc;
}

export default function CampaignCanvasPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editingPrompt, setEditingPrompt] = useState('');
  const [editingNodeOutput, setEditingNodeOutput] = useState('');
  const [editingNodeLabel, setEditingNodeLabel] = useState('');
  const [editingNodePurpose, setEditingNodePurpose] = useState('');
  const [editingNodeType, setEditingNodeType] = useState(null); // Track node type for filter UI
  const [editingNodeFilters, setEditingNodeFilters] = useState({ // Web Research filters
    studentLeads: true,
    linkedInProfiles: true,
    communities: true,
    competitors: true,
    redditUsers: true,
  });
  const [isModulesOpen, setIsModulesOpen] = useState(false);
  const [executingNodeId, setExecutingNodeId] = useState(null);
  const [modalLightboxImage, setModalLightboxImage] = useState(null);
  // Workflow persistence state
  const [workflowsModalOpen, setWorkflowsModalOpen] = useState(false);
  const [savedWorkflows, setSavedWorkflows] = useState([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [kycProfile, setKycProfile] = useState(null);
  const [kycSnapshot, setKycSnapshot] = useState(null);
  const [activeWorkflowRunId, setActiveWorkflowRunId] = useState(null);

  const {
    nodes: storeNodes,
    edges: storeEdges,
    brief,
    strategy,
    setWorkflow,
    updateNodePrompt,
    updateNodeStatus,
    updateNodeData,
  } = useCampaignStore();

  const [nodes, setNodes, rawOnNodesChange] = useNodesState(storeNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);

  // Sync store changes to local state
  useEffect(() => {
    // inject openSettings handler into node data
    const enhanced = storeNodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        openSettings: () => {
          setEditingNodeId(n.id);
          setEditingPrompt(n.data.promptContext || '');
          setEditingNodeOutput(n.data.output || '');
          setEditingNodeLabel(n.data.label || 'Agent Configuration');
          setEditingNodePurpose(
            n.data.description || n.data.promptContext || 'Configure prompts and view this agent\'s output.'
          );
          setEditingNodeType(n.data.type || null);
          // Load existing filters or use defaults
          setEditingNodeFilters(n.data.filters || {
            studentLeads: true,
            linkedInProfiles: true,
            communities: true,
            competitors: true,
            redditUsers: true,
          });
          setPromptModalOpen(true);
        },
        isExecuting: n.id === executingNodeId
      }
    }));
    setNodes(enhanced);
  }, [storeNodes, setNodes, executingNodeId]);

  // Sync edges with execution animation
  React.useEffect(() => {
    if (!executingNodeId) {
      setEdges(storeEdges.map(e => ({ ...e, animated: false, style: { ...e.style, stroke: undefined } })));
      return;
    }
    // Highlight edges connected to executing node
    const enhanced = storeEdges.map(edge => {
      const isActive = edge.source === executingNodeId || edge.target === executingNodeId;
      return {
        ...edge,
        animated: isActive,
        style: isActive ? { stroke: '#10b981', strokeWidth: 2.5 } : edge.style
      };
    });
    setEdges(enhanced);
  }, [storeEdges, setEdges, executingNodeId]);

  // Fetch KYC profile for current user
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/kyc');
        const json = await res.json();
        if (json?.studentProfile) setKycProfile(json.studentProfile);
        if (json && typeof json === 'object') setKycSnapshot(json);
      } catch {}
    })();
  }, []);

  // Highlight KYC values inline within the strategy markdown
  const highlightedStrategy = useMemo(() => {
    if (!strategy?.rationale) return '';
    if (!kycProfile) return strategy.rationale;
    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let text = strategy.rationale;
    Object.entries(kycProfile).forEach(([key, value]) => {
      if (value == null) return;
      const values = Array.isArray(value) ? value : [value];
      values.forEach((val) => {
        const str = String(val).trim();
        if (!str) return;
        const re = new RegExp(`\\b${escapeRegExp(str)}\\b`, 'gi');
        text = text.replace(re, (m) => `<span class=\"kyc-chip\" title=\"KYC: ${key}\">${m}</span>`);
      });
    });
    return text;
  }, [strategy, kycProfile]);

  // Redirect if no campaign data
  React.useEffect(() => {
    if (!strategy || !brief || storeNodes.length === 0) {
      router.push('/campaign');
    }
  }, [strategy, brief, storeNodes, router]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Persist node position changes to store to avoid resets after status updates
  const onNodesChange = useCallback(
    (changes) => {
      setNodes((current) => {
        const updated = applyNodeChanges(changes, current);
        if (changes.length > 0) {
          const sanitized = updated.map(n => {
            const { openSettings, ...restData } = n.data || {};
            return { ...n, data: { ...restData } };
          });
          // Defer store update to avoid React setState during render warning
          queueMicrotask(() => setWorkflow(sanitized, storeEdges));
        }
        return updated;
      });
    },
    [setNodes, setWorkflow, storeEdges]
  );

  const handleRunAll = async () => {
    try {
      setIsRunning(true);
      const workflowRunId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setActiveWorkflowRunId(workflowRunId);
      
      // Get initial execution order
      let currentNodes = [...storeNodes];
      const executionOrder = getExecutionOrder(currentNodes, storeEdges);
      
      for (const nodeId of executionOrder) {
        // Re-check with current nodes state (not initial state)
        const { canExecute, reason } = canExecuteNode(nodeId, currentNodes, storeEdges);
        
        if (!canExecute) {
          console.log(`Skipping ${nodeId}: ${reason}`);
          continue;
        }

        const node = currentNodes.find(n => n.id === nodeId);
        if (!node) continue;

        // Visual feedback: highlight executing node
        setExecutingNodeId(nodeId);
        toast.success(`Executing: ${node.data.label}`);
        
        // Execute node via API
        updateNodeStatus(nodeId, 'loading');
        try {
          const response = await fetch('/api/campaign/execute-node', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nodeId,
              nodes: currentNodes, // Use current nodes with latest outputs
              edges: storeEdges,
              brief,
              strategy: strategy?.rationale || '',
              workflowRunId,
            }),
          });
          const result = await response.json();
          if (result.success) {
            updateNodeStatus(nodeId, 'complete', result.output, undefined, result.metadata);
            
            // Update current nodes with the new output
            currentNodes = currentNodes.map(n => 
              n.id === nodeId 
                ? { ...n, data: { ...n.data, status: 'complete', output: result.output, error: undefined, metadata: result.metadata } }
                : n
            );
            
            // Brief pause for visual feedback
            await new Promise(resolve => setTimeout(resolve, 800));
          } else {
            updateNodeStatus(nodeId, 'error', undefined, result.error);
            toast.error(`Failed: ${node.data.label}`);
          }
        } catch (e) {
          updateNodeStatus(nodeId, 'error', undefined, e.message);
          toast.error(`Error: ${node.data.label}`);
        }
      }

      setExecutingNodeId(null);
      toast.success('Campaign workflow completed!');
    } catch (error) {
      console.error('Error running workflow:', error);
      toast.error('Failed to run workflow');
    } finally {
      setIsRunning(false);
      setExecutingNodeId(null);
      setActiveWorkflowRunId(null);
    }
  };

  const handleReset = () => {
    // Reset all nodes to idle state
    const resetNodes = storeNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        status: 'idle',
        output: undefined,
        error: undefined,
        metadata: undefined,
      }
    }));
    setWorkflow(resetNodes, storeEdges);
    toast.success('Workflow reset');
  };

  const handleExport = () => {
    // Export campaign data
    const exportData = {
      brief,
      strategy,
      workflow: {
        nodes: storeNodes,
        edges: storeEdges,
      },
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `campaign-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Campaign exported!');
  };

  const handleGenerateReport = async () => {
    try {
      const doc = await generateBusinessPdf({
        brief,
        strategy,
        nodes: storeNodes,
        voiceData: kycSnapshot,
      });
      doc.save(`campaign-business-report-${Date.now()}.pdf`);
      toast.success('Business PDF report downloaded');
    } catch (error) {
      console.error('Failed to generate report', error);
      toast.error('Failed to generate report');
    }
  };

  // Save current workflow to server
  const handleSaveWorkflow = async () => {
    if (isSavingWorkflow) return;
    setIsSavingWorkflow(true);
    try {
      const sanitizedNodes = storeNodes.map(n => {
        const { openSettings, ...restData } = n.data || {};
        return { ...n, data: { ...restData } };
      });
      const res = await fetch('/api/workflows/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: brief || '',
          strategyRationale: strategy?.rationale || '',
          nodes: sanitizedNodes,
          edges: storeEdges,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Workflow saved');
        if (workflowsModalOpen) fetchWorkflows();
      } else {
        toast.error(json.error || 'Save failed');
      }
    } catch (e) {
      toast.error('Error saving workflow');
    } finally {
      setIsSavingWorkflow(false);
    }
  };

  const fetchWorkflows = async () => {
    setIsLoadingWorkflows(true);
    try {
      const res = await fetch('/api/workflows/list');
      const json = await res.json();
      if (json.success) {
        setSavedWorkflows(json.workflows || []);
      } else {
        toast.error(json.error || 'Failed to load workflows');
      }
    } catch (e) {
      toast.error('Error loading workflows');
    } finally {
      setIsLoadingWorkflows(false);
    }
  };

  useEffect(() => {
    if (workflowsModalOpen) fetchWorkflows();
  }, [workflowsModalOpen]);

  // Execute a single node (mirrors AgentNode logic) for regenerate within modal
  const handleDownloadModalImage = (imageUrl, index) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `campaign-image-${editingNodeId}-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const executeSingleNode = async (nodeId) => {
    const node = storeNodes.find(n => n.id === nodeId);
    if (!node) return;
    if (node.data.status === 'loading') return;
    updateNodeStatus(nodeId, 'loading');
    try {
      const response = await fetch('/api/campaign/execute-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          nodes: storeNodes,
          edges: storeEdges,
          brief,
          strategy: strategy?.rationale || '',
          workflowRunId: activeWorkflowRunId || `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      const result = await response.json();
      if (result.success) {
        updateNodeStatus(nodeId, 'complete', result.output, undefined, result.metadata);
        setEditingNodeOutput(result.output);
        toast.success('Node regenerated');
      } else {
        updateNodeStatus(nodeId, 'error', undefined, result.error);
        toast.error('Node regeneration failed');
      }
    } catch (e) {
      updateNodeStatus(nodeId, 'error', undefined, e.message);
      toast.error('Node regeneration error');
    }
  };

  const completedCount = storeNodes.filter(n => n.data.status === 'complete').length;
  const totalCount = storeNodes.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (!strategy) {
    return null; // Will redirect
  }

  return (
    <div className="h-screen w-full bg-background flex relative cf-canvas">
      <style jsx global>{`
        /* Custom slim emerald scrollbars */
        .campaign-sidebar-scroll{
          scrollbar-width: thin;
          scrollbar-color: rgba(16,185,129,0.5) transparent;
        }
        .campaign-sidebar-scroll::-webkit-scrollbar{ width:8px; height:8px; }
        .campaign-sidebar-scroll::-webkit-scrollbar-track{ background: transparent; }
        .campaign-sidebar-scroll::-webkit-scrollbar-thumb{
          background: rgba(16,185,129,0.35);
          border-radius: 8px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .campaign-sidebar-scroll:hover::-webkit-scrollbar-thumb{
          background: rgba(16,185,129,0.55);
        }

        /* Inline KYC highlight chip */
        .campaign-markdown .kyc-chip{
          display: inline-block;
          font-size: 10px;
          line-height: 1.25;
          padding: 0 6px;
          border-radius: 9999px;
          background: rgba(16,185,129,0.12);
          color: #059669;
          border: 1px solid rgba(16,185,129,0.35);
          margin: 0 2px;
          vertical-align: baseline;
          white-space: nowrap;
        }

        /* Clamp long node text to 6 lines for readability */
        .cf-canvas .react-flow__node .leading-relaxed{
          display: -webkit-box;
          -webkit-line-clamp: 6;
          -webkit-box-orient: vertical;
          overflow: hidden;
          white-space: normal; /* override pre-wrap to enable clamping */
        }
      `}</style>
      {/* Left Sidebar - Strategy Panel */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -380, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            className="w-[360px] border-r border-border bg-card flex flex-col z-10 shadow-xl overflow-hidden"
          >
            {/* Sidebar Header */}
            <div className="p-4 border-b border-border shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-sm text-foreground">AI Agent's Strategy</h2>
                    <p className="text-xs text-muted-foreground">Thought process behind this workflow</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarOpen(false)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Strategic Rationale - Scrollable (native overflow) */}
            <div className="flex-1 campaign-sidebar-scroll overflow-y-auto">
              <div className="p-4 space-y-4 min-h-0">
                {/* Strategic Approach Section */}
                <div>
                  <h3 className="font-semibold text-foreground mb-2 text-sm">Strategic Approach</h3>
                  <div className="campaign-markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-lg font-bold mt-4 mb-2" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-base font-semibold mt-3 mb-2" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-sm font-semibold mt-3 mb-2" {...props} />,
                        p: ({node, ...props}) => <p className="text-sm leading-relaxed mb-3" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 mb-3" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1 mb-3" {...props} />,
                        li: ({node, ...props}) => <li className="text-sm" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                        em: ({node, ...props}) => <em className="italic" {...props} />,
                        code: ({node, inline, ...props}) => inline ? <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono" {...props} /> : <code className="block p-2 rounded bg-muted text-xs font-mono overflow-x-auto" {...props} />,
                        blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-emerald-500 pl-3 italic" {...props} />,
                      }}
                    >
                      {highlightedStrategy}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Footer - Progress */}
            <div className="p-4 border-t border-border shrink-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Workflow Progress</span>
                  <span className="font-semibold text-foreground">
                    {completedCount}/{totalCount}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-primary"
                  />
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Collapsed sidebar handle */}
      {!isSidebarOpen && (
        <button
          aria-label="Open Strategy Sidebar"
          onClick={() => setIsSidebarOpen(true)}
          className="fixed left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-md bg-card border border-border shadow hover:bg-accent"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Main Canvas Area */}
      <div className="flex-1 relative">
        {/* React Flow Canvas */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'smartEdge',
            animated: false,
          }}
        >
          <Background
            color="#ffffff"
            gap={20}
            size={1}
            className="opacity-5"
          />
          
          <Controls
            className="bg-card border-border"
          />
          
          <MiniMap
            className="bg-card border-border"
            nodeColor={(node) => {
              const colorMap = {
                strategy: '#3b82f6',
                copy: '#f97316',
                image: '#ec4899',
                research: '#22c55e',
                timeline: '#ef4444',
                distribution: '#6366f1',
              };
              return colorMap[node.data?.type] || '#64748b';
            }}
          />

          {/* Top Action Bar */}
          <Panel position="top-left" className="m-4 backdrop-blur-sm bg-card/90 border border-border rounded-lg shadow-md px-4 py-2 w-auto max-w-[95vw]">
            <div className="flex flex-wrap items-center gap-2 md:gap-3 shrink-0">
              <Button
                onClick={() => router.push('/campaign')}
                variant="outline"
                size="sm"
                className="bg-card/80 border-border hover:bg-accent"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to Brief
              </Button>
              
              <Button
                onClick={() => router.push('/')}
                variant="outline"
                size="sm"
                className="bg-card/80 border-border hover:bg-accent"
              >
                <Home className="w-4 h-4 mr-1" />
                Home
              </Button>
              <div className="flex items-center gap-2 ml-4">
                <h2 className="text-sm font-semibold text-foreground">Workflow Canvas</h2>
              </div>
              <div className="flex items-center flex-wrap gap-2 md:gap-3 ml-6 p-1.5 rounded-lg bg-muted/60 border border-border shadow-sm">
                {!isSidebarOpen && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsSidebarOpen(true)}
                    className="h-8"
                  >
                    <ChevronRight className="w-4 h-4 mr-1" />
                    Show Strategy
                  </Button>
                )}

                <Button
                  onClick={handleRunAll}
                  disabled={isRunning}
                  size="sm"
                  className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg"
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Run Campaign
                </Button>

                <Button
                  onClick={handleReset}
                  disabled={isRunning}
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Reset
                </Button>

                <Button
                  onClick={handleExport}
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Export
                </Button>

                <Button
                  onClick={handleGenerateReport}
                  variant="outline"
                  size="sm"
                  className="h-8 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-700 dark:text-amber-300"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Business PDF
                </Button>

                <Button
                  onClick={handleSaveWorkflow}
                  variant="outline"
                  size="sm"
                  disabled={isSavingWorkflow}
                  className="h-8"
                >
                  <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                  {isSavingWorkflow ? 'Saving...' : 'Save'}
                </Button>

                <Button
                  onClick={() => setWorkflowsModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  Past Workflows
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditingNodeId(null); setPromptModalOpen(true); }}
                  className="h-8 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                >
                  <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                  Settings
                </Button>
              </div>
            </div>
          </Panel>

          {/* Right Panel: Available Modules (collapsible) */}
          <Panel position="top-right" style={{ top: '90px', right: '16px' }} className="backdrop-blur-sm bg-card/90 border border-border rounded-lg shadow-md px-3 py-3 w-[360px] max-h-[520px] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground">Available Modules</h3>
              <Button
                variant="ghost"
                size="icon"
                aria-expanded={isModulesOpen}
                onClick={() => setIsModulesOpen(v => !v)}
                className="h-7 w-7"
              >
                {isModulesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
            {isModulesOpen && (
            <div className="space-y-1 overflow-y-auto campaign-sidebar-scroll">
              {[ 
                { icon: '🖼️', name: 'Visual Asset Generator', category: 'Creative', desc: 'Generate education-themed visuals: campus life, graduation, study abroad lifestyle' },
                { icon: '🎬', name: 'Video Content Builder', category: 'Creative', desc: 'Create video content from student testimonials, campus tours, or counselling sessions' },
                { icon: '📝', name: 'Outreach Copy Writer', category: 'Creative', desc: 'Generate student-facing outreach copy, captions, and recruitment content' },
                { icon: '🔍', name: 'Student Segment Analyzer', category: 'Research', desc: 'Analyze target student demographics, test readiness, and intake timing' },
                { icon: '📊', name: 'Intake Timeline Optimizer', category: 'Strategy', desc: 'Create schedules aligned with UK/Ireland university intake cycles' },
                { icon: '📧', name: 'Student Email Outreach', category: 'Communication', desc: 'Send personalized outreach emails to student contact lists' },
              ].map((module, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-md hover:bg-accent cursor-pointer transition-colors border border-transparent hover:border-border"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{module.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-foreground truncate">{module.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                          {module.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{module.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </Panel>

        </ReactFlow>
        {/* Node / Workflow Settings Modal */}
        <Dialog open={promptModalOpen} onOpenChange={setPromptModalOpen}>
          <DialogContent className="w-[96vw] max-w-[96vw] h-[92vh] p-0 overflow-hidden flex flex-col">
            <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
              <DialogTitle>
                {editingNodeId ? editingNodeLabel : 'Workflow Agent Prompts'}
              </DialogTitle>
              <DialogDescription>
                {editingNodeId ? editingNodePurpose : 'Select an agent to edit its prompt context.'}
              </DialogDescription>
            </DialogHeader>
            {editingNodeId ? (
              <div className="grid md:grid-cols-2 gap-6 h-full min-h-0 px-6 py-5">
                {/* Prompt Editor */}
                <div className="flex flex-col gap-3 min-h-0">
                  <h4 className="text-sm font-medium">Prompt Context</h4>
                  <Textarea
                    value={editingPrompt}
                    onChange={(e) => setEditingPrompt(e.target.value)}
                    className="flex-1 min-h-[200px] md:min-h-0 text-sm resize-none campaign-sidebar-scroll"
                    placeholder="Describe what this agent should focus on..."
                  />
                  
                  {/* Web Research Filters - Show only for exa_research nodes */}
                  {editingNodeType === 'exa_research' && (
                    <div className="border border-cyan-500/30 rounded-lg p-3 bg-cyan-500/5 space-y-2">
                      <h5 className="text-xs font-medium text-cyan-400 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        Lead Categories (CSV Filters)
                      </h5>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-cyan-500/10 p-1.5 rounded">
                          <input
                            type="checkbox"
                            checked={editingNodeFilters.studentLeads}
                            onChange={(e) => setEditingNodeFilters(prev => ({ ...prev, studentLeads: e.target.checked }))}
                            className="rounded text-cyan-500 focus:ring-cyan-500"
                          />
                          <span>🎓 Student Leads</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-cyan-500/10 p-1.5 rounded">
                          <input
                            type="checkbox"
                            checked={editingNodeFilters.linkedInProfiles}
                            onChange={(e) => setEditingNodeFilters(prev => ({ ...prev, linkedInProfiles: e.target.checked }))}
                            className="rounded text-cyan-500 focus:ring-cyan-500"
                          />
                          <span>💼 LinkedIn Profiles</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-cyan-500/10 p-1.5 rounded">
                          <input
                            type="checkbox"
                            checked={editingNodeFilters.communities}
                            onChange={(e) => setEditingNodeFilters(prev => ({ ...prev, communities: e.target.checked }))}
                            className="rounded text-cyan-500 focus:ring-cyan-500"
                          />
                          <span>👥 Communities</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-cyan-500/10 p-1.5 rounded">
                          <input
                            type="checkbox"
                            checked={editingNodeFilters.competitors}
                            onChange={(e) => setEditingNodeFilters(prev => ({ ...prev, competitors: e.target.checked }))}
                            className="rounded text-cyan-500 focus:ring-cyan-500"
                          />
                          <span>🏢 Competitors</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-cyan-500/10 p-1.5 rounded">
                          <input
                            type="checkbox"
                            checked={editingNodeFilters.redditUsers}
                            onChange={(e) => setEditingNodeFilters(prev => ({ ...prev, redditUsers: e.target.checked }))}
                            className="rounded text-cyan-500 focus:ring-cyan-500"
                          />
                          <span>📣 Reddit Users</span>
                        </label>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Select categories to include in CSV output. Email agent only sends to Student Leads.</p>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-500 hover:bg-emerald-600 text-white"
                      onClick={() => {
                        updateNodePrompt(editingNodeId, editingPrompt);
                        // Also save filters for exa_research nodes
                        if (editingNodeType === 'exa_research') {
                          updateNodeData(editingNodeId, { filters: editingNodeFilters });
                        }
                        toast.success('Settings saved');
                      }}
                    >
                      Save Settings
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => executeSingleNode(editingNodeId)}
                    >
                      Regenerate Node
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRunAll}
                    >
                      Regenerate All
                    </Button>
                  </div>
                </div>
                {/* Output Viewer */}
                <div className="flex flex-col gap-3 min-h-0">
                  <h4 className="text-sm font-medium">Latest Output</h4>
                  <ModalScrollArea className="flex-1 min-h-[260px] md:min-h-0 rounded-md border border-border campaign-sidebar-scroll p-3 bg-muted/40">
                    {(() => {
                      if (!editingNodeOutput) {
                        return <p className="text-xs text-muted-foreground">No output yet. Run the agent to generate content.</p>;
                      }
                      // Try parse image payload
                      try {
                        const parsed = JSON.parse(editingNodeOutput);
                        if (parsed.images && Array.isArray(parsed.images) && parsed.images.length > 0) {
                          return (
                            <div className="grid grid-cols-2 gap-2">
                              {parsed.images.map((img, idx) => (
                                <div 
                                  key={idx} 
                                  className="relative group border-2 border-border rounded-lg overflow-hidden cursor-pointer hover:border-emerald-500 transition-all duration-200 hover:shadow-lg"
                                  onClick={() => setModalLightboxImage({ url: img.url, index: idx, theme: img.theme })}
                                >
                                  <img src={img.url} alt={`ad-${idx}`} className="w-full h-32 object-cover transition-all duration-300 group-hover:scale-110" loading="lazy" />
                                  <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center">
                                    <div className="bg-emerald-500 rounded-full p-2 shadow-lg">
                                      <ZoomIn className="w-5 h-5 text-white" />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        }
                      } catch {}
                      return (
                        <div className="campaign-markdown text-sm">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({node, ...props}) => <h1 className="text-lg font-semibold mt-3 mb-2" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-base font-semibold mt-2 mb-1" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-sm font-semibold mt-2 mb-1" {...props} />,
                              p: ({node, ...props}) => <p className="text-[13px] leading-relaxed mb-2" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 mb-2" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1 mb-2" {...props} />,
                              li: ({node, ...props}) => <li className="text-[13px]" {...props} />,
                              code: ({node, inline, ...props}) => inline ? <code className="px-1 py-0.5 rounded bg-muted text-[12px] font-mono" {...props} /> : <code className="block p-2 rounded bg-muted text-[12px] font-mono overflow-x-auto" {...props} />,
                              blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-emerald-500 pl-3 italic" {...props} />,
                            }}
                          >
                            {editingNodeOutput}
                          </ReactMarkdown>
                        </div>
                      );
                    })()}
                  </ModalScrollArea>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setPromptModalOpen(false); setEditingNodeId(null); }}
                    className="self-start"
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <ModalScrollArea className="flex-1 min-h-0 campaign-sidebar-scroll px-6 pb-5">
                <div className="space-y-3 pr-2">
                  {nodes.map(n => (
                    <div key={n.id} className="p-3 rounded-md border border-border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{n.data.label}</p>
                        <Button size="sm" variant="outline" onClick={() => { setEditingNodeId(n.id); setEditingPrompt(n.data.promptContext || ''); setEditingNodeOutput(n.data.output || ''); setEditingNodeLabel(n.data.label || 'Agent Configuration'); setEditingNodePurpose(n.data.description || n.data.promptContext || 'Configure prompts and view this agent\'s output.'); }} className="h-7 text-xs">Open</Button>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.data.promptContext || 'No prompt context yet.'}</p>
                      {n.data.status === 'complete' && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Output ready</p>
                      )}
                    </div>
                  ))}
                </div>
              </ModalScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Modal Image Lightbox - Portal to body */}
      {modalLightboxImage && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setModalLightboxImage(null)}
        >
          {/* Header bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <p style={{ color: '#f9fafb', fontWeight: '600', fontSize: '14px' }}>Image {modalLightboxImage.index + 1}</p>
              {modalLightboxImage.theme && (
                <span style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontWeight: '500'
                }}>
                  {modalLightboxImage.theme}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadModalImage(modalLightboxImage.url, modalLightboxImage.index);
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <button
                onClick={() => setModalLightboxImage(null)}
                style={{
                  padding: '8px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.25)';
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Image container */}
          <div 
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              minHeight: 0
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={modalLightboxImage.url} 
              alt={`Campaign image ${modalLightboxImage.index + 1}`} 
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                display: 'block',
                animation: 'zoomIn 0.3s ease-out'
              }}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Drag & Drop Overlay for Import */}
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (!file) return;
          if (!file.type.includes('json')) { toast.error('Please drop a JSON file'); return; }
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const parsed = JSON.parse(String(ev.target?.result));
              const workflow = parsed.workflow || parsed; // allow raw {nodes,edges}
              const rawNodes = workflow.nodes || [];
              const rawEdges = workflow.edges || [];
              if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges)) { toast.error('Invalid workflow structure'); return; }
              setWorkflow(rawNodes, rawEdges);
              toast.success('Workflow imported');
            } catch (err) {
              toast.error('Failed to parse workflow JSON');
            }
          };
          reader.readAsText(file);
        }}
        className="pointer-events-none fixed inset-0 z-50"
      />
    {/* Past Workflows Modal */}
    <Dialog open={workflowsModalOpen} onOpenChange={setWorkflowsModalOpen}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>Saved Workflows</DialogTitle>
          <DialogDescription>Load a previously saved workflow configuration.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {isLoadingWorkflows && <p className="text-sm text-muted-foreground">Loading workflows...</p>}
          {!isLoadingWorkflows && savedWorkflows.length === 0 && <p className="text-sm text-muted-foreground">No workflows saved yet.</p>}
          <ModalScrollArea className="max-h-[50vh] campaign-sidebar-scroll pr-2">
            <div className="space-y-3">
              {savedWorkflows.map(wf => (
                <div key={wf.id} className="p-3 rounded-md border border-border bg-card space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{new Date(wf.createdAt).toLocaleString()}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{wf.brief}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setWorkflow(wf.nodes, wf.edges);
                        toast.success('Workflow loaded');
                        setWorkflowsModalOpen(false);
                      }}
                      className="h-7 text-xs shrink-0"
                    >
                      Load
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{wf.strategyRationale}</p>
                  <div className="flex gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{wf.nodesCount} nodes</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{wf.edgesCount} edges</span>
                  </div>
                </div>
              ))}
            </div>
          </ModalScrollArea>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setWorkflowsModalOpen(false)}>Close</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
    </div>
  );
}
