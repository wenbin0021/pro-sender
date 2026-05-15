"use client";

import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { AnimatedNumber } from "./animated-number";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  format,
  hint,
  index = 0,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  format?: (n: number) => string;
  hint?: string;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-5",
        "transition-colors duration-300 hover:border-primary/30",
      )}
    >
      {/* hover glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />

      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted ring-1 ring-inset ring-border transition-colors duration-300 group-hover:bg-primary/12 group-hover:ring-primary/25">
          <Icon
            className="h-4 w-4 text-muted-foreground transition-colors duration-300 group-hover:text-primary"
            strokeWidth={2}
          />
        </div>
      </div>

      <div className="mt-3 font-display text-[2rem] font-semibold leading-none tracking-tight tabular-nums">
        <AnimatedNumber value={value} format={format} />
      </div>

      {hint ? (
        <div className="mt-1.5 text-[12px] text-muted-foreground">{hint}</div>
      ) : null}
    </motion.div>
  );
}
