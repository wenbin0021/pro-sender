import type { SmsProvider } from "./provider";
import { MockSmsProvider } from "./mock-provider";
import { MmdsmartProvider } from "./mmdsmart-provider";

export type {
  SmsProvider,
  SendResult,
  SendOptions,
  BroadcastResult,
  BroadcastRecipientResult,
} from "./provider";

let provider: SmsProvider | null = null;

// Single place that decides which provider is live. Set SMS_PROVIDER in
// .env.local to pick — defaults to the mock for safety.
export function getProvider(): SmsProvider {
  if (provider) return provider;

  switch (process.env.SMS_PROVIDER) {
    case "mmdsmart":
      provider = new MmdsmartProvider();
      break;
    case "mock":
    default:
      provider = new MockSmsProvider();
  }
  return provider;
}
