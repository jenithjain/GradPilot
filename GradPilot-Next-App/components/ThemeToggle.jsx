"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle({ className = "" }) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only render after client mount
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle dark mode"
      className={`inline-flex items-center gap-2 rounded-full border border-slate-200/30 bg-white/10 px-3 py-1 text-sm text-slate-900 dark:text-white backdrop-blur hover:bg-white/20 transition-colors dark:border-slate-700/60 ${className}`}
    >
      <span className="inline-block h-4 w-4 rounded-full bg-yellow-400 dark:hidden" />
      <span className="hidden h-4 w-4 rounded-full bg-emerald-500 dark:inline-block" />
      <span className="hidden sm:inline">{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}
