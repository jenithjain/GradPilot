"use client";

import { useEffect } from "react";

const STORAGE_KEY = "theme";

export default function ThemeInitializer() {
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEY);
      const resolvedTheme = savedTheme
        ? savedTheme
        : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

      document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    } catch {}
  }, []);

  return null;
}
