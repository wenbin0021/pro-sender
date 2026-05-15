import { createCampaign, updateCampaign, addLog } from "@/lib/store";
import { getProvider } from "@/lib/sms";
import { classifyPhones } from "@/lib/phone";
import type { MessageStatus } from "@/lib/types";

// Ad-hoc "Send Now" blast: free-text message + a raw list of phone numbers,
// no template or saved contact group required. Produces a campaign report
// with a per-outcome breakdown (sent / failed / pending / invalid / unknown).
//
// Sends one-by-one for small lists, or via the provider's broadcast endpoint
// (when available) for larger lists. Threshold is configurable via
// MMDSMART_BROADCAST_THRESHOLD.
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

  const provider = getProvider();
  const threshold = Math.max(
    1,
    Number(process.env.MMDSMART_BROADCAST_THRESHOLD ?? "5"),
  );
  const useBroadcast =
    typeof provider.sendBroadcast === "function" && valid.length > threshold;

  if (useBroadcast && provider.sendBroadcast) {
    // One round-trip for the whole batch. Per-recipient delivery status will
    // be reconciled later via webhook callbacks.
    const result = await provider.sendBroadcast(valid, message, {
      senderId,
      clientRef: campaign.id,
    });
    for (const r of result.recipients) {
      counts[r.status]++;
      addLog({
        campaignId: campaign.id,
        contactId: "manual",
        contactName: "Manual recipient",
        phone: r.phone,
        body: message,
        status: r.status,
        error: r.error,
        providerMessageId: r.providerMessageId,
      });
    }
  } else {
    // Small list — send synchronously. Sequential keeps things simple; for
    // production traffic this should be a queue worker.
    for (const phone of valid) {
      const result = await provider.send(phone, message, {
        senderId,
        clientRef: campaign.id,
      });
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
  }

  updateCampaign(campaign.id, {
    // If everything is still pending (e.g. real provider + webhook arriving
    // later) keep status as "sending"; otherwise mark completed/failed.
    status:
      counts.pending > 0 && counts.sent === 0 && counts.failed === 0
        ? "sending"
        : counts.sent === 0
          ? "failed"
          : "completed",
    ...counts,
  });

  return Response.json(
    {
      id: campaign.id,
      total: valid.length + invalidNumbers.length,
      mode: useBroadcast ? "broadcast" : "single",
      ...counts,
      senderId: senderId ?? null,
    },
    { status: 201 },
  );
}
