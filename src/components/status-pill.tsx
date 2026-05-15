import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "muted";

const TONE: Record<Tone, string> = {
  success: "bg-success/12 text-success ring-success/20",
  warning: "bg-warning/12 text-warning ring-warning/20",
  danger: "bg-destructive/12 text-destructive ring-destructive/25",
  muted: "bg-muted text-muted-foreground ring-border",
};

const STATUS_TONE: Record<string, Tone> = {
  subscribed: "success",
  sent: "success",
  completed: "success",
  unsubscribed: "muted",
  draft: "muted",
  unknown: "muted",
  failed: "danger",
  invalid: "danger",
  sending: "warning",
  pending: "warning",
};

export function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "muted";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        TONE[tone],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
