"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload,
  Zap,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  CircleAlert,
  Users,
  Users2,
  ScanSearch,
  FileBarChart2,
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
import type { Contact, HlrReport } from "@/lib/types";

// Mock billing rate — price charged per SMS segment. Swap for real
// provider/destination-based pricing when going live.
const CURRENCY = "SGD";
const PRICE_PER_SEGMENT = 0.0395;

// Plain English (GSM-7) fits 160 chars per SMS segment. Any non-ASCII
// character — e.g. Chinese — forces UCS-2 encoding, which fits only 70.
function smsSegments(text: string) {
  let isUnicode = false;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 127) {
      isUnicode = true;
      break;
    }
  }
  const perSegment = isUnicode ? 70 : 160;
  const segments = Math.max(1, Math.ceil(text.length / perSegment));
  return { isUnicode, perSegment, segments };
}

interface SendResult {
  id: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  invalid: number;
  unknown: number;
  senderId: string | null;
}

interface Group {
  name: string;
  count: number;
  subscribed: number;
  createdAt: string;
}

export default function SendNowPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [contactsText, setContactsText] = useState("");
  const [senderId, setSenderId] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  // Saved groups the user can pick recipients from, plus a cache of each
  // selected group's subscribed phone numbers.
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [groupNumbers, setGroupNumbers] = useState<Record<string, string[]>>({});

  // Saved HLR reports — selecting one sends to its filtered-valid numbers.
  const [hlrReports, setHlrReports] = useState<HlrReport[]>([]);
  const [selectedHlr, setSelectedHlr] = useState<string[]>([]);

  useEffect(() => {
    apiGet<Group[]>("/api/groups").then(setGroups).catch(() => {});
    apiGet<HlrReport[]>("/api/hlr/reports").then(setHlrReports).catch(() => {});
  }, []);

  async function toggleGroup(name: string) {
    if (selectedGroups.includes(name)) {
      setSelectedGroups((s) => s.filter((g) => g !== name));
      return;
    }
    setSelectedGroups((s) => [...s, name]);
    if (!groupNumbers[name]) {
      try {
        const contacts = await apiGet<Contact[]>(
          `/api/contacts?group=${encodeURIComponent(name)}`,
        );
        const phones = contacts
          .filter((c) => c.status === "subscribed")
          .map((c) => c.phone);
        setGroupNumbers((m) => ({ ...m, [name]: phones }));
      } catch {
        setSelectedGroups((s) => s.filter((g) => g !== name));
        toast.error(`Failed to load group "${name}"`);
      }
    }
  }

  const { all, valid, invalid } = useMemo(
    () => parsePhoneList(contactsText),
    [contactsText],
  );

  // Subscribed numbers contributed by the selected groups.
  const groupPhones = useMemo(() => {
    const s = new Set<string>();
    for (const g of selectedGroups)
      for (const p of groupNumbers[g] ?? []) s.add(p);
    return [...s];
  }, [selectedGroups, groupNumbers]);

  // Valid numbers contributed by the selected HLR reports.
  const hlrPhones = useMemo(() => {
    const s = new Set<string>();
    for (const id of selectedHlr) {
      const report = hlrReports.find((r) => r.id === id);
      if (!report) continue;
      for (const r of report.results) if (r.valid) s.add(r.phone);
    }
    return [...s];
  }, [selectedHlr, hlrReports]);

  // Deliverable = unique group + HLR-valid + valid manual numbers (count +
  // cost). submitList also includes invalid manual numbers so the report
  // counts them.
  const deliverable = useMemo(
    () => [...new Set([...groupPhones, ...hlrPhones, ...valid])],
    [groupPhones, hlrPhones, valid],
  );
  const submitList = useMemo(
    () => [...new Set([...groupPhones, ...hlrPhones, ...all])],
    [groupPhones, hlrPhones, all],
  );

  const charCount = message.length;
  const { isUnicode, perSegment, segments } = smsSegments(message);
  const totalCost = PRICE_PER_SEGMENT * segments * deliverable.length;
  const canProceed =
    name.trim().length > 0 &&
    message.trim().length > 0 &&
    deliverable.length > 0;

  async function toggleHlr(id: string) {
    setSelectedHlr((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setContactsText((prev) => (prev.trim() ? `${prev}\n${text}` : text));
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleConfirm() {
    setSending(true);
    try {
      const res = await apiPost<SendResult>("/api/send", {
        name: name.trim(),
        message: message.trim(),
        contacts: submitList,
        senderId: senderId.trim() || undefined,
      });
      setResult(res);
      toast.success(`Sent — ${res.sent} delivered, ${res.failed} failed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setStep(1);
    setName("");
    setMessage("");
    setContactsText("");
    setSenderId("");
    setSelectedGroups([]);
    setSelectedHlr([]);
    setResult(null);
  }

  return (
    <div>
      <PageHeader
        title="Send Now"
        description="One-off blast — write a message, pick saved groups or paste a number list, and confirm."
      />

      <div className="mx-auto max-w-3xl p-8">
        {/* Step indicator */}
        <div className="mb-8 flex items-center gap-3">
          {[
            { n: 1, label: "Compose" },
            { n: 2, label: "Review & send" },
          ].map((s, i) => {
            const active = step === s.n;
            const done = step > s.n || (result && s.n <= 2);
            return (
              <div key={s.n} className="flex items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold ring-1 ring-inset transition-colors",
                      active
                        ? "bg-primary/15 text-primary ring-primary/30"
                        : done
                          ? "bg-success/15 text-success ring-success/30"
                          : "bg-muted text-muted-foreground ring-border",
                    )}
                  >
                    {done && !active ? <Check className="h-3.5 w-3.5" /> : s.n}
                  </div>
                  <span
                    className={cn(
                      "text-[13px] font-medium transition-colors",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i === 0 && <div className="h-px w-10 bg-border sm:w-16" />}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {/* ───────────── STEP 1: COMPOSE ───────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              {/* Campaign name */}
              <section className="rounded-xl border border-border bg-card p-5">
                <Label htmlFor="campaign-name" className="text-[13px]">
                  Campaign name
                </Label>
                <Input
                  id="campaign-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. March promo blast"
                  className="mt-2"
                />
                <p className="mt-2 text-[12px] text-muted-foreground">
                  A label for this blast — it identifies the campaign in your
                  reports and message logs.
                </p>
              </section>

              {/* Message */}
              <section className="rounded-xl border border-border bg-card p-5">
                <Label htmlFor="message" className="text-[13px]">
                  Message
                </Label>
                <div className="relative mt-2">
                  <Textarea
                    id="message"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your SMS copy here..."
                    className="resize-none pb-7 font-sans"
                  />
                  {/* Live, language-aware character count, bottom-right of the box */}
                  <div className="pointer-events-none absolute bottom-2 right-3 font-mono text-[11px] tabular-nums text-muted-foreground">
                    <span className={cn(charCount > 0 && "text-foreground")}>
                      {charCount}
                    </span>
                    {" / "}
                    {perSegment} · {segments} SMS ·{" "}
                    <span className={cn(isUnicode && "text-warning")}>
                      {isUnicode ? "Unicode" : "GSM-7"}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  English (GSM-7) fits 160 chars per SMS; messages containing
                  Chinese or other non-ASCII characters switch to Unicode and
                  fit only 70 per SMS.
                </p>
              </section>

              {/* Recipients */}
              <section className="rounded-xl border border-border bg-card p-5">
                <Label className="text-[13px]">Recipients</Label>

                {/* Pick from saved groups */}
                {groups.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[12px] text-muted-foreground">
                      From saved groups
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
                              {g.subscribed}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pick from HLR reports — sends to filtered-valid numbers */}
                {hlrReports.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[12px] text-muted-foreground">
                      From HLR reports{" "}
                      <span className="text-muted-foreground/70">
                        (valid numbers only)
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {hlrReports.map((r) => {
                        const on = selectedHlr.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => toggleHlr(r.id)}
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
                              <ScanSearch className="h-3.5 w-3.5" />
                            )}
                            {r.name}
                            <span className="font-mono tabular-nums text-success">
                              {r.valid}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Paste / upload manually */}
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="contacts" className="text-[12px] font-normal text-muted-foreground">
                      {groups.length > 0 || hlrReports.length > 0
                        ? "Or add numbers manually"
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
                    id="contacts"
                    rows={6}
                    value={contactsText}
                    onChange={(e) => setContactsText(e.target.value)}
                    placeholder={"+6591234567\n+6598765432\n+6590001111\n..."}
                    className="mt-2 resize-none font-mono text-[12px]"
                  />
                </div>

                {/* Combined recipient summary */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="font-mono tabular-nums text-foreground">
                      {deliverable.length}
                    </span>
                    <span className="text-muted-foreground">
                      recipient{deliverable.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  {(selectedGroups.length > 0 || selectedHlr.length > 0) && (
                    <span className="text-muted-foreground tabular-nums">
                      {selectedGroups.length > 0 &&
                        `${selectedGroups.length} group${selectedGroups.length === 1 ? "" : "s"} · `}
                      {selectedHlr.length > 0 &&
                        `${selectedHlr.length} HLR report${selectedHlr.length === 1 ? "" : "s"} · `}
                      {valid.length} typed
                    </span>
                  )}
                  {invalid.length > 0 && (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                      <span className="font-mono tabular-nums text-warning">
                        {invalid.length}
                      </span>{" "}
                      invalid skipped
                    </span>
                  )}
                </div>
              </section>

              {/* Sender ID */}
              <section className="rounded-xl border border-border bg-card p-5">
                <Label htmlFor="senderId" className="text-[13px]">
                  Sender ID{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="senderId"
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  placeholder="e.g. ACME or 28140"
                  className="mt-2 max-w-xs"
                />
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Alphanumeric sender shown to recipients, where the provider
                  and destination country allow it. Left blank, the
                  provider&apos;s default number is used.
                </p>
              </section>

              <div className="flex justify-end">
                <Button
                  size="lg"
                  disabled={!canProceed}
                  onClick={() => setStep(2)}
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ───────────── STEP 2: REVIEW ───────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              {result ? (
                /* ── Success summary ── */
                <section className="rounded-xl border border-border bg-card p-8 text-center">
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 20 }}
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 ring-1 ring-inset ring-success/30"
                  >
                    <Check className="h-7 w-7 text-success" strokeWidth={2.5} />
                  </motion.div>
                  <h2 className="mt-4 font-display text-xl font-semibold">
                    Blast sent
                  </h2>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {result.total} number{result.total === 1 ? "" : "s"}{" "}
                    submitted — report generated
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2 text-[12px]">
                    {[
                      { label: "sent", value: result.sent, cls: "text-success" },
                      { label: "failed", value: result.failed, cls: "text-destructive" },
                      { label: "pending", value: result.pending, cls: "text-warning" },
                      { label: "invalid", value: result.invalid, cls: "text-chart-5" },
                      { label: "unknown", value: result.unknown, cls: "text-muted-foreground" },
                    ].map((s) => (
                      <span
                        key={s.label}
                        className="rounded-md border border-border bg-muted/50 px-2.5 py-1 font-mono tabular-nums"
                      >
                        <span className={cn("font-semibold", s.cls)}>
                          {s.value}
                        </span>{" "}
                        <span className="text-muted-foreground">{s.label}</span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-6 flex justify-center gap-3">
                    <Button
                      nativeButton={false}
                      render={<Link href="/report" />}
                    >
                      <FileBarChart2 className="h-4 w-4" />
                      View campaign report
                    </Button>
                    <Button variant="outline" onClick={reset}>
                      <Zap className="h-4 w-4" />
                      Send another
                    </Button>
                  </div>
                </section>
              ) : (
                <>
                  {/* Campaign name */}
                  <section className="rounded-xl border border-border bg-card p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Campaign
                    </div>
                    <div className="mt-1 text-[15px] font-semibold">
                      {name}
                    </div>
                  </section>

                  {/* Message review */}
                  <section className="rounded-xl border border-border bg-card p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Message
                    </div>
                    <div className="mt-2 rounded-lg border border-border bg-background/40 p-4">
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
                        {message}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px] text-muted-foreground tabular-nums">
                      <span>{charCount} chars</span>
                      <span>·</span>
                      <span>
                        {segments} SMS segment{segments === 1 ? "" : "s"}
                      </span>
                      <span>·</span>
                      <span className={cn(isUnicode && "text-warning")}>
                        {isUnicode
                          ? "Unicode 70/seg"
                          : "GSM-7 160/seg"}
                      </span>
                    </div>
                  </section>

                  {/* Sender + recipients */}
                  <div className="grid gap-5 sm:grid-cols-[1fr_1.4fr]">
                    <section className="rounded-xl border border-border bg-card p-5">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Sender ID
                      </div>
                      <div className="mt-2 font-mono text-[15px]">
                        {senderId.trim() || (
                          <span className="text-muted-foreground">
                            provider default
                          </span>
                        )}
                      </div>
                    </section>

                    <section className="rounded-xl border border-border bg-card p-5">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Recipients
                        </div>
                        <Users2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">
                        {deliverable.length}
                        <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">
                          number{deliverable.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {(selectedGroups.length > 0 ||
                        selectedHlr.length > 0) && (
                        <div className="mt-1 text-[12px] text-muted-foreground">
                          from{" "}
                          {[
                            ...selectedGroups,
                            ...selectedHlr.map(
                              (id) =>
                                hlrReports.find((r) => r.id === id)?.name ??
                                "HLR report",
                            ),
                          ].join(", ")}
                          {valid.length > 0 ? ` · ${valid.length} typed` : ""}
                        </div>
                      )}
                      <div className="mt-3 max-h-28 overflow-y-auto rounded-lg border border-border bg-background/40 p-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {deliverable.slice(0, 60).map((n) => (
                            <span
                              key={n}
                              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                            >
                              {n}
                            </span>
                          ))}
                          {deliverable.length > 60 && (
                            <span className="px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                              +{deliverable.length - 60} more
                            </span>
                          )}
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Estimated cost */}
                  <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/[0.05] p-5">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Total cost
                      </div>
                      <div className="mt-1.5 font-mono text-[12px] text-muted-foreground tabular-nums">
                        {deliverable.length} recipient
                        {deliverable.length === 1 ? "" : "s"} × {segments}{" "}
                        segment{segments === 1 ? "" : "s"} × {CURRENCY}{" "}
                        {PRICE_PER_SEGMENT.toFixed(4)}/seg
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-[28px] font-semibold leading-none tabular-nums text-primary">
                        {CURRENCY} {totalCost.toFixed(2)}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        mock rate · estimate only
                      </div>
                    </div>
                  </div>

                  {/* Confirm notice */}
                  <div className="flex items-start gap-2.5 rounded-lg border border-warning/25 bg-warning/[0.07] px-4 py-3">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <p className="text-[12px] text-muted-foreground">
                      This sends immediately to{" "}
                      <span className="font-medium text-foreground">
                        {deliverable.length}
                      </span>{" "}
                      number(s) via the <span className="font-mono">mock</span>{" "}
                      provider. Make sure every recipient has opted in.
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      onClick={() => setStep(1)}
                      disabled={sending}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <Button size="lg" onClick={handleConfirm} disabled={sending}>
                      {sending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          Confirm &amp; send {deliverable.length} message
                          {deliverable.length === 1 ? "" : "s"}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
