"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  RadialBar,
  RadialBarChart,
  PolarRadiusAxis,
  PolarGrid,
  Label,
} from "recharts";
import {
  Users,
  Send,
  MessageSquare,
  Activity,
  ArrowUpRight,
  Wallet,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { AnimatedNumber } from "@/components/animated-number";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { apiGet } from "@/lib/api";
import type { Campaign, MessageLog } from "@/lib/types";

interface Group {
  name: string;
  count: number;
  subscribed: number;
  createdAt: string;
}

const trendConfig: ChartConfig = {
  sent: { label: "Sent", color: "var(--chart-1)" },
  failed: { label: "Failed", color: "var(--chart-4)" },
};

function build7DayTrend(logs: MessageLog[]) {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    return {
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      sent: 0,
      failed: 0,
    };
  });
  const map = new Map(days.map((d) => [d.key, d]));
  for (const l of logs) {
    const day = map.get(l.createdAt.slice(0, 10));
    if (!day) continue;
    if (l.status === "sent") day.sent++;
    else if (l.status === "failed") day.failed++;
  }
  return days;
}

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    apiGet<Campaign[]>("/api/campaigns").then(setCampaigns).catch(() => {});
    apiGet<Group[]>("/api/groups").then(setGroups).catch(() => {});
    apiGet<MessageLog[]>("/api/logs").then(setLogs).catch(() => {});
    apiGet<{ balance: number }>("/api/balance")
      .then((b) => setBalance(b.balance))
      .catch(() => {});
  }, []);

  const totalSent = logs.filter((l) => l.status === "sent").length;
  const totalFailed = logs.filter((l) => l.status === "failed").length;
  const totalSubscribers = groups.reduce((s, g) => s + g.subscribed, 0);
  const deliveryRate =
    logs.length > 0 ? Math.round((totalSent / logs.length) * 100) : 0;

  const trend = build7DayTrend(logs);

  const radialData = [{ name: "rate", value: deliveryRate, fill: "var(--chart-1)" }];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your consent-based SMS campaigns and delivery health."
        action={
          <Button nativeButton={false} render={<Link href="/send" />}>
            <Send className="h-4 w-4" />
            New blast
          </Button>
        }
      />

      <div className="space-y-6 p-8">
        {/* Account balance */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] via-card to-card p-5"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-inset ring-primary/25">
              <Wallet className="h-6 w-6 text-primary" strokeWidth={2} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Account balance
              </div>
              <div className="mt-0.5 font-display text-[28px] font-semibold leading-none tabular-nums">
                <span className="text-muted-foreground">SGD </span>
                <AnimatedNumber value={balance} format={(n) => n.toFixed(2)} />
              </div>
            </div>
          </div>
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/payment" />}
          >
            <Plus className="h-4 w-4" />
            Top Up
          </Button>
        </motion.div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            index={0}
            label="Subscribers"
            value={totalSubscribers}
            icon={Users}
            hint="opted-in across all groups"
          />
          <StatCard
            index={1}
            label="Campaigns"
            value={campaigns.length}
            icon={Send}
            hint="total campaigns run"
          />
          <StatCard
            index={2}
            label="Messages sent"
            value={totalSent}
            icon={MessageSquare}
            hint={`${totalFailed} failed`}
          />
          <StatCard
            index={3}
            label="Delivery rate"
            value={deliveryRate}
            icon={Activity}
            format={(n) => `${Math.round(n)}%`}
            hint="sent ÷ total attempts"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-border bg-card p-5 lg:col-span-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold">Sending activity</h2>
                <p className="text-[12px] text-muted-foreground">
                  Sent vs. failed messages, last 7 days
                </p>
              </div>
              <div className="flex items-center gap-4 text-[12px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-chart-1" />
                  Sent
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-chart-4" />
                  Failed
                </span>
              </div>
            </div>

            <ChartContainer config={trendConfig} className="mt-4 h-[240px] w-full">
              <AreaChart data={trend} margin={{ left: 4, right: 4, top: 8 }}>
                <defs>
                  <linearGradient id="fillSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-sent)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-sent)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-failed)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-failed)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  className="text-[11px]"
                />
                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                <Area
                  dataKey="sent"
                  type="monotone"
                  stroke="var(--color-sent)"
                  strokeWidth={2}
                  fill="url(#fillSent)"
                />
                <Area
                  dataKey="failed"
                  type="monotone"
                  stroke="var(--color-failed)"
                  strokeWidth={2}
                  fill="url(#fillFailed)"
                />
              </AreaChart>
            </ChartContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col rounded-xl border border-border bg-card p-5"
          >
            <h2 className="text-[15px] font-semibold">Delivery rate</h2>
            <p className="text-[12px] text-muted-foreground">
              Across all campaigns
            </p>
            <ChartContainer
              config={{ value: { label: "Delivery rate" } }}
              className="mx-auto aspect-square w-full max-w-[220px]"
            >
              <RadialBarChart
                data={radialData}
                startAngle={90}
                endAngle={90 - (deliveryRate / 100) * 360}
                innerRadius={78}
                outerRadius={108}
              >
                <PolarGrid
                  gridType="circle"
                  radialLines={false}
                  stroke="none"
                  className="first:fill-muted"
                  polarRadius={[84, 72]}
                />
                <RadialBar dataKey="value" background cornerRadius={9} />
                <PolarRadiusAxis
                  tick={false}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                >
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !("cx" in viewBox)) return null;
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground font-display text-3xl font-semibold"
                          >
                            {deliveryRate}%
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 24}
                            className="fill-muted-foreground text-[11px]"
                          >
                            delivered
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </PolarRadiusAxis>
              </RadialBarChart>
            </ChartContainer>
            <div className="mt-auto grid grid-cols-2 gap-2 pt-2 text-center">
              <div className="rounded-lg bg-muted/50 py-2">
                <div className="font-display text-lg font-semibold tabular-nums text-success">
                  {totalSent}
                </div>
                <div className="text-[11px] text-muted-foreground">sent</div>
              </div>
              <div className="rounded-lg bg-muted/50 py-2">
                <div className="font-display text-lg font-semibold tabular-nums text-destructive">
                  {totalFailed}
                </div>
                <div className="text-[11px] text-muted-foreground">failed</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Lists */}
        <div className="grid gap-4 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-border bg-card"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="text-[15px] font-semibold">Recent campaigns</h2>
              <Link
                href="/report"
                className="flex items-center gap-0.5 text-[12px] text-muted-foreground transition-colors hover:text-primary"
              >
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {campaigns.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">
                  No campaigns yet.
                </p>
              ) : (
                campaigns.slice(0, 5).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">
                        {c.name}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {c.group}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                        {c.sent}/{c.total}
                      </span>
                      <span
                        className={
                          c.failed > 0
                            ? "rounded-md bg-warning/12 px-2 py-0.5 text-[11px] font-medium text-warning"
                            : "rounded-md bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success"
                        }
                      >
                        {c.failed > 0 ? `${c.failed} failed` : "clean"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.49, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-border bg-card"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="text-[15px] font-semibold">Contact groups</h2>
              <Link
                href="/contacts"
                className="flex items-center gap-0.5 text-[12px] text-muted-foreground transition-colors hover:text-primary"
              >
                Manage <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {groups.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">
                  No groups yet.
                </p>
              ) : (
                groups.map((g) => {
                  const max = Math.max(...groups.map((x) => x.count), 1);
                  return (
                    <div key={g.name} className="px-5 py-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[13px]">{g.name}</span>
                        <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                          {g.count}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(g.count / max) * 100}%` }}
                          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full bg-primary/70"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
