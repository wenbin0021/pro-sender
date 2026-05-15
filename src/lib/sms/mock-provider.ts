import type { SmsProvider, SendResult, SendOptions } from "./provider";

// Simulates a real gateway: small network delay + occasional failures, so the
// UI's delivery stats and error handling can be exercised without a real
// account. Replace with a Twilio / Aliyun provider when going live.
export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";

  async send(to: string, body: string, opts?: SendOptions): Promise<SendResult> {
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 150));

    const providerMessageId = `mock_${Math.random().toString(36).slice(2, 12)}`;
    void to;
    void body;
    void opts;

    // Simulated carrier outcome distribution: ~78% delivered, ~9% rejected,
    // ~8% queued/pending, ~5% no status reported.
    const roll = Math.random();
    if (roll < 0.09) {
      return { providerMessageId, status: "failed", error: "Carrier rejected message" };
    }
    if (roll < 0.17) {
      return { providerMessageId, status: "pending" };
    }
    if (roll < 0.22) {
      return { providerMessageId, status: "unknown", error: "No delivery receipt" };
    }
    return { providerMessageId, status: "sent" };
  }
}
