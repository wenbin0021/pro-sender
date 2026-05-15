// SMS provider abstraction.
//
// Every concrete provider (mock, MMDSmart/MessageWhiz, Twilio, ...) implements
// this interface. The rest of the app only depends on `SmsProvider`, so
// swapping providers is a one-line change in `getProvider()`.

export interface SendResult {
  providerMessageId: string;
  // A valid number can still come back failed/pending/unknown depending on
  // what the carrier reports. "invalid" is decided before send, so it is not
  // a possible provider result.
  status: "sent" | "failed" | "pending" | "unknown";
  error?: string;
}

export interface BroadcastRecipientResult {
  phone: string;
  providerMessageId?: string;
  status: "sent" | "failed" | "pending" | "unknown";
  error?: string;
}

export interface BroadcastResult {
  // Provider-side broadcast/campaign id, if returned.
  providerBroadcastId?: string;
  // Per-recipient outcome, in the same order as the input phones.
  recipients: BroadcastRecipientResult[];
}

export interface SendOptions {
  // Alphanumeric or numeric sender ID shown to the recipient, where the
  // provider/country supports it.
  senderId?: string;
  // Optional client-side reference echoed back in delivery webhooks. Used to
  // correlate provider messages with our MessageLog rows.
  clientRef?: string;
  // Optional webhook URL the provider should POST status updates to.
  callbackUrl?: string;
}

export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string, opts?: SendOptions): Promise<SendResult>;
  // Optional bulk endpoint. Providers that don't support a real broadcast
  // operation can omit this — the caller will fall back to looping send().
  sendBroadcast?(
    to: string[],
    body: string,
    opts?: SendOptions,
  ): Promise<BroadcastResult>;
}
