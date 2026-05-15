"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Users, ChevronRight, FolderPlus, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
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

interface Group {
  name: string;
  count: number;
  subscribed: number;
  createdAt: string;
}

export default function ContactsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", numbersText: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    apiGet<Group[]>("/api/groups").then(setGroups).catch(() => {});
  }

  useEffect(load, []);

  const { all, valid, invalid } = useMemo(
    () => parsePhoneList(form.numbersText),
    [form.numbersText],
  );

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setForm((f) => ({
        ...f,
        numbersText: f.numbersText.trim()
          ? `${f.numbersText}\n${text}`
          : text,
      }));
      toast.success(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiPost<{ name: string; imported: number; invalid: number }>(
        "/api/groups",
        { name: form.name.trim(), numbers: all },
      );
      toast.success(
        `Created "${res.name}" — ${res.imported} number(s) imported` +
          (res.invalid > 0 ? `, ${res.invalid} invalid skipped` : ""),
      );
      setForm({ name: "", numbersText: "" });
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Phone numbers are organised into groups. Open a group to see its numbers."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button>
                  <FolderPlus className="h-4 w-4" />
                  Create group
                </Button>
              }
            />
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Create group</DialogTitle>
                  <DialogDescription>
                    Name the group and import the phone numbers that belong to
                    it. Only add numbers that have opted in.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-name">Group name</Label>
                    <Input
                      id="group-name"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="e.g. VIP customers"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="group-numbers">Phone numbers</Label>
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
                      id="group-numbers"
                      rows={6}
                      value={form.numbersText}
                      onChange={(e) =>
                        setForm({ ...form, numbersText: e.target.value })
                      }
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
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={saving || !form.name.trim() || valid.length === 0}
                  >
                    {saving ? "Creating..." : "Create group"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8">
        {groups.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            No groups yet. Create one to import phone numbers.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g, i) => (
              <motion.div
                key={g.name}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: i * 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <Link
                  href={`/contacts/${encodeURIComponent(g.name)}`}
                  className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors duration-300 hover:border-primary/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted ring-1 ring-inset ring-border transition-colors duration-300 group-hover:bg-primary/12 group-hover:ring-primary/25">
                      <Users
                        className="h-[18px] w-[18px] text-muted-foreground transition-colors duration-300 group-hover:text-primary"
                        strokeWidth={2}
                      />
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>
                  <h3 className="mt-3 text-[15px] font-semibold">{g.name}</h3>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[12px] text-muted-foreground tabular-nums">
                    <span className="text-foreground">{g.count}</span> numbers
                    <span className="text-border">·</span>
                    <span className="text-foreground">{g.subscribed}</span>{" "}
                    subscribed
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
