"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import StaggeredMenu from "@/components/StaggeredMenu";

export default function CampaignLayout({ children }) {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [menuBtnColor, setMenuBtnColor] = useState('#000000');

  // RBAC: Only counsellors can access Campaign AI
  useEffect(() => {
    if (authStatus === 'authenticated' && session?.user?.role !== 'counsellor') {
      router.replace('/dashboard');
    }
  }, [session, authStatus, router]);

  useEffect(() => {
    const updateColor = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setMenuBtnColor(isDark ? '#ffffff' : '#000000');
    };
    
    updateColor();
    
    const observer = new MutationObserver(updateColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  if (authStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (authStatus === 'authenticated' && session?.user?.role !== 'counsellor') return null;

  const hideMenu = pathname.endsWith('/campaign/canvas');

  return (
    <>
      {!hideMenu && (
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
              items={[
                { label: "Dashboard", link: "/dashboard/counsellor", ariaLabel: "Counsellor Dashboard" },
                { label: "Campaign AI", link: "/campaign", ariaLabel: "AI Campaign Generator" },
              ]}
            />
          </div>
        </div>
      )}

      <main>
        {children}
      </main>
    </>
  );
}
