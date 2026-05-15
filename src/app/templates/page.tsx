"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { FilePlus, Hash } from "lucide-react";
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
import type { Template } from "@/lib/types";

// Renders a template body with {{placeholders}} visually highlighted.
function HighlightedBody({ body }: { body: string }) {
  const parts = body.split(/(\{\{\s*\w+\s*\}\})/g);
  return (
    <p className="text-[13px] leading-relaxed text-muted-foreground">
      {parts.map((part, i) =>
        /^\{\{\s*\w+\s*\}\}$/.test(part) ? (
          <span
            key={i}
            className="rounded bg-primary/12 px-1 font-mono text-[12px] text-primary"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", body: "" });

  function load() {
    apiGet<Template[]>("/api/templates").then(setTemplates).catch(() => {});
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost<Template>("/api/templates", form);
      toast.success(`Saved template "${form.name}"`);
      setForm({ name: "", body: "" });
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Message templates. Use {{name}} and {{phone}} placeholders — they are filled per recipient at send time."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button>
                  <FilePlus className="h-4 w-4" />
                  New template
                </Button>
              }
            />
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>New template</DialogTitle>
                  <DialogDescription>
                    Include a clear opt-out (e.g. &quot;Reply STOP to opt
                    out&quot;) to stay compliant.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Template name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="body">Message body</Label>
                    <Textarea
                      id="body"
                      rows={4}
                      value={form.body}
                      onChange={(e) => setForm({ ...form, body: e.target.value })}
                      placeholder="Hi {{name}}, ..."
                      required
                    />
                    <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {form.body.length} characters
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save template"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8">
        {templates.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No templates yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.45,
                  delay: i * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors duration-300 hover:border-primary/30"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold">{t.name}</h3>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted ring-1 ring-inset ring-border transition-colors duration-300 group-hover:bg-primary/12 group-hover:ring-primary/25">
                    <Hash
                      className="h-3.5 w-3.5 text-muted-foreground transition-colors duration-300 group-hover:text-primary"
                      strokeWidth={2}
                    />
                  </div>
                </div>
                <div className="mt-3 flex-1 rounded-lg border border-border bg-background/40 p-3">
                  <HighlightedBody body={t.body} />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-mono tabular-nums">
                    {t.body.length} chars
                  </span>
                  <span className="font-mono tabular-nums">
                    {Math.ceil(t.body.length / 160)} SMS segment(s)
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
