// Domain model for the SMS blasting system.

export type SubscriptionStatus = "subscribed" | "unsubscribed";

export interface Contact {
  id: string;
  // Optional — numbers imported into a group in bulk have no name.
  name?: string;
  phone: string;
  group: string;
  status: SubscriptionStatus;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  // Body may contain {{name}} / {{phone}} placeholders.
  body: string;
  createdAt: string;
}

export type CampaignStatus = "draft" | "sending" | "completed" | "failed";

export interface Campaign {
  id: string;
  name: string;
  // Ad-hoc "Send Now" blasts carry their message inline.
  message?: string;
  senderId?: string;
  group: string;
  status: CampaignStatus;
  // Snapshot counts — one per delivery outcome. total = sum of all five.
  total: number;
  sent: number;
  failed: number;
  pending: number;
  invalid: number;
  unknown: number;
  createdAt: string;
}

// Per-recipient delivery outcome.
//   sent     — accepted/delivered by the carrier
//   failed   — carrier rejected the message
//   pending  — queued, awaiting a delivery receipt
//   invalid  — phone number was malformed, never sent
//   unknown  — provider returned no / an unrecognized status
export type MessageStatus =
  | "sent"
  | "failed"
  | "pending"
  | "invalid"
  | "unknown";

// One number's result from an HLR (Home Location Register) lookup.
//   active  — live, reachable mobile number
//   absent  — valid format but not currently registered / reachable
//   invalid — malformed number, not a dialable MSISDN
export interface HlrResult {
  phone: string;
  valid: boolean;
  status: "active" | "absent" | "invalid";
  network: string | null;
  country: string | null;
  countryCode: string | null;
  mccMnc: string | null;
  ported: boolean;
}

// A persisted, named HLR lookup run — the "HLR report" the user keeps for
// their records and can later send to.
export interface HlrReport {
  id: string;
  name: string;
  createdAt: string;
  total: number;
  valid: number;
  invalid: number;
  absent: number;
  results: HlrResult[];
}

export interface MessageLog {
  id: string;
  campaignId: string;
  contactId: string;
  contactName: string;
  phone: string;
  body: string;
  status: MessageStatus;
  error?: string;
  providerMessageId?: string;
  createdAt: string;
}
