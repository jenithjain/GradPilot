"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import StaggeredMenu from "@/components/StaggeredMenu";

export default function DashboardLayout({ children }) {
  const { data: session } = useSession();
  const [menuBtnColor, setMenuBtnColor] = useState('#000000');

  useEffect(() => {
    // Set initial color
    const updateColor = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setMenuBtnColor(isDark ? '#ffffff' : '#000000');
    };
    
    updateColor();
    
    // Watch for theme changes
    const observer = new MutationObserver(updateColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const role = session?.user?.role;

  const navItems = role === 'counsellor'
    ? [
        { label: "Dashboard", link: "/dashboard/counsellor", ariaLabel: "Counsellor Dashboard" },
        { label: "Campaign AI", link: "/campaign", ariaLabel: "AI Campaign Generator" },
      ]
    : [
        { label: "Dashboard", link: "/dashboard", ariaLabel: "Student Dashboard" },
      ];

  return (
    <>
      {/* Navbar */}
      <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <StaggeredMenu
            position="right"
            isFixed={true}
            logoUrl="/gradpilot.svg"
            accentColor="#22c55e"
            colors={["#0f172a", "#111827", "#1f2937"]}
            menuButtonColor={menuBtnColor}
            openMenuButtonColor="#22c55e"
            items={navItems}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-20">
        {children}
      </main>
    </>
  );
}
