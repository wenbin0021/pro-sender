import type { SmsProvider } from "./provider";
import { MockSmsProvider } from "./mock-provider";

export type { SmsProvider, SendResult } from "./provider";

let provider: SmsProvider | null = null;

// Single place that decides which provider is live. To add Twilio:
//   case "twilio": return new TwilioProvider(...)
export function getProvider(): SmsProvider {
  if (provider) return provider;

  switch (process.env.SMS_PROVIDER) {
    case "mock":
    default:
      provider = new MockSmsProvider();
  }
  return provider;
}
