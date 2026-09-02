"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  IconHome, IconLayers, IconSearch, IconColumns, IconBuilding,
  IconMic, IconUsers, IconChart, IconSettings, IconSun, IconMoon, IconSparkle,
} from "./icons";

const LINKS = [
  { href: "/", label: "Command", icon: IconHome, exact: true },
  { href: "/experience", label: "Experience", icon: IconLayers },
  { href: "/jobs", label: "Jobs", icon: IconSearch },
  { href: "/pipeline", label: "Pipeline", icon: IconColumns },
  { href: "/companies", label: "Companies", icon: IconBuilding },
  { href: "/interview", label: "Interview", icon: IconMic },
  { href: "/contacts", label: "Contacts", icon: IconUsers },
  { href: "/analytics", label: "Analytics", icon: IconChart },
];

export function Nav({ aiMode, pendingBridge }: { aiMode: "API" | "BRIDGE"; pendingBridge: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-[196px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--panel)]">
      <div className="flex items-center gap-2 px-4 pb-3 pt-4">
        <div
          className="grid size-7 shrink-0 place-items-center rounded-md text-white"
          style={{ background: "var(--accent)" }}
        >
          <IconTargetMark />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-semibold">Job Engine</div>
          <div className="truncate text-[10px] text-[var(--muted)]">local · private</div>
        </div>
      </div>

      <ul className="flex flex-1 flex-col gap-0.5 px-2 py-2">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors",
                  active
                    ? "bg-[var(--accent-soft)] font-medium text-[var(--ink)]"
                    : "text-[var(--ink-2)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
                )}
              >
                <Icon size={15} className={active ? "text-[var(--accent)]" : "text-[var(--muted)]"} />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-[var(--line)] px-2 py-2">
        <Link
          href="/settings"
          className={cn(
            "mb-1 flex items-center justify-between gap-2 rounded-md px-2.5 py-[7px] text-[12px] transition-colors",
            pathname.startsWith("/settings")
              ? "bg-[var(--accent-soft)] font-medium"
              : "text-[var(--ink-2)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
          )}
        >
          <span className="flex items-center gap-2.5">
            <IconSettings size={15} className="text-[var(--muted)]" />
            Settings
          </span>
          {pendingBridge > 0 && (
            <span
              className="tnum rounded px-1 text-[10px] font-semibold text-white"
              style={{ background: "var(--serious)" }}
              title={`${pendingBridge} AI prompt${pendingBridge === 1 ? "" : "s"} awaiting a pasted response`}
            >
              {pendingBridge}
            </span>
          )}
        </Link>

        <div className="flex items-center justify-between gap-2 px-2.5 py-1">
          <span
            className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]"
            title={
              aiMode === "API"
                ? "An API key is set — AI actions run in one click."
                : "No API key — AI actions produce a prompt to paste into Claude."
            }
          >
            <IconSparkle size={12} style={{ color: aiMode === "API" ? "var(--good)" : "var(--muted)" }} />
            {aiMode === "API" ? "AI: connected" : "AI: bridge"}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

function IconTargetMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M12 21V10" strokeLinecap="round" />
      <path d="M12 10 5 6.5V13l7 3.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="m12 10 7-3.5V13l-7 3.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="12" cy="5" r="2.2" />
    </svg>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      document.documentElement.dataset.theme = stored;
    } else {
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem("theme", next);
    } catch {
      // Private browsing can throw on write; the toggle still works for the session.
    }
  }

  return (
    <button
      onClick={toggle}
      className="grid size-6 place-items-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      aria-label="Toggle colour theme"
    >
      {theme === "dark" ? <IconSun size={14} /> : <IconMoon size={14} />}
    </button>
  );
}
