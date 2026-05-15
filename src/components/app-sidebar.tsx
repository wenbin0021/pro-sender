"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  Users,
  FileText,
  FileBarChart2,
  ScrollText,
  ScanSearch,
  Radio,
  Zap,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/send", label: "Send Now", icon: Zap },
  { href: "/hlr", label: "HLR Lookup", icon: ScanSearch },
  { href: "/report", label: "Reports", icon: FileBarChart2 },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/logs", label: "Message Logs", icon: ScrollText },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // The login page is a standalone screen — hide the workspace chrome.
  if (pathname === "/login") return null;

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-primary/25">
          <Radio className="h-[18px] w-[18px] text-primary" strokeWidth={2.25} />
        </div>
        <div className="leading-tight">
          <div className="font-display text-[15px] font-semibold tracking-tight">
            Signal
          </div>
          <div className="text-[11px] font-medium text-muted-foreground">
            SMS Console
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
          Workspace
        </div>
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
              )}
            >
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-lg bg-sidebar-accent ring-1 ring-inset ring-primary/15"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              {active && (
                <motion.div
                  layoutId="nav-bar"
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon
                className={cn(
                  "relative z-10 h-[18px] w-[18px] transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
                strokeWidth={2}
              />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Provider status */}
      <div className="m-3 rounded-xl border border-sidebar-border bg-card/60 p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Provider
          </span>
          <span className="signal-dot inline-block h-1.5 w-1.5 rounded-full bg-success text-success" />
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="font-mono text-sm text-foreground">mock</span>
          <span className="text-[11px] text-muted-foreground">connected</span>
        </div>
      </div>

      {/* Logout */}
      <button
        type="button"
        onClick={handleLogout}
        className="mx-3 mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground"
      >
        <LogOut className="h-4 w-4" strokeWidth={2} />
        Sign out
      </button>
    </aside>
  );
}
