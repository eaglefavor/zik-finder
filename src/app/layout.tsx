import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/context";
import { DataProvider } from "@/lib/data-context";
import BottomNav from "@/components/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZikLodge",
  description: "Home Starts Here",
  manifest: "/manifest.json",
};

import Script from 'next/script';

import { Toaster } from 'sonner';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900`}
      >
        <AppProvider>
          <DataProvider>
            <Toaster position="top-center" richColors />
            <main className="min-h-screen pb-24">
              {children}
            </main>
            <BottomNav />
          </DataProvider>
        </AppProvider>
        <Script src="//cdn.jsdelivr.net/npm/eruda" strategy="lazyOnload" />
        <Script id="eruda-init" strategy="lazyOnload">
          {`eruda.init();`}
        </Script>
      </body>
    </html>
  );
}
