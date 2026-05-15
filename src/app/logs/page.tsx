"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api";
import type { MessageLog } from "@/lib/types";

export default function LogsPage() {
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiGet<MessageLog[]>("/api/logs").then(setLogs).catch(() => {});
  }, []);

  const filtered = logs.filter((l) => {
    const q = query.toLowerCase();
    return (
      l.contactName.toLowerCase().includes(q) ||
      l.phone.toLowerCase().includes(q) ||
      l.status.toLowerCase().includes(q)
    );
  });

  const sent = logs.filter((l) => l.status === "sent").length;
  const failed = logs.filter((l) => l.status === "failed").length;

  return (
    <div>
      <PageHeader
        title="Message Logs"
        description="Per-message delivery records across all campaigns."
      />

      <div className="p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter by name, phone, status..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 pl-8"
              />
            </div>
            <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="font-mono tabular-nums text-foreground">
                  {sent}
                </span>{" "}
                sent
              </span>
              <span className="h-3 w-px bg-border" />
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                <span className="font-mono tabular-nums text-foreground">
                  {failed}
                </span>{" "}
                failed
              </span>
            </div>
          </div>

          {/* Table */}
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                {["Sent at", "Recipient", "Phone", "Message", "Status"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-[13px] text-muted-foreground"
                  >
                    {logs.length === 0
                      ? "No messages sent yet. Run a campaign first."
                      : "No messages match your filter."}
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 100).map((l, i) => (
                  <tr
                    key={l.id}
                    style={{ animationDelay: `${Math.min(i, 14) * 22}ms` }}
                    className="border-b border-border/60 transition-colors duration-150 animate-in fade-in slide-in-from-bottom-1 last:border-0 hover:bg-accent/40"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                      {new Date(l.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] font-medium">
                      {l.contactName}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-muted-foreground">
                      {l.phone}
                    </td>
                    <td className="max-w-md px-4 py-2.5">
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {l.body}
                      </span>
                      {l.status === "failed" && l.error ? (
                        <span className="text-[11px] text-destructive">
                          {l.error}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={l.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </motion.div>
      </div>
    </div>
  );
}
