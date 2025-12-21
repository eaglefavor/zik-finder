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
  title: "Zik-Lodge Finder",
  description: "Find your next lodge at UNIZIK easily",
  manifest: "/manifest.json",
};

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
            <main className="min-h-screen pb-24">
              {children}
            </main>
            <BottomNav />
          </DataProvider>
        </AppProvider>
        <script src="//cdn.jsdelivr.net/npm/eruda"></script>
        <script dangerouslySetInnerHTML={{ __html: 'eruda.init();' }} />
      </body>
    </html>
  );
}
