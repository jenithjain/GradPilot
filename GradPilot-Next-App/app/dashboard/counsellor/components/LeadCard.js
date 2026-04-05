"use client";

function getScoreBadge(score) {
  if (score >= 75) return { label: "Hot", bg: "bg-red-100 dark:bg-red-500/20", text: "text-red-600 dark:text-red-400", border: "border-red-300 dark:border-red-500/30", pill: "bg-red-500 text-white" };
  if (score >= 50) return { label: "Warm", bg: "bg-amber-100 dark:bg-amber-500/20", text: "text-amber-700 dark:text-amber-400", border: "border-amber-300 dark:border-amber-500/30", pill: "bg-amber-500 text-white" };
  return { label: "Cold", bg: "bg-blue-100 dark:bg-blue-500/20", text: "text-blue-600 dark:text-blue-400", border: "border-blue-300 dark:border-blue-500/30", pill: "bg-blue-500 text-white" };
}

const TAG_STYLES = {
  "Visa Approved": "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30",
  "Application Submitted": "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30",
  "Funding Query": "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/30",
  "Scholarship": "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/30",
  "LinkedIn": "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/30",
  "Reddit": "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-500/30",
  "Competitor": "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/30",
  "Alumni": "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/30",
  "Student Lead": "bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/30",
  "Campaign Lead": "bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-500/30",
  "Researcher": "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/30",
  "Competitor Intel": "bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-500/30",
};

const ACCENT_BORDER = {
  new: "border-l-blue-500",
  in_progress: "border-l-amber-500",
  follow_up: "border-l-purple-500",
  completed: "border-l-emerald-500",
};

export default function LeadCard({ lead, onStatusChange, columnStatus }) {
  const badge = getScoreBadge(lead.score);
  const accentBorder = ACCENT_BORDER[columnStatus] || ACCENT_BORDER.new;

  return (
    <div className={`group relative bg-white dark:bg-white/6 backdrop-blur-md border border-gray-200 dark:border-white/10 border-l-4 ${accentBorder} rounded-xl p-4 shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer`}>
      {/* Header: Avatar + Name */}
      <div className="flex items-start gap-3 mb-2">
        <img
          src={lead.avatar || "/avatars/spiderman.png"}
          alt={lead.name}
          className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-200 dark:ring-white/20 shrink-0"
          onError={(e) => { e.target.src = "/avatars/spiderman.png"; }}
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate">{lead.name}</h4>
          {lead.sourceType ? (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{lead.sourceType}</p>
          ) : lead.location ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{lead.location}</p>
          ) : null}
        </div>

        {/* Three-dot menu */}
        <div className="relative group/menu shrink-0">
          <button className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          <div className="absolute right-0 top-6 z-30 hidden group-hover/menu:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]">
            {["new", "in_progress", "follow_up", "completed"].map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange?.(lead.id, s)}
                className="block w-full text-left text-xs px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 capitalize"
              >
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contact Info */}
      {(lead.email || lead.phone) && (
        <div className="space-y-1 mb-2 pl-1">
          {lead.email && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <svg className="w-3 h-3 text-gray-400 dark:text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <svg className="w-3 h-3 text-gray-400 dark:text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="truncate">{lead.phone}</span>
            </div>
          )}
        </div>
      )}

      {/* Details */}
      <div className="space-y-1 mb-2">
        {(lead.country || lead.course) && (
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
            <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="truncate">{[lead.country, lead.course].filter(Boolean).join(' · ')}</span>
          </div>
        )}
        {lead.notes && (
          <div className="flex items-start gap-1 text-xs text-gray-500 dark:text-gray-400">
            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <span className="line-clamp-2 text-[11px]">{lead.notes}</span>
          </div>
        )}
        {lead.exam && (
          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
            <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="truncate">{lead.exam}{lead.examDetail ? `: ${lead.examDetail}` : ''}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {lead.tags.map((tag) => (
            <span
              key={tag}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${TAG_STYLES[tag] || "bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-500/30"}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Score Badge */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-white/5">
        <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-md ${badge.bg} ${badge.text} border ${badge.border}`}>
          Score: {lead.score}
        </span>
        <span className="text-gray-300 dark:text-gray-600 text-xs">|</span>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${badge.pill}`}>
          {badge.label}
        </span>
      </div>
    </div>
  );
}
