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
            <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-center text-xs font-bold py-1 z-[9999]">
              DEBUG MODE: v3 (If you see this, code is updated)
            </div>
            <main className="min-h-screen pb-24 pt-6">
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
