import { updateLogByProviderId } from "@/lib/store";
import type { MessageStatus } from "@/lib/types";

// Delivery-receipt webhook for the MMDSmart / MessageWhiz provider.
//
// MessageWhiz POSTs an update per message once the carrier reports back. We
// take the message_id from the body, look up the corresponding MessageLog by
// its providerMessageId, and patch its status.
//
// Status code reference (from /api-doc):
//   -1 pending   2 delivered   5 undelivered   9 failed   11 no balance
//
// Optional shared-secret auth via MMDSMART_WEBHOOK_SECRET — when set, the
// X-Webhook-Secret header must match or the request is rejected with 401.

function mapStatusCode(code: unknown): MessageStatus | null {
  const n = typeof code === "number" ? code : Number(code);
  if (n === 2) return "sent";
  if (n === 5 || n === 9 || n === 11) return "failed";
  if (n === -1) return "pending";
  return null;
}

function errorMessageForCode(code: unknown): string | undefined {
  const n = typeof code === "number" ? code : Number(code);
  if (n === 5) return "Undelivered";
  if (n === 9) return "Carrier rejected message";
  if (n === 11) return "Insufficient balance";
  return undefined;
}

export async function POST(request: Request) {
  const expectedSecret = process.env.MMDSMART_WEBHOOK_SECRET;
  if (expectedSecret) {
    const provided = request.headers.get("x-webhook-secret");
    if (provided !== expectedSecret) {
      return Response.json({ error: "invalid secret" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  // The provider may send either a single update or an array of them.
  const updates = Array.isArray(body) ? body : [body];

  let matched = 0;
  for (const u of updates) {
    if (!u || typeof u !== "object") continue;
    const obj = u as Record<string, unknown>;
    const messageId = String(obj.message_id ?? obj.id ?? "");
    const status = mapStatusCode(obj.status);
    if (!messageId || !status) continue;

    const ok = updateLogByProviderId(messageId, {
      status,
      error: errorMessageForCode(obj.status),
    });
    if (ok) matched++;
  }

  return Response.json({ received: updates.length, matched });
}

// Some webhook providers probe the URL with GET first to verify it's live.
export async function GET() {
  return Response.json({ ok: true });
}
