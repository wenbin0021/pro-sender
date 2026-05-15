"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Wallet,
  Landmark,
  Bitcoin,
  Check,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

const PRESETS = [50, 100, 200, 500];

const METHODS = [
  {
    id: "toyyibpay" as const,
    name: "ToyyibPay",
    desc: "FPX online banking, cards & e-wallets",
    icon: Landmark,
  },
  {
    id: "crypto" as const,
    name: "Crypto",
    desc: "Pay with USDT, ETH or BTC",
    icon: Bitcoin,
  },
];

type Method = (typeof METHODS)[number]["id"];

interface TopupResult {
  amount: number;
  balance: number;
  method: string;
}

export default function PaymentPage() {
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method | null>(null);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState<TopupResult | null>(null);

  function loadBalance() {
    apiGet<{ balance: number }>("/api/balance")
      .then((b) => setBalance(b.balance))
      .catch(() => {});
  }

  useEffect(loadBalance, []);

  const amountNum = parseFloat(amount) || 0;
  const canProceed = amountNum > 0 && method !== null;

  async function handleProceed() {
    if (!canProceed) return;
    setProcessing(true);
    try {
      // A real integration hands off to the gateway here — redirect to the
      // ToyyibPay hosted bill or open a crypto checkout — and credits the
      // balance from the provider's webhook callback.
      const res = await apiPost<TopupResult>("/api/topup", {
        amount: amountNum,
        method,
      });
      setDone(res);
      setBalance(res.balance);
      toast.success(`Topped up SGD ${res.amount.toFixed(2)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Top up failed");
    } finally {
      setProcessing(false);
    }
  }

  function reset() {
    setAmount("");
    setMethod(null);
    setDone(null);
  }

  return (
    <div>
      <PageHeader
        title="Top Up"
        description="Add credit to your account to keep sending."
        backHref="/"
        backLabel="Dashboard"
      />

      <div className="mx-auto max-w-2xl space-y-5 p-8">
        {/* Current balance */}
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 ring-1 ring-inset ring-primary/25">
            <Wallet className="h-5 w-5 text-primary" strokeWidth={2} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Current balance
            </div>
            <div className="mt-0.5 font-display text-2xl font-semibold tabular-nums">
              <span className="text-muted-foreground">SGD </span>
              {balance.toFixed(2)}
            </div>
          </div>
        </div>

        {done ? (
          /* ── Success ── */
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-border bg-card p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 20 }}
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 ring-1 ring-inset ring-success/30"
            >
              <Check className="h-7 w-7 text-success" strokeWidth={2.5} />
            </motion.div>
            <h2 className="mt-4 font-display text-xl font-semibold">
              Top up successful
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              SGD {done.amount.toFixed(2)} added via {done.method} · new balance{" "}
              SGD {done.balance.toFixed(2)}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button nativeButton={false} render={<Link href="/" />}>
                Back to dashboard
              </Button>
              <Button variant="outline" onClick={reset}>
                Top up again
              </Button>
            </div>
          </motion.section>
        ) : (
          <>
            {/* Amount */}
            <section className="rounded-xl border border-border bg-card p-5">
              <Label htmlFor="amount" className="text-[13px]">
                Amount
              </Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(String(p))}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-[13px] font-medium tabular-nums transition-colors",
                      amountNum === p
                        ? "border-primary/40 bg-primary/12 text-foreground"
                        : "border-border bg-muted/40 text-muted-foreground hover:border-primary/25 hover:text-foreground",
                    )}
                  >
                    SGD {p}
                  </button>
                ))}
              </div>
              <div className="relative mt-3">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-muted-foreground">
                  SGD
                </span>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Custom amount"
                  className="pl-12 font-mono tabular-nums"
                />
              </div>
            </section>

            {/* Payment method */}
            <section className="rounded-xl border border-border bg-card p-5">
              <Label className="text-[13px]">Payment method</Label>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3.5 text-left transition-colors",
                        active
                          ? "border-primary/40 bg-primary/[0.07]"
                          : "border-border bg-muted/30 hover:border-primary/25",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-colors",
                          active
                            ? "bg-primary/15 text-primary ring-primary/25"
                            : "bg-muted text-muted-foreground ring-border",
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                          {m.name}
                          {active && (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          )}
                        </div>
                        <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                          {m.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Summary + proceed */}
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">
                  You are topping up
                </span>
                <span className="font-display text-xl font-semibold tabular-nums">
                  SGD {amountNum.toFixed(2)}
                </span>
              </div>
              <Button
                size="lg"
                className="mt-4 w-full"
                onClick={handleProceed}
                disabled={!canProceed || processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Proceed to payment
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
                Demo mode — balance is credited immediately. Wire the ToyyibPay
                / crypto checkout into this step for production.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
