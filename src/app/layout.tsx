import { Suspense } from "react";
import type { Metadata } from "next";
import Nav from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeashPay — Policy-gated shopping agent",
  description: "The AI proposes, the policy decides, you confirm.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-foreground antialiased">
        <Suspense fallback={<div className="h-14 border-b border-hairline" />}>
          <Nav />
        </Suspense>
        <main className="mx-auto w-full px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
