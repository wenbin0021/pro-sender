// SMS provider abstraction.
//
// Every concrete provider (mock, Twilio, Aliyun, AWS SNS, ...) implements this
// interface. The rest of the app only depends on `SmsProvider`, so swapping
// providers is a one-line change in `getProvider()`.

export interface SendResult {
  providerMessageId: string;
  // A valid number can still come back failed/pending/unknown depending on
  // what the carrier reports. "invalid" is decided before send, so it is not
  // a possible provider result.
  status: "sent" | "failed" | "pending" | "unknown";
  error?: string;
}

export interface SendOptions {
  // Alphanumeric or numeric sender ID shown to the recipient, where the
  // provider/country supports it.
  senderId?: string;
}

export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string, opts?: SendOptions): Promise<SendResult>;
}
