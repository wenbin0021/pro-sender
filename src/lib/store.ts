import type {
  Contact,
  Template,
  Campaign,
  MessageLog,
  MessageStatus,
  HlrResult,
  HlrReport,
} from "./types";
import { lookupNumbers } from "./hlr";

// In-memory mock store. Stands in for a real database so the skeleton runs
// with zero setup. Swap each function body for real DB queries when ready.
//
// Attached to globalThis so the data survives Next.js dev-mode HMR reloads.

interface Db {
  contacts: Contact[];
  templates: Template[];
  campaigns: Campaign[];
  logs: MessageLog[];
  hlrReports: HlrReport[];
  // Account credit balance, in SGD.
  balance: number;
}

function summarizeHlr(results: HlrResult[]) {
  return {
    total: results.length,
    valid: results.filter((r) => r.valid).length,
    invalid: results.filter((r) => r.status === "invalid").length,
    absent: results.filter((r) => r.status === "absent").length,
  };
}

const globalForDb = globalThis as unknown as { __smsDb?: Db };

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function seed(): Db {
  const now = Date.now();
  const DAY = 86400000;
  const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();

  const contacts: Contact[] = [
    { id: "c1", name: "Alice Tan", phone: "+6591234567", group: "vip", status: "subscribed", createdAt: iso(DAY * 21) },
    { id: "c2", name: "Bob Lim", phone: "+6598765432", group: "vip", status: "subscribed", createdAt: iso(DAY * 20) },
    { id: "c3", name: "Carol Ng", phone: "+6590001111", group: "newsletter", status: "subscribed", createdAt: iso(DAY * 18) },
    { id: "c4", name: "David Wong", phone: "+6592223333", group: "newsletter", status: "unsubscribed", createdAt: iso(DAY * 17) },
    { id: "c5", name: "Eve Chua", phone: "+6594445555", group: "newsletter", status: "subscribed", createdAt: iso(DAY * 15) },
    { id: "c6", name: "Frank Goh", phone: "+6596667777", group: "vip", status: "subscribed", createdAt: iso(DAY * 12) },
    { id: "c7", name: "Grace Teo", phone: "+6593334444", group: "onboarding", status: "subscribed", createdAt: iso(DAY * 9) },
    { id: "c8", name: "Henry Koh", phone: "+6595556666", group: "onboarding", status: "subscribed", createdAt: iso(DAY * 6) },
    { id: "c9", name: "Iris Sim", phone: "+6597778888", group: "newsletter", status: "subscribed", createdAt: iso(DAY * 4) },
    { id: "c10", name: "Jack Lau", phone: "+6598889999", group: "onboarding", status: "subscribed", createdAt: iso(DAY * 2) },
  ];

  const templates: Template[] = [
    { id: "t1", name: "Welcome", body: "Hi {{name}}, welcome aboard! Reply STOP to opt out.", createdAt: iso(DAY * 21) },
    { id: "t2", name: "Promo", body: "Hi {{name}}, enjoy 20% off this week only. Reply STOP to opt out.", createdAt: iso(DAY * 11) },
    { id: "t3", name: "Reminder", body: "Hi {{name}}, your appointment is tomorrow. Reply STOP to opt out.", createdAt: iso(DAY * 5) },
  ];

  // Historical campaigns + their message logs, spread across the last week so
  // the dashboard charts and reports have something to show on first load.
  const campaigns: Campaign[] = [];
  const logs: MessageLog[] = [];

  const history: Array<{
    name: string;
    templateId: string;
    group: string;
    daysAgo: number;
    recipients: number;
  }> = [
    { name: "Onboarding wave 1", templateId: "t1", group: "onboarding", daysAgo: 6, recipients: 14 },
    { name: "Weekend promo", templateId: "t2", group: "newsletter", daysAgo: 4, recipients: 28 },
    { name: "VIP early access", templateId: "t2", group: "vip", daysAgo: 2, recipients: 19 },
    { name: "Appointment reminders", templateId: "t3", group: "onboarding", daysAgo: 1, recipients: 22 },
  ];

  const rollStatus = (): MessageStatus => {
    const r = Math.random();
    if (r < 0.78) return "sent";
    if (r < 0.87) return "failed";
    if (r < 0.93) return "pending";
    if (r < 0.97) return "unknown";
    return "invalid";
  };

  for (const h of history) {
    const campaignId = id("camp");
    const tpl = templates.find((t) => t.id === h.templateId)!;
    const counts = { sent: 0, failed: 0, pending: 0, invalid: 0, unknown: 0 };

    for (let i = 0; i < h.recipients; i++) {
      const status = rollStatus();
      counts[status]++;
      const contact = contacts[i % contacts.length];
      const contactName = contact.name ?? contact.phone;
      logs.push({
        id: id("msg"),
        campaignId,
        contactId: contact.id,
        contactName,
        phone: status === "invalid" ? `${contact.phone}-x` : contact.phone,
        body: tpl.body.replace(/\{\{\s*name\s*\}\}/g, contactName),
        status,
        error:
          status === "failed"
            ? "Carrier rejected message"
            : status === "invalid"
              ? "Invalid phone number format"
              : status === "unknown"
                ? "No delivery receipt"
                : undefined,
        providerMessageId:
          status === "invalid"
            ? undefined
            : `mock_${Math.random().toString(36).slice(2, 12)}`,
        createdAt: iso(DAY * h.daysAgo - i * 60000),
      });
    }

    campaigns.push({
      id: campaignId,
      name: h.name,
      message: tpl.body,
      group: h.group,
      status: "completed",
      total: h.recipients,
      ...counts,
      createdAt: iso(DAY * h.daysAgo),
    });
  }

  // Seed a couple of HLR reports so the lookup history and the Send Now
  // recipient picker have content on first load.
  const genPhones = (base: number, count: number, bad: number) => {
    const arr: string[] = [];
    for (let i = 0; i < count; i++) arr.push(`+65${base + i}`);
    for (let i = 0; i < bad; i++) arr.push(`bad-${i}`);
    return arr;
  };
  const hlrSeed = [
    { name: "Q2 leads cleanup", daysAgo: 5, phones: genPhones(91230000, 16, 2) },
    { name: "Newsletter list check", daysAgo: 2, phones: genPhones(98450000, 12, 1) },
  ];
  const hlrReports: HlrReport[] = hlrSeed.map((h) => {
    const results = lookupNumbers(h.phones);
    return {
      id: id("hlr"),
      name: h.name,
      createdAt: iso(DAY * h.daysAgo),
      ...summarizeHlr(results),
      results,
    };
  });

  return { contacts, templates, campaigns, logs, hlrReports, balance: 128.5 };
}

