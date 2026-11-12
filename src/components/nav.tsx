"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/icons";

const LINKS = [
  { href: "/", label: "CHAT" },
  { href: "/dashboard", label: "DASHBOARD" },
  { href: "/audit", label: "AUDIT" },
  { href: "/settings", label: "POLICY" },
  { href: "/redteam", label: "RED TEAM" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full items-center gap-4 px-4 sm:gap-6 sm:px-6">
        {/* Wordmark + poster character */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="text-ink">
            <Icon name="leashDog" className="h-7 w-7" strokeWidth={1.5} />
          </span>
          <span
            className="text-xl font-medium tracking-[-0.02em] text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            LeashPay
          </span>
        </Link>

        {/* Ghost navigation links — mono, tracked-out, uppercase */}
        <nav className="no-scrollbar -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 text-[12px] font-normal tracking-[0.06em] transition-colors sm:px-3 ${
                  active
                    ? "text-ink"
                    : "text-ink/40 hover:text-ink"
                }`}
                style={{ fontFamily: "var(--font-mono-ui)" }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Status indicator with signal green dot */}
        <span className="hidden shrink-0 items-center gap-2 md:flex">
          <span className="flex items-center gap-1.5 text-[12px] tracking-[0.06em] text-ink/50" style={{ fontFamily: "var(--font-mono-ui)" }}>
            <span className="h-2 w-2 rounded-full bg-signal-green" />
            DEMO WALLET
          </span>
        </span>
      </div>
    </header>
  );
}
