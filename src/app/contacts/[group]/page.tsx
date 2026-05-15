"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { motion } from "motion/react";
import { UserPlus, Upload, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiGet, apiPost } from "@/lib/api";
import { parsePhoneList } from "@/lib/phone";
import type { Contact } from "@/lib/types";

export default function GroupDetailPage() {
  const params = useParams<{ group: string }>();
  const group = decodeURIComponent(params.group);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [query, setQuery] = useState("");

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [numbersText, setNumbersText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    apiGet<Contact[]>(`/api/contacts?group=${encodeURIComponent(group)}`)
      .then((c) => {
        setContacts(c);
        setLoaded(true);
      })
      .catch(() => {
        setNotFound(true);
        setLoaded(true);
      });
  }

  useEffect(load, [group]);

  const { all, valid, invalid } = useMemo(
    () => parsePhoneList(numbersText),
    [numbersText],
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiPost<{
        imported: number;
        duplicates: number;
        invalid: number;
      }>("/api/contacts", { group, numbers: all });
      toast.success(
        `Added ${res.imported} number(s)` +
          (res.duplicates > 0 ? `, ${res.duplicates} already in group` : "") +
          (res.invalid > 0 ? `, ${res.invalid} invalid skipped` : ""),
      );
      setNumbersText("");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add numbers");
    } finally {
      setSaving(false);
    }
  }

  const filtered = contacts.filter((c) => {
    const q = query.toLowerCase();
    return (
      c.phone.toLowerCase().includes(q) ||
      (c.name ?? "").toLowerCase().includes(q)
    );
  });
  const subscribed = contacts.filter((c) => c.status === "subscribed").length;

  if (loaded && notFound) {
    return (
      <div>
        <PageHeader
          title="Group not found"
          description="This group does not exist."
          backHref="/contacts"
          backLabel="All groups"
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={group}
        description={`${contacts.length} number(s) · ${subscribed} subscribed`}
        backHref="/contacts"
        backLabel="All groups"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button>
                  <UserPlus className="h-4 w-4" />
                  Add numbers
                </Button>
              }
            />
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Add numbers to {group}</DialogTitle>
                  <DialogDescription>
                    Paste or upload phone numbers. Numbers already in this group
                    are skipped.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="numbers">Phone numbers</Label>
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
                    id="numbers"
                    rows={6}
                    value={numbersText}
                    onChange={(e) => setNumbersText(e.target.value)}
                    placeholder={"+6591234567\n+6598765432\n..."}
                    className="resize-none font-mono text-[12px]"
                    required
                  />
                  <div className="flex items-center gap-3 text-[12px]">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      <span className="font-mono tabular-nums text-foreground">
                        {valid.length}
                      </span>{" "}
                      valid
                    </span>
                    {invalid.length > 0 && (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                        <span className="font-mono tabular-nums text-warning">
                          {invalid.length}
                        </span>{" "}
                        invalid
                      </span>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving || valid.length === 0}>
                    {saving ? "Adding..." : "Add numbers"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search numbers..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 pl-8"
              />
            </div>
            <span className="text-[12px] text-muted-foreground">
              <span className="font-mono tabular-nums text-foreground">
                {contacts.length}
              </span>{" "}
              total
            </span>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                {["Phone", "Name", "Status", "Added"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-[13px] text-muted-foreground"
                  >
                    {contacts.length === 0
                      ? "No numbers in this group yet."
                      : "No numbers match your search."}
                  </td>
                </tr>
              ) : (
                filtered.map((c, i) => (
                  <tr
                    key={c.id}
                    style={{ animationDelay: `${Math.min(i, 14) * 22}ms` }}
                    className="border-b border-border/60 transition-colors duration-150 animate-in fade-in slide-in-from-bottom-1 last:border-0 hover:bg-accent/40"
                  >
                    <td className="px-4 py-2.5 font-mono text-[13px]">
                      {c.phone}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-muted-foreground">
                      {c.name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                      {new Date(c.createdAt).toLocaleDateString()}
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
