import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Cekatan",
    template: "%s - Cekatan",
  },
  description: "Platform asesmen & pemetaan kompetensi",
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    siteName: "Cekatan",
    title: "Cekatan",
    description: "Platform asesmen & pemetaan kompetensi",
  },
  twitter: {
    card: "summary",
    title: "Cekatan",
    description: "Platform asesmen & pemetaan kompetensi",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cekatan",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-screen`}
      >
        <ThemeProvider>
          {children}
          <InstallBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
