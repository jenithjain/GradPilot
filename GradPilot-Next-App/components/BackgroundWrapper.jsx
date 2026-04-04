"use client";

import { useState, useEffect } from "react";
import LiquidEther from "./LiquidEther";

export default function BackgroundWrapper({ children }) {
  const [colors, setColors] = useState(['#5227FF', '#FF9FFC', '#B19EEF']);
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    // Set initial colors based on theme
    const updateColors = () => {
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark) {
        setColors(['#5227FF', '#FF9FFC', '#B19EEF']);
      } else {
        setColors(['#ffffff', '#f1f5f9', '#e2e8f0']);
      }
    };

    updateColors();

    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Detect mobile and reduced-motion preference
    const mobileQuery = window.matchMedia('(max-width: 768px)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    setIsMobile(mobileQuery.matches);
    setPrefersReduced(motionQuery.matches);

    const handleMobile = (e) => setIsMobile(e.matches);
    const handleMotion = (e) => setPrefersReduced(e.matches);

    mobileQuery.addEventListener('change', handleMobile);
    motionQuery.addEventListener('change', handleMotion);

    return () => {
      observer.disconnect();
      mobileQuery.removeEventListener('change', handleMobile);
      motionQuery.removeEventListener('change', handleMotion);
    };
  }, []);

  return (
    <>
      {/* Fixed background layer - does not block clicks */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ willChange: 'transform' }}>
        {prefersReduced ? (
          /* Static gradient fallback for prefers-reduced-motion */
          <div className="w-full h-full bg-linear-to-br from-slate-100 via-slate-50 to-white dark:from-indigo-950 dark:via-purple-950 dark:to-slate-950" />
        ) : (
          <LiquidEther
            colors={colors}
            mouseForce={10}
            cursorSize={100}
            isViscous={false}
            viscous={30}
            iterationsViscous={isMobile ? 8 : 16}
            iterationsPoisson={isMobile ? 8 : 16}
            resolution={isMobile ? 0.25 : 0.4}
            isBounce={false}
            autoDemo={!isMobile}
            autoSpeed={0.5}
            autoIntensity={2.2}
            takeoverDuration={0.25}
            autoResumeDelay={3000}
            autoRampDuration={0.6}
            inputTarget="document"
          />
        )}
      </div>

      {/* Content layer */}
      <div className="relative z-10 min-h-screen w-full">
        {children}
      </div>
    </>
  );
}
