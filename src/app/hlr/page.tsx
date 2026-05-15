"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Upload,
  ScanSearch,
  Loader2,
  Download,
  Users,
  Check,
  Inbox,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { parsePhoneList } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { HlrResult, HlrReport, Contact } from "@/lib/types";

interface Group {
  name: string;
  count: number;
  subscribed: number;
  createdAt: string;
}

const RESULT_STYLE: Record<
  HlrResult["status"],
  { label: string; cls: string }
> = {
  active: { label: "Valid", cls: "bg-success/12 text-success ring-success/20" },
  absent: { label: "Absent", cls: "bg-warning/12 text-warning ring-warning/20" },
  invalid: {
    label: "Invalid",
    cls: "bg-destructive/12 text-destructive ring-destructive/25",
  },
};

export default function HlrLookupPage() {
  const [name, setName] = useState("");
  const [numbersText, setNumbersText] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [groupNumbers, setGroupNumbers] = useState<Record<string, string[]>>({});

  const [reports, setReports] = useState<HlrReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Group[]>("/api/groups").then(setGroups).catch(() => {});
    apiGet<HlrReport[]>("/api/hlr/reports")
      .then((rs) => {
        setReports(rs);
        if (rs.length > 0) setSelectedId(rs[0].id);
      })
      .catch(() => {});
  }, []);

  async function toggleGroup(g: string) {
    if (selectedGroups.includes(g)) {
      setSelectedGroups((s) => s.filter((x) => x !== g));
      return;
    }
    setSelectedGroups((s) => [...s, g]);
    if (!groupNumbers[g]) {
      try {
        const contacts = await apiGet<Contact[]>(
          `/api/contacts?group=${encodeURIComponent(g)}`,
        );
        setGroupNumbers((m) => ({ ...m, [g]: contacts.map((c) => c.phone) }));
      } catch {
        setSelectedGroups((s) => s.filter((x) => x !== g));
        toast.error(`Failed to load group "${g}"`);
      }
    }
  }

  const { all: manualAll } = useMemo(
    () => parsePhoneList(numbersText),
    [numbersText],
  );
  const groupPhones = useMemo(() => {
    const s = new Set<string>();
    for (const g of selectedGroups)
      for (const p of groupNumbers[g] ?? []) s.add(p);
    return [...s];
  }, [selectedGroups, groupNumbers]);
  const lookupList = useMemo(
    () => [...new Set([...groupPhones, ...manualAll])],
    [groupPhones, manualAll],
  );

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setNumbersText((prev) => (prev.trim() ? `${prev}\n${text}` : text));
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleLookup() {
    if (!name.trim()) {
      toast.error("Give this lookup a campaign name");
      return;
    }
    if (lookupList.length === 0) {
      toast.error("Add numbers or pick a group");
      return;
    }
    setLoading(true);
    try {
      const report = await apiPost<HlrReport>("/api/hlr", {
        name: name.trim(),
        numbers: lookupList,
      });
      setReports((rs) => [report, ...rs]);
      setSelectedId(report.id);
      setName("");
      setNumbersText("");
      setSelectedGroups([]);
      toast.success(
        `"${report.name}" — ${report.valid}/${report.total} valid`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "HLR lookup failed");
    } finally {
      setLoading(false);
    }
  }

  const selected = reports.find((r) => r.id === selectedId) ?? null;
  const summaryTiles = selected
    ? [
        { label: "Numbers", value: selected.total, cls: "text-foreground" },
        { label: "Valid", value: selected.valid, cls: "text-success" },
        { label: "Invalid", value: selected.invalid, cls: "text-destructive" },
        { label: "Absent", value: selected.absent, cls: "text-warning" },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="HLR Lookup"
        description="Validate phone numbers against the carrier's Home Location Register. Each named lookup is saved as an HLR report you can send to later."
      />

      <div className="space-y-6 p-8">
        {/* Lookup form */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="hlr-name" className="text-[13px]">
                Campaign name
              </Label>
              <Input
                id="hlr-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q3 leads cleanup"
              />
            </div>
          </div>

          {/* Pick from contact groups */}
          {groups.length > 0 && (
            <div className="mt-4">
              <div className="text-[12px] text-muted-foreground">
                Filter a contact group
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {groups.map((g) => {
                  const on = selectedGroups.includes(g.name);
                  return (
                    <button
                      key={g.name}
                      type="button"
                      onClick={() => toggleGroup(g.name)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                        on
                          ? "border-primary/40 bg-primary/12 text-foreground"
                          : "border-border bg-muted/40 text-muted-foreground hover:border-primary/25 hover:text-foreground",
                      )}
                    >
                      {on ? (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Users className="h-3.5 w-3.5" />
                      )}
                      {g.name}
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {g.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manual entry */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="hlr-numbers"
                className="text-[12px] font-normal text-muted-foreground"
              >
                {groups.length > 0
                  ? "Or paste numbers manually"
                  : "Paste or upload numbers"}
              </Label>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload .txt / .csv
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                className="hidden"
                onChange={handleFile}
              />
            </div>
            <Textarea
              id="hlr-numbers"
              rows={5}
              value={numbersText}
              onChange={(e) => setNumbersText(e.target.value)}
              placeholder={"+6591234567\n+6598765432\n+60123456789\n..."}
              className="mt-2 resize-none font-mono text-[12px]"
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-4">
            <span className="text-[12px] text-muted-foreground">
              <span className="font-mono tabular-nums text-foreground">
                {lookupList.length}
              </span>{" "}
              number{lookupList.length === 1 ? "" : "s"} ready to look up
              {selectedGroups.length > 0 && (
                <span className="ml-1">
                  · {selectedGroups.length} group
                  {selectedGroups.length === 1 ? "" : "s"}
                </span>
              )}
            </span>
            <Button
              size="lg"
              onClick={handleLookup}
              disabled={loading || lookupList.length === 0 || !name.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Looking up...
                </>
              ) : (
                <>
                  <ScanSearch className="h-4 w-4" />
                  Run HLR lookup
                </>
              )}
            </Button>
          </div>
        </section>

        {/* History + detail */}
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted ring-1 ring-inset ring-border">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-[14px] font-medium">No HLR reports yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Run a lookup above to create your first HLR report.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            {/* Report list */}
            <div className="h-fit overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3 text-[13px] font-semibold">
                HLR reports
              </div>
              <div className="max-h-[70vh] divide-y divide-border overflow-y-auto">
                {reports.map((r) => {
                  const active = r.id === selectedId;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors",
                        active ? "bg-accent/60" : "hover:bg-accent/30",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {active && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                        <span className="truncate text-[13px] font-medium">
                          {r.name}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {new Date(r.createdAt).toLocaleDateString()} · {r.total}{" "}
                        nums · {r.valid} valid
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
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-5">
                  <div>
                    <h2 className="text-[17px] font-semibold">
                      {selected.name}
                    </h2>
                    <p className="mt-1 font-mono text-[12px] text-muted-foreground">
                      {new Date(selected.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    nativeButton={false}
                    render={
                      <a href={`/api/hlr/export?id=${selected.id}`} />
                    }
                  >
                    <Download className="h-4 w-4" />
                    Download Excel
                  </Button>
                </div>

                {/* Summary tiles */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {summaryTiles.map((t, i) => (
                    <motion.div
                      key={t.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.4,
                        delay: i * 0.05,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="rounded-xl border border-border bg-card p-4"
                    >
                      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        {t.label}
                      </div>
                      <div
                        className={cn(
                          "mt-1.5 font-display text-2xl font-semibold tabular-nums",
                          t.cls,
                        )}
                      >
                        {t.value}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Report table */}
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="border-b border-border px-5 py-3.5 text-[15px] font-semibold">
                    Numbers
                    <span className="ml-2 font-mono text-[12px] font-normal text-muted-foreground tabular-nums">
                      {selected.results.length}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border text-left">
                          {[
                            "Phone",
                            "Result",
                            "Telco",
                            "Country",
                            "MCC / MNC",
                            "Ported",
                          ].map((h) => (
                            <th
                              key={h}
                              className="whitespace-nowrap px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selected.results.map((r, i) => {
                          const style = RESULT_STYLE[r.status];
                          return (
                            <tr
                              key={`${r.phone}-${i}`}
                              style={{
                                animationDelay: `${Math.min(i, 16) * 18}ms`,
                              }}
                              className="border-b border-border/60 transition-colors duration-150 animate-in fade-in slide-in-from-bottom-1 last:border-0 hover:bg-accent/40"
                            >
                              <td className="whitespace-nowrap px-5 py-2.5 font-mono text-[13px]">
                                {r.phone}
                              </td>
                              <td className="px-5 py-2.5">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                                    style.cls,
                                  )}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                  {style.label}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-5 py-2.5 text-[13px]">
                                {r.network ?? (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-5 py-2.5 text-[13px] text-muted-foreground">
                                {r.country ? (
                                  <>
                                    {r.country}{" "}
                                    <span className="font-mono text-[11px]">
                                      {r.countryCode}
                                    </span>
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="whitespace-nowrap px-5 py-2.5 font-mono text-[12px] text-muted-foreground">
                                {r.mccMnc ?? "—"}
                              </td>
                              <td className="px-5 py-2.5">
                                {r.network ? (
                                  r.ported ? (
                                    <span className="rounded-md bg-chart-5/12 px-2 py-0.5 text-[11px] font-medium text-chart-5 ring-1 ring-inset ring-chart-5/20">
                                      Ported
                                    </span>
                                  ) : (
                                    <span className="text-[12px] text-muted-foreground">
                                      No
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[12px] text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
