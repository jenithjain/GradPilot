import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import BackgroundWrapper from "@/components/BackgroundWrapper";
import AuthProvider from "@/components/AuthProvider";
import ToastProvider from "@/components/ToastProvider";
import { ThemeProvider } from "next-themes";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "GradPilot - AI Voice Agent for Student Counselling",
  description: "AI-powered overseas education counselling platform with voice agents, lead qualification, and intelligent student engagement workflows",
};

export default function RootLayout({ children }) {
  // Render without server-derived class, and let the pre-hydration script
  // set the correct theme class. suppressHydrationWarning avoids mismatches.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Favicon and meta */}
        <link rel="icon" href="/gradpilot.svg" />
        <link rel="apple-touch-icon" href="/gradpilot.svg" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <ToastProvider />
            <BackgroundWrapper>
              {children}
            </BackgroundWrapper>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
