"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import KanbanBoard from "./components/KanbanBoard";

const AVATAR_OPTIONS = [
  "/avatars/hulk.png",
  "/avatars/ironman.png",
  "/avatars/thor.png",
  "/avatars/spiderman.png",
];

const INITIAL_FORM = {
  name: "",
  location: "",
  course: "",
  country: "",
  exam: "",
  examDetail: "",
  score: 50,
  status: "new",
  avatar: AVATAR_OPTIONS[0],
  notes: "",
  tags: [],
};

export default function CounsellorPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // RBAC: Only counsellors can access this page
  useEffect(() => {
    if (authStatus === 'authenticated' && session?.user?.role !== 'counsellor') {
      router.replace('/dashboard');
    }
  }, [session, authStatus, router]);

  // Listen for "openAddLeadModal" custom event from KanbanBoard
  useEffect(() => {
    const handler = () => setShowModal(true);
    window.addEventListener("openAddLeadModal", handler);
    return () => window.removeEventListener("openAddLeadModal", handler);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm(INITIAL_FORM);
        setShowModal(false);
        setRefreshKey((k) => k + 1);
      }
    } catch (err) {
      console.error("[AddLead] submit error:", err);
    } finally {
      setSubmitting(false);
    }
  }, [form]);

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const toggleTag = (tag) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  if (authStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (session?.user?.role !== 'counsellor') return null;

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4 py-6 sm:px-6 lg:px-8">
      <KanbanBoard key={refreshKey} />

      {/* Add Lead Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Close */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors z-10"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add New Lead</h2>

              {/* Avatar Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Avatar</label>
                <div className="flex gap-3">
                  {AVATAR_OPTIONS.map((src) => (
                    <button
                      type="button"
                      key={src}
                      onClick={() => updateField("avatar", src)}
                      className={`w-12 h-12 rounded-full overflow-hidden ring-2 transition-all ${form.avatar === src ? "ring-blue-500 scale-110" : "ring-transparent opacity-60 hover:opacity-100"}`}
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Name + Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Amit Sharma"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => updateField("location", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="India"
                  />
                </div>
              </div>

              {/* Country + Course */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Country</label>
                  <select
                    value={form.country}
                    onChange={(e) => updateField("country", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select</option>
                    <option value="UK">UK</option>
                    <option value="Ireland">Ireland</option>
                    <option value="USA">USA</option>
                    <option value="Canada">Canada</option>
                    <option value="Australia">Australia</option>
                    <option value="Germany">Germany</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Course</label>
                  <input
                    type="text"
                    value={form.course}
                    onChange={(e) => updateField("course", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="MSc Computer Science"
                  />
                </div>
              </div>

              {/* Exam + Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Exam</label>
                  <select
                    value={form.exam}
                    onChange={(e) => updateField("exam", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select</option>
                    <option value="IELTS">IELTS</option>
                    <option value="PTE">PTE</option>
                    <option value="TOEFL">TOEFL</option>
                    <option value="Duolingo">Duolingo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Preparing / 7.0 / Not Taken"
                  />
                </div>
              </div>

              {/* Score + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Lead Score: {form.score}</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={form.score}
                    onChange={(e) => updateField("score", parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => updateField("status", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="new">New Lead</option>
                    <option value="in_progress">In Progress</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {["Visa Approved", "Application Submitted", "Funding Query", "Scholarship"].map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        form.tags.includes(tag)
                          ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !form.name.trim()}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {submitting ? "Adding..." : "Add Lead"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
