"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import KanbanColumn from "./KanbanColumn";

const Calendar = dynamic(() => import("react-calendar"), { ssr: false });

const COLUMN_ORDER = ["new", "in_progress", "follow_up", "completed"];

function SkeletonCard() {
  return (
    <div className="bg-white/80 dark:bg-white/6 border border-gray-200 dark:border-white/10 rounded-xl p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 bg-gray-200 dark:bg-white/10 rounded" />
          <div className="h-2 w-16 bg-gray-200 dark:bg-white/10 rounded" />
        </div>
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-2 w-full bg-gray-200 dark:bg-white/10 rounded" />
        <div className="h-2 w-3/4 bg-gray-200 dark:bg-white/10 rounded" />
      </div>
      <div className="h-5 w-20 bg-gray-200 dark:bg-white/10 rounded" />
    </div>
  );
}

function SkeletonColumn() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-white/20" />
        <div className="h-4 w-24 bg-gray-200 dark:bg-white/10 rounded" />
      </div>
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/* ── Stats Cards ── */
function StatsBar({ leads, campaigns, voiceSessions }) {
  const hot = leads.filter((l) => l.score >= 75).length;
  const warm = leads.filter((l) => l.score >= 50 && l.score < 75).length;
  const cold = leads.filter((l) => l.score < 50).length;

  const stats = [
    { label: "Total Leads", value: leads.length, color: "from-blue-500 to-blue-600", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    { label: "Hot Leads", value: hot, color: "from-red-500 to-rose-600", icon: "M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" },
    { label: "Warm Leads", value: warm, color: "from-amber-500 to-orange-500", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
    { label: "Cold Leads", value: cold, color: "from-sky-500 to-cyan-500", icon: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" },
    { label: "Campaigns", value: campaigns.length, color: "from-purple-500 to-violet-600", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
    { label: "Voice Sessions", value: voiceSessions.length, color: "from-emerald-500 to-green-600", icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/4 p-3">
          <div className={`absolute top-0 left-0 h-1 w-full bg-linear-to-r ${s.color}`} />
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} />
            </svg>
            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Campaign Insights Panel ── */
function CampaignInsights({ campaigns, onImportLeads }) {
  const [expanded, setExpanded] = useState(false);
  const [previewId, setPreviewId] = useState(null);
  if (campaigns.length === 0) return null;

  const visible = expanded ? campaigns : campaigns.slice(0, 3);

  return (
    <div className="mb-6 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/4 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Campaign Insights</h3>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300">{campaigns.length}</span>
        </div>
        {campaigns.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {expanded ? "Show less" : `Show all (${campaigns.length})`}
          </button>
        )}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {visible.map((c) => (
          <div key={c.id}>
            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                  {c.brief ? c.brief.slice(0, 80) + (c.brief.length > 80 ? '…' : '') : 'Untitled Campaign'}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span>{c.completedNodes}/{c.nodesCount} nodes</span>
                  <span>·</span>
                  <span className="font-medium text-purple-600 dark:text-purple-400">{c.csvLeads.length} leads found</span>
                  <span>·</span>
                  <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.csvLeads.length > 0 && (
                  <>
                    <button
                      onClick={() => setPreviewId(previewId === c.id ? null : c.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {previewId === c.id ? 'Hide' : 'Preview'}
                    </button>
                    <button
                      onClick={() => onImportLeads(c.csvLeads, c.brief)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Import {c.csvLeads.length}
                    </button>
                  </>
                )}
              </div>
            </div>
            {/* CSV Lead Preview Table */}
            {previewId === c.id && c.csvLeads.length > 0 && (
              <div className="px-4 pb-3">
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400">
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Type</th>
                        <th className="text-left px-3 py-2 font-medium">Relevance</th>
                        <th className="text-left px-3 py-2 font-medium">Email</th>
                        <th className="text-left px-3 py-2 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {c.csvLeads.slice(0, 10).map((lead, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/3">
                          <td className="px-3 py-2 font-medium text-gray-800 dark:text-white whitespace-nowrap">{lead.name}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              (lead.type || '').includes('LinkedIn') ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                              : (lead.type || '').includes('Reddit') ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300'
                              : (lead.type || '').includes('Compet') ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
                              : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                            }`}>
                              {lead.type || 'Lead'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              lead.relevance >= 75 ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                              : lead.relevance >= 50 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                            }`}>
                              {lead.relevance}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-[140px] truncate">{lead.email || '—'}</td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">{lead.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {c.csvLeads.length > 10 && (
                    <div className="px-3 py-2 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-white/3">
                      Showing 10 of {c.csvLeads.length} leads
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Voice Sessions Panel ── */
function VoiceSessionsPanel({ sessions }) {
  const [expanded, setExpanded] = useState(false);
  if (sessions.length === 0) return null;

  const visible = expanded ? sessions : sessions.slice(0, 3);

  return (
    <div className="mb-6 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/4 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Recent Voice Sessions</h3>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">{sessions.length}</span>
        </div>
        {sessions.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {expanded ? "Show less" : `Show all (${sessions.length})`}
          </button>
        )}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {visible.map((s) => (
          <div key={s.conversationId} className="px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-800 dark:text-white">{s.studentName}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium">
                {s.mode === 'onboarding' ? 'Onboarding' : 'Follow-up'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>{Math.round((s.callDuration || 0) / 60)}m {(s.callDuration || 0) % 60}s call</span>
              <span>•</span>
              <span>{s.messagesCount} messages</span>
              {s.studentProfile?.targetCountries?.length > 0 && (
                <>
                  <span>•</span>
                  <span>{s.studentProfile.targetCountries.join(', ')}</span>
                </>
              )}
              {s.studentProfile?.testStatus && (
                <>
                  <span>•</span>
                  <span>Test: {s.studentProfile.testStatus}</span>
                </>
              )}
            </div>
            {s.summary && (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 truncate">{s.summary}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KanbanBoard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [regionFilter, setRegionFilter] = useState("All Regions");
  const [courseFilter, setCourseFilter] = useState("All Courses");
  const [campaigns, setCampaigns] = useState([]);
  const [voiceSessions, setVoiceSessions] = useState([]);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState("pipeline");
  const [calendarDate, setCalendarDate] = useState(new Date());

  const fetchLeads = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/leads", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[KanbanBoard] fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch("/api/counsellor/dashboard", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setCampaigns(data.campaigns || []);
      setVoiceSessions(data.voiceSessions || []);
    } catch (err) {
      console.error("[KanbanBoard] dashboard data error:", err);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchDashboardData();
  }, [fetchLeads, fetchDashboardData]);

  const handleStatusChange = async (leadId, newStatus) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, status: newStatus }),
      });
      if (!res.ok) fetchLeads();
    } catch {
      fetchLeads();
    }
  };

  const handleDeleteAllLeads = async () => {
    if (!confirm('Delete ALL leads? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/leads?all=true', { method: 'DELETE' });
      if (res.ok) {
        const result = await res.json();
        console.log(`[DeleteAll] Removed ${result.deleted} leads`);
        setLeads([]);
      }
    } catch (err) {
      console.error('[DeleteAll] error:', err);
    }
  };

  const handleImportLeads = async (csvLeads, campaignBrief) => {
    setImporting(true);
    try {
      // Filter out junk entries — keep only real person/org leads
      const isJunkName = (name) => {
        if (!name || name.length < 2) return true;
        const lower = name.toLowerCase();
        // Filter group invites, generic posts, long reddit titles (with pipe separators)
        const junkPatterns = [
          'whatsapp group', 'group invite', 'telegram group', 'join group',
          'requesting profile eval', 'profile evaluation',
          'chance me', 'chanceme',
        ];
        if (junkPatterns.some((p) => lower.includes(p))) return true;
        // Reddit-style titles: contain " | " (pipe separators) and are long
        if (name.includes(' | ') && name.length > 50) return true;
        // Names that are just URLs
        if (lower.startsWith('http://') || lower.startsWith('https://')) return true;
        return false;
      };

      // Classify lead type into tags
      const classifyTags = (type, notes) => {
        const tags = [];
        const t = (type || '').toLowerCase();
        const n = (notes || '').toLowerCase();
        if (t.includes('linkedin')) tags.push('LinkedIn');
        else if (t.includes('reddit')) tags.push('Reddit');
        else if (t.includes('competitor')) tags.push('Competitor');
        if (n.includes('alumnus') || n.includes('alumni')) tags.push('Alumni');
        if (n.includes('student') || n.includes('study abroad')) tags.push('Student Lead');
        if (n.includes('phd') || n.includes('research')) tags.push('Researcher');
        if (n.includes('competitor') || n.includes('competitive')) tags.push('Competitor Intel');
        if (tags.length === 0) tags.push('Campaign Lead');
        return tags;
      };

      const filtered = csvLeads.filter((l) => !isJunkName(l.name));

      const mapped = filtered.map((l) => ({
        name: l.name || 'Unknown Lead',
        email: l.email || l.contactInfo || '',
        phone: l.phone || '',
        sourceType: l.type || '',
        sourceUrl: l.source || '',
        notes: l.notes || (campaignBrief ? `From campaign: ${campaignBrief.slice(0, 60)}` : ''),
        score: Math.min(100, Math.max(0, l.relevance || l.score || 0)),
        status: 'new',
        tags: classifyTags(l.type, l.notes),
      }));

      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: mapped }),
      });

      if (res.ok) {
        const result = await res.json();
        console.log(`[Import] Created ${result.created}, skipped ${result.skipped}`);
        fetchLeads();
      }
    } catch (err) {
      console.error("[Import] error:", err);
    } finally {
      setImporting(false);
    }
  };

  // Hardcoded schedule events for calendar
  const scheduleEvents = [
    { date: new Date(2026, 3, 7), title: "UK Intake Orientation", time: "10:00 AM", type: "session", desc: "Group session for Sept 2026 UK applicants" },
    { date: new Date(2026, 3, 8), title: "IELTS Prep Workshop", time: "2:00 PM", type: "workshop", desc: "Free IELTS band 7+ strategy workshop" },
    { date: new Date(2026, 3, 10), title: "Ireland Info Webinar", time: "11:00 AM", type: "webinar", desc: "Study in Ireland - Jan 2027 intake" },
    { date: new Date(2026, 3, 12), title: "Follow-up: Hot Leads", time: "9:00 AM", type: "follow-up", desc: "Call hot leads from UK campaign" },
    { date: new Date(2026, 3, 14), title: "SOP Review Session", time: "3:00 PM", type: "session", desc: "Review SOPs for early applicants" },
    { date: new Date(2026, 3, 16), title: "Partner University Call", time: "4:00 PM", type: "meeting", desc: "Monthly call with University of Leeds" },
    { date: new Date(2026, 3, 18), title: "Scholarship Deadline", time: "All Day", type: "deadline", desc: "Chevening Scholarship deadline" },
    { date: new Date(2026, 3, 21), title: "Campaign Review", time: "10:00 AM", type: "meeting", desc: "Review April campaign performance" },
    { date: new Date(2026, 3, 23), title: "New Leads Orientation", time: "11:00 AM", type: "session", desc: "Onboard new warm leads from campaign" },
    { date: new Date(2026, 3, 25), title: "PTE Prep Masterclass", time: "2:00 PM", type: "workshop", desc: "PTE Academic scoring tips" },
    { date: new Date(2026, 3, 28), title: "Monthly Report", time: "5:00 PM", type: "deadline", desc: "Submit monthly lead conversion report" },
    { date: new Date(2026, 3, 30), title: "Canada Visa Workshop", time: "3:00 PM", type: "workshop", desc: "SDS stream visa filing workshop" },
  ];

  const getEventsForDate = (date) => {
    return scheduleEvents.filter(
      (e) => e.date.getFullYear() === date.getFullYear() && e.date.getMonth() === date.getMonth() && e.date.getDate() === date.getDate()
    );
  };

  const selectedDayEvents = getEventsForDate(calendarDate);

  const eventTypeColors = {
    session: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/30",
    workshop: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30",
    webinar: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/30",
    "follow-up": "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30",
    meeting: "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/30",
    deadline: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/30",
  };

  // Derive unique filter options from data
  const regions = ["All Regions", ...new Set(leads.map((l) => l.location).filter(Boolean))];
  const courses = ["All Courses", ...new Set(leads.map((l) => l.course).filter(Boolean))];

  // Apply filters
  const filtered = leads.filter((l) => {
    if (regionFilter !== "All Regions" && l.location !== regionFilter) return false;
    if (courseFilter !== "All Courses" && l.course !== courseFilter) return false;
    return true;
  });

  // Group into columns
  const groupedLeads = {
    new: filtered.filter((l) => l.status === "new"),
    in_progress: filtered.filter((l) => l.status === "in_progress"),
    follow_up: filtered.filter((l) => l.status === "follow_up"),
    completed: filtered.filter((l) => l.status === "completed"),
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchLeads(); }}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const tabs = [
    { id: "pipeline", label: "Lead Pipeline", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    { id: "campaigns", label: "Campaigns", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
    { id: "schedule", label: "Schedule", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Counsellor Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage leads, campaigns, and your schedule</p>
        </div>
        <button
          onClick={() => {
            const event = new CustomEvent("openAddLeadModal");
            window.dispatchEvent(event);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-lg shadow-blue-600/20 transition-all duration-200 hover:shadow-blue-600/40"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Lead
        </button>
      </div>

      {/* Stats */}
      {!loading && <StatsBar leads={leads} campaigns={campaigns} voiceSessions={voiceSessions} />}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200 dark:border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Import overlay */}
      {importing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-2xl flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Importing leads from campaign...</p>
          </div>
        </div>
      )}

      {/* Pipeline Tab */}
      {activeTab === "pipeline" && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Filter:</span>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {courses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {leads.length > 0 && (
              <button
                onClick={handleDeleteAllLeads}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete All Leads
              </button>
            )}
          </div>

          {/* Kanban Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {COLUMN_ORDER.map((s) => <SkeletonColumn key={s} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {COLUMN_ORDER.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  leads={groupedLeads[status]}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Campaigns Tab */}
      {activeTab === "campaigns" && (
        <>
          {!loading && <CampaignInsights campaigns={campaigns} onImportLeads={handleImportLeads} />}
          {!loading && <VoiceSessionsPanel sessions={voiceSessions} />}
          {!loading && campaigns.length === 0 && voiceSessions.length === 0 && (
            <div className="text-center py-16">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400">No campaigns yet. Create one from Campaign AI.</p>
            </div>
          )}
        </>
      )}

      {/* Schedule Tab */}
      {activeTab === "schedule" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/4 p-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Monthly Schedule
            </h3>
            <Calendar
              onChange={setCalendarDate}
              value={calendarDate}
              className="w-full! border-0! counsellor-calendar"
              tileContent={({ date, view }) => {
                if (view !== 'month') return null;
                const dayEvents = getEventsForDate(date);
                if (dayEvents.length === 0) return null;
                return (
                  <div className="flex justify-center gap-0.5 mt-1">
                    {dayEvents.slice(0, 3).map((ev, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          ev.type === 'deadline' ? 'bg-red-500'
                          : ev.type === 'workshop' ? 'bg-emerald-500'
                          : ev.type === 'meeting' ? 'bg-sky-500'
                          : 'bg-blue-500'
                        }`}
                      />
                    ))}
                  </div>
                );
              }}
            />
          </div>

          {/* Events for selected date */}
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/4 p-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4">
              {calendarDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            {selectedDayEvents.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-xs text-gray-400 dark:text-gray-500">No events scheduled</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayEvents.map((ev, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border ${eventTypeColors[ev.type] || eventTypeColors.session}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">{ev.title}</span>
                      <span className="text-[10px] font-medium opacity-70">{ev.time}</span>
                    </div>
                    <p className="text-[11px] opacity-80">{ev.desc}</p>
                    <span className="inline-block mt-1.5 text-[9px] font-bold uppercase tracking-wider opacity-60">{ev.type}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Upcoming events */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Upcoming</h4>
              <div className="space-y-2">
                {scheduleEvents
                  .filter((e) => e.date >= new Date())
                  .slice(0, 5)
                  .map((ev, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCalendarDate(ev.date)}
                      className="w-full text-left p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          ev.type === 'deadline' ? 'bg-red-500'
                          : ev.type === 'workshop' ? 'bg-emerald-500'
                          : ev.type === 'meeting' ? 'bg-sky-500'
                          : 'bg-blue-500'
                        }`} />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate flex-1">{ev.title}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                          {ev.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
