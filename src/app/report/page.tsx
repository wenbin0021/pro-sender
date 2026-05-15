"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Download, FileText, Inbox } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Campaign, MessageLog } from "@/lib/types";

const BREAKDOWN = [
  { key: "sent", label: "Sent", text: "text-success", bar: "bg-success" },
  { key: "failed", label: "Failed", text: "text-destructive", bar: "bg-destructive" },
  { key: "pending", label: "Pending", text: "text-warning", bar: "bg-warning" },
  { key: "invalid", label: "Invalid number", text: "text-chart-5", bar: "bg-chart-5" },
  { key: "unknown", label: "Unknown", text: "text-muted-foreground", bar: "bg-muted-foreground" },
] as const;

export default function ReportPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<MessageLog[]>([]);

  useEffect(() => {
    apiGet<Campaign[]>("/api/campaigns")
      .then((cs) => {
        setCampaigns(cs);
        if (cs.length > 0) setSelectedId(cs[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    apiGet<MessageLog[]>(`/api/logs?campaignId=${selectedId}`)
      .then(setLogs)
      .catch(() => {});
  }, [selectedId]);

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Per-campaign delivery report — outcome breakdown for every send, exportable to Excel."
      />

      <div className="p-8">
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted ring-1 ring-inset ring-border">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-[14px] font-medium">No reports yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Submit a blast from Send Now to generate your first report.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            {/* Report list */}
            <div className="h-fit overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3 text-[13px] font-semibold">
                Campaign reports
              </div>
              <div className="max-h-[72vh] divide-y divide-border overflow-y-auto">
                {campaigns.map((c) => {
                  const active = c.id === selectedId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors",
                        active
                          ? "bg-accent/60"
                          : "hover:bg-accent/30",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {active && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                        <span className="truncate text-[13px] font-medium">
                          {c.name}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {new Date(c.createdAt).toLocaleDateString()} ·{" "}
                        {c.total} numbers
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Report detail */}
            {selected && (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                {/* Header card */}
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h2 className="truncate text-[17px] font-semibold">
                          {selected.name}
                        </h2>
                        <StatusPill status={selected.status} />
                      </div>
                      <p className="mt-1 font-mono text-[12px] text-muted-foreground">
                        {new Date(selected.createdAt).toLocaleString()} ·
                        sender:{" "}
                        {selected.senderId ?? "provider default"}
                      </p>
                    </div>
                    <Button
                      nativeButton={false}
                      render={
                        <a
                          href={`/api/report/download?campaignId=${selected.id}`}
                        />
                      }
                    >
                      <Download className="h-4 w-4" />
                      Download Excel
                    </Button>
                  </div>

                  {/* Message content */}
                  <div className="mt-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      Message content
                    </div>
                    <div className="mt-2 rounded-lg border border-border bg-background/40 p-4">
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
                        {selected.message ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Outcome stat tiles */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <StatTile
                    label="Total numbers"
                    value={selected.total}
                    text="text-foreground"
                    index={0}
                  />
                  {BREAKDOWN.map((b, i) => (
                    <StatTile
                      key={b.key}
                      label={b.label}
                      value={selected[b.key]}
                      text={b.text}
                      index={i + 1}
                    />
                  ))}
                </div>

                {/* Breakdown bar */}
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Outcome distribution
                  </div>
                  <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted">
                    {BREAKDOWN.map((b) => {
                      const pct =
                        selected.total > 0
                          ? (selected[b.key] / selected.total) * 100
                          : 0;
                      if (pct === 0) return null;
                      return (
                        <motion.div
                          key={b.key}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                          className={b.bar}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                    {BREAKDOWN.map((b) => (
                      <span
                        key={b.key}
                        className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
                      >
                        <span
                          className={cn("h-2 w-2 rounded-full", b.bar)}
                        />
                        {b.label}
                        <span className="font-mono tabular-nums text-foreground">
                          {selected[b.key]}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Recipients table */}
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="border-b border-border px-5 py-3.5 text-[15px] font-semibold">
                    Recipients
                    <span className="ml-2 font-mono text-[12px] font-normal text-muted-foreground tabular-nums">
                      {logs.length}
                    </span>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-left">
                        {["Phone", "Status", "Detail", "Sent at"].map((h) => (
                          <th
                            key={h}
                            className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-5 py-10 text-center text-[13px] text-muted-foreground"
                          >
                            No recipient records.
                          </td>
                        </tr>
                      ) : (
                        logs.slice(0, 200).map((l, i) => (
                          <tr
                            key={l.id}
                            style={{
                              animationDelay: `${Math.min(i, 14) * 20}ms`,
                            }}
                            className="border-b border-border/60 transition-colors duration-150 animate-in fade-in slide-in-from-bottom-1 last:border-0 hover:bg-accent/40"
                          >
                            <td className="px-5 py-2.5 font-mono text-[12px]">
                              {l.phone}
                            </td>
                            <td className="px-5 py-2.5">
                              <StatusPill status={l.status} />
                            </td>
                            <td className="px-5 py-2.5 text-[12px] text-muted-foreground">
                              {l.error ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-5 py-2.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                              {new Date(l.createdAt).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  text,
  index,
}: {
  label: string;
  value: number;
  text: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 font-display text-2xl font-semibold tabular-nums",
          text,
        )}
      >
        {value}
      </div>
    </motion.div>
  );
}
