import { createCampaign, updateCampaign, addLog } from "@/lib/store";
import { getProvider } from "@/lib/sms";
import { classifyPhones } from "@/lib/phone";
import type { MessageStatus } from "@/lib/types";

// Ad-hoc "Send Now" blast: free-text message + a raw list of phone numbers,
// no template or saved contact group required. Produces a campaign report
// with a per-outcome breakdown (sent / failed / pending / invalid / unknown).
export async function POST(request: Request) {
  const body = await request.json();
  const message = String(body.message ?? "").trim();
  const senderId = body.senderId ? String(body.senderId).trim() : undefined;
  const rawContacts: unknown = body.contacts;
  const name =
    String(body.name ?? "").trim() ||
    `Send Now · ${new Date().toLocaleString()}`;

  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }
  if (!Array.isArray(rawContacts)) {
    return Response.json({ error: "contacts must be an array" }, { status: 400 });
  }

  // Dedupe + classify into deliverable and invalid numbers.
  const { valid, invalid: invalidNumbers } = classifyPhones(
    rawContacts.map(String),
  );

  if (valid.length === 0) {
    return Response.json(
      { error: "no valid phone numbers in the list" },
      { status: 400 },
    );
  }

  const counts: Record<MessageStatus, number> = {
    sent: 0,
    failed: 0,
    pending: 0,
    invalid: 0,
    unknown: 0,
  };

  const campaign = createCampaign({
    name,
    group: "manual list",
    message,
    senderId,
  });
  updateCampaign(campaign.id, {
    status: "sending",
    total: valid.length + invalidNumbers.length,
  });

  // Invalid numbers never reach the provider — record them so the report is
  // complete and the Excel export lists every submitted number.
  for (const phone of invalidNumbers) {
    counts.invalid++;
    addLog({
      campaignId: campaign.id,
      contactId: "manual",
      contactName: "Manual recipient",
      phone,
      body: message,
      status: "invalid",
      error: "Invalid phone number format",
    });
  }

  // Sent synchronously because the mock provider is fast. A production build
  // should queue this and reconcile pending/unknown via delivery webhooks.
  const provider = getProvider();
  for (const phone of valid) {
    const result = await provider.send(phone, message, { senderId });
    counts[result.status]++;
    addLog({
      campaignId: campaign.id,
      contactId: "manual",
      contactName: "Manual recipient",
      phone,
      body: message,
      status: result.status,
      error: result.error,
      providerMessageId: result.providerMessageId,
    });
  }

  updateCampaign(campaign.id, {
    status: counts.sent === 0 ? "failed" : "completed",
    ...counts,
  });

  return Response.json(
    {
      id: campaign.id,
      total: valid.length + invalidNumbers.length,
      ...counts,
      senderId: senderId ?? null,
    },
    { status: 201 },
  );
}
