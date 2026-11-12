"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/icons";

const LINKS = [
  { href: "/", label: "Chat" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/audit", label: "Audit log" },
  { href: "/settings", label: "Policy" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white shadow-sm ring-1 ring-primary/20">
            <Icon name="shieldCheck" className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <span className="font-display text-base font-bold tracking-tight text-foreground sm:text-lg">
            LeashPay
          </span>
        </Link>

        <nav className="no-scrollbar -mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "shrink-0 whitespace-nowrap rounded-lg bg-primary-soft px-2.5 py-1.5 text-sm font-semibold text-primary transition-colors sm:px-3.5"
                    : "shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-slate-100 hover:text-foreground sm:px-3.5"
                }
              >
                {link.href === "/audit" ? (
                  <>
                    <span className="sm:hidden">Audit</span>
                    <span className="hidden sm:inline">Audit log</span>
                  </>
                ) : (
                  link.label
                )}
              </Link>
            );
          })}
        </nav>

        <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-line bg-canvas px-3 py-1 text-xs font-medium text-muted md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Demo wallet
        </span>
      </div>
    </header>
  );
}