function db(): Db {
  if (!globalForDb.__smsDb) globalForDb.__smsDb = seed();
  return globalForDb.__smsDb;
}

// --- Contacts & groups ---
export function contactsByGroup(group: string): Contact[] {
  return db()
    .contacts.filter((c) => c.group === group)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Bulk-imports phone numbers into a group, skipping numbers already present in
// that group. Returns only the contacts that were actually created.
export function addContactsToGroup(group: string, phones: string[]): Contact[] {
  const existing = new Set(
    db().contacts.filter((c) => c.group === group).map((c) => c.phone),
  );
  const created: Contact[] = [];
  for (const phone of phones) {
    if (existing.has(phone)) continue;
    existing.add(phone);
    const contact: Contact = {
      id: id("c"),
      phone,
      group,
      status: "subscribed",
      createdAt: new Date().toISOString(),
    };
    db().contacts.push(contact);
    created.push(contact);
  }
  return created;
}

// --- Templates ---
export function listTemplates(): Template[] {
  return [...db().templates].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createTemplate(input: Pick<Template, "name" | "body">): Template {
  const template: Template = {
    id: id("t"),
    name: input.name,
    body: input.body,
    createdAt: new Date().toISOString(),
  };
  db().templates.push(template);
  return template;
}

// --- Campaigns ---
export function listCampaigns(): Campaign[] {
  return [...db().campaigns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getCampaign(campaignId: string): Campaign | undefined {
  return db().campaigns.find((c) => c.id === campaignId);
}

export function createCampaign(
  input: Pick<Campaign, "name" | "group"> &
    Partial<Pick<Campaign, "message" | "senderId">>,
): Campaign {
  const campaign: Campaign = {
    id: id("camp"),
    name: input.name,
    message: input.message,
    senderId: input.senderId,
    group: input.group,
    status: "draft",
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    invalid: 0,
    unknown: 0,
    createdAt: new Date().toISOString(),
  };
  db().campaigns.push(campaign);
  return campaign;
}

export function updateCampaign(campaignId: string, patch: Partial<Campaign>): void {
  const campaign = db().campaigns.find((c) => c.id === campaignId);
  if (campaign) Object.assign(campaign, patch);
}

// --- Logs ---
export function listLogs(campaignId?: string): MessageLog[] {
  const logs = campaignId ? db().logs.filter((l) => l.campaignId === campaignId) : db().logs;
  return [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addLog(log: Omit<MessageLog, "id" | "createdAt">): MessageLog {
  const entry: MessageLog = { ...log, id: id("msg"), createdAt: new Date().toISOString() };
  db().logs.push(entry);
  return entry;
}

// Distinct contact groups, for populating select dropdowns.
export function listGroups(): string[] {
  return [...new Set(db().contacts.map((c) => c.group))].sort();
}

// --- HLR reports ---
export function listHlrReports(): HlrReport[] {
  return [...db().hlrReports].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function getHlrReport(reportId: string): HlrReport | undefined {
  return db().hlrReports.find((r) => r.id === reportId);
}

export function createHlrReport(name: string, results: HlrResult[]): HlrReport {
  const report: HlrReport = {
    id: id("hlr"),
    name,
    createdAt: new Date().toISOString(),
    ...summarizeHlr(results),
    results,
  };
  db().hlrReports.push(report);
  return report;
}

// --- Billing ---
export function getBalance(): number {
  return db().balance;
}

export function addBalance(amount: number): number {
  db().balance = Math.round((db().balance + amount) * 100) / 100;
  return db().balance;
}
