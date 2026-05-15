import type {
  SmsProvider,
  SendResult,
  SendOptions,
  BroadcastResult,
  BroadcastRecipientResult,
} from "./provider";

// MMDSmart / MessageWhiz SMS provider.
//
// API reference: https://sms.mmdsmart.com/api-doc
//
// Authentication: API key sent in the `apikey` request header.
// Send single SMS:    POST {base}/sms        -> { message_id }
// Send broadcast:     POST {base}/sms/broadcast -> { broadcast_id, ... }
// Per-message status: GET  {base}/sms/{id}
//
// The send endpoint only returns a message_id — actual delivery status arrives
// later via the optional webhook callback (see /api/webhook/sms). On a
// successful POST we therefore record the message as "pending" and let the
// webhook upgrade it to sent / failed.

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  defaultSender: string;
  callbackUrl?: string;
}

function readConfig(): ProviderConfig {
  const baseUrl = (
    process.env.MMDSMART_API_BASE_URL ?? "https://sms.mmdsmart.com"
  ).replace(/\/+$/, "");
  const apiKey = process.env.MMDSMART_API_KEY ?? "";
  const defaultSender = process.env.MMDSMART_DEFAULT_SENDER ?? "Signal";

  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, "");
  const callbackUrl = appBaseUrl ? `${appBaseUrl}/api/webhook/sms` : undefined;

  return { baseUrl, apiKey, defaultSender, callbackUrl };
}

// MessageWhiz numeric status codes -> our internal MessageLog status.
function mapStatusCode(code: unknown): SendResult["status"] {
  const n = typeof code === "number" ? code : Number(code);
  if (n === 2) return "sent"; // delivered
  if (n === 5 || n === 9 || n === 11) return "failed";
  if (n === -1) return "pending";
  return "unknown";
}

async function jsonRequest<T>(
  method: "POST" | "GET",
  url: string,
  apiKey: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      apikey: apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
    // Don't let Next.js cache provider calls.
    cache: "no-store",
  });

  // Try to parse JSON either way so we can surface the provider's error text.
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body — keep raw text in `data` */
    data = text;
  }

  if (!res.ok) {
    const message =
      (data &&
        typeof data === "object" &&
        "message" in data &&
        typeof (data as { message: unknown }).message === "string" &&
        (data as { message: string }).message) ||
      `HTTP ${res.status}`;
    throw new Error(`mmdsmart ${method} ${url}: ${message}`);
  }
  return data as T;
}

export class MmdsmartProvider implements SmsProvider {
  readonly name = "mmdsmart";

  async send(
    to: string,
    body: string,
    opts?: SendOptions,
  ): Promise<SendResult> {
    const config = readConfig();
    if (!config.apiKey) {
      return {
        providerMessageId: "",
        status: "failed",
        error: "MMDSMART_API_KEY is not set",
      };
    }

    try {
      const payload: Record<string, unknown> = {
        from: opts?.senderId ?? config.defaultSender,
        to,
        text: body,
      };
      if (opts?.clientRef) payload.client_ref = opts.clientRef;
      const callback = opts?.callbackUrl ?? config.callbackUrl;
      if (callback) payload.callback = callback;

      const data = await jsonRequest<{ message_id?: string; status?: number }>(
        "POST",
        `${config.baseUrl}/sms`,
        config.apiKey,
        payload,
      );

      return {
        providerMessageId: data.message_id ?? "",
        // The send endpoint only acknowledges acceptance — the real delivery
        // status lands on the webhook later. Treat the initial response as
        // pending unless the provider already returned a terminal status.
        status: data.status !== undefined ? mapStatusCode(data.status) : "pending",
      };
    } catch (err) {
      return {
        providerMessageId: "",
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown send error",
      };
    }
  }

  async sendBroadcast(
    to: string[],
    body: string,
    opts?: SendOptions,
  ): Promise<BroadcastResult> {
    const config = readConfig();
    if (!config.apiKey) {
      return {
        recipients: to.map<BroadcastRecipientResult>((phone) => ({
          phone,
          status: "failed",
          error: "MMDSMART_API_KEY is not set",
        })),
      };
    }

    try {
      const payload: Record<string, unknown> = {
        from: opts?.senderId ?? config.defaultSender,
        to,
        text: body,
      };
      if (opts?.clientRef) payload.client_ref = opts.clientRef;
      const callback = opts?.callbackUrl ?? config.callbackUrl;
      if (callback) payload.callback = callback;

      const data = await jsonRequest<{ broadcast_id?: string }>(
        "POST",
        `${config.baseUrl}/sms/broadcast`,
        config.apiKey,
        payload,
      );

      // Broadcast endpoint returns just a broadcast_id; per-recipient status
      // comes via webhook (or GET /sms/broadcast/{id}/messages later). Mark
      // every recipient pending for now.
      return {
        providerBroadcastId: data.broadcast_id,
        recipients: to.map<BroadcastRecipientResult>((phone) => ({
          phone,
          status: "pending",
        })),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown broadcast error";
      return {
        recipients: to.map<BroadcastRecipientResult>((phone) => ({
          phone,
          status: "failed",
          error: message,
        })),
      };
    }
  }
}
