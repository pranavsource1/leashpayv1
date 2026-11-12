import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Nav from "@/components/nav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "LeashPay — Policy-gated shopping agent",
  description: "The AI proposes, the policy decides, you confirm.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-screen bg-canvas text-foreground antialiased">
        <Suspense fallback={<div className="h-16 border-b border-line bg-surface" />}>
          <Nav />
        </Suspense>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
