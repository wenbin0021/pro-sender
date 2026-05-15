import { addBalance } from "@/lib/store";

const METHODS = ["toyyibpay", "crypto"] as const;

// POST /api/topup — credit the account balance.
//
// MOCK: a real integration would hand off to the payment provider here —
// redirect to the ToyyibPay hosted bill / FPX page, or open a crypto
// checkout — and only credit the balance once the gateway confirms payment
// via its webhook callback. For now the balance is credited immediately so
// the flow is demoable end-to-end.
export async function POST(request: Request) {
  const body = await request.json();
  const amount = Number(body.amount);
  const method = String(body.method ?? "");

  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "amount must be a positive number" }, { status: 400 });
  }
  if (!METHODS.includes(method as (typeof METHODS)[number])) {
    return Response.json({ error: "unsupported payment method" }, { status: 400 });
  }

  const balance = addBalance(amount);
  return Response.json({ balance, amount, method });
}
