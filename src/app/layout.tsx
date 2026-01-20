import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/context";
import { DataProvider } from "@/lib/data-context";
import { ZipsProvider } from "@/lib/zips-context";
import BottomNav from "@/components/BottomNav";
import NetworkStatusIndicator from "@/components/NetworkStatusIndicator";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://zik-finder.vercel.app'),
  title: {
    default: "ZikLodge | Find Student Accommodation in Awka",
    template: "%s | ZikLodge"
  },
  description: "The easiest way to find and book lodges, apartments, and off-campus accommodation for UNIZIK students in Awka. Verified listings and direct landlord contact.",
  keywords: ["UNIZIK", "Awka", "Lodge", "Accommodation", "Student Housing", "Rent", "Apartment", "Real Estate", "Hostel", "Off-campus"],
  authors: [{ name: "ZikLodge Team" }],
  openGraph: {
    title: "ZikLodge | Find Student Accommodation in Awka",
    description: "Secure your perfect lodge today. Verified listings, direct landlord contact, and student-friendly prices.",
    url: 'https://zik-finder.vercel.app',
    siteName: 'ZikLodge',
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "ZikLodge | Home Starts Here",
    description: "Find your next lodge in Awka with ease.",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ZikLodge",
  },
};

export const viewport = {
  themeColor: "#2563eb",
};

import Script from 'next/script';

import { Toaster } from 'sonner';

import QueryProvider from "@/lib/query-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* ZIPS 3G: 0-RTT Resource Hints */}
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://wammuxdrpyhppdyhsxam.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://js.paystack.co" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900`}
      >
        <AppProvider>
          <QueryProvider>
            <DataProvider>
              <ZipsProvider>
                <NetworkStatusIndicator />
                <Toaster position="top-center" richColors />
                <main className="min-h-screen pb-24">
                  {children}
                </main>
                <div id="modal-root" />
                <BottomNav />
              </ZipsProvider>
            </DataProvider>
          </QueryProvider>
        </AppProvider>
        
        {/* Paystack Inline Script */}
        <Script src="https://js.paystack.co/v1/inline.js" strategy="afterInteractive" />

        {/* Eruda Debugger */}
        <Script src="//cdn.jsdelivr.net/npm/eruda" strategy="beforeInteractive" />
        <Script id="eruda-init" strategy="afterInteractive">
          {`if (typeof window !== 'undefined' && window.eruda) eruda.init();`}
        </Script>
      </body>
    </html>
  );
}
