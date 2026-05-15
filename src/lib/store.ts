import type {
  Contact,
  Template,
  Campaign,
  MessageLog,
  MessageStatus,
  CampaignStatus,
  HlrResult,
  HlrReport,
} from "./types";
import { db } from "./db";

// SQLite-backed store. All functions are synchronous because better-sqlite3
// is synchronous — keeps the existing API routes unchanged.

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function summarizeHlr(results: HlrResult[]) {
  return {
    total: results.length,
    valid: results.filter((r) => r.valid).length,
    invalid: results.filter((r) => r.status === "invalid").length,
    absent: results.filter((r) => r.status === "absent").length,
  };
}

// --- Contacts & groups ---

interface ContactRow {
  id: string;
  name: string | null;
  phone: string;
  group: string;
  status: "subscribed" | "unsubscribed";
  createdAt: string;
}

function rowToContact(r: ContactRow): Contact {
  return {
    id: r.id,
    name: r.name ?? undefined,
    phone: r.phone,
    group: r.group,
    status: r.status,
    createdAt: r.createdAt,
  };
}

export function contactsByGroup(group: string): Contact[] {
  const rows = db()
    .prepare<[string], ContactRow>(
      `SELECT id, name, phone, "group" as "group", status, createdAt
       FROM contacts WHERE "group" = ? ORDER BY createdAt DESC`,
    )
    .all(group);
  return rows.map(rowToContact);
}

export function addContactsToGroup(group: string, phones: string[]): Contact[] {
  const created: Contact[] = [];
  const insert = db().prepare(
    `INSERT OR IGNORE INTO contacts (id, name, phone, "group", status, createdAt)
     VALUES (?, NULL, ?, ?, 'subscribed', ?)`,
  );
  const tx = db().transaction(() => {
    for (const phone of phones) {
      const newId = id("c");
      const createdAt = new Date().toISOString();
      const info = insert.run(newId, phone, group, createdAt);
      if (info.changes > 0) {
        created.push({
          id: newId,
          phone,
          group,
          status: "subscribed",
          createdAt,
        });
      }
    }
  });
  tx();
  return created;
}

export function listGroups(): string[] {
  const rows = db()
    .prepare<[], { group: string }>(
      `SELECT DISTINCT "group" as "group" FROM contacts ORDER BY "group" ASC`,
    )
    .all();
  return rows.map((r) => r.group);
}

// --- Templates ---

interface TemplateRow {
  id: string;
  name: string;
  body: string;
  createdAt: string;
}

export function listTemplates(): Template[] {
  return db()
    .prepare<[], TemplateRow>(
      `SELECT id, name, body, createdAt FROM templates ORDER BY createdAt DESC`,
    )
    .all();
}

export function createTemplate(input: Pick<Template, "name" | "body">): Template {
  const template: Template = {
    id: id("t"),
    name: input.name,
    body: input.body,
    createdAt: new Date().toISOString(),
  };
  db()
    .prepare(
      `INSERT INTO templates (id, name, body, createdAt) VALUES (?, ?, ?, ?)`,
    )
    .run(template.id, template.name, template.body, template.createdAt);
  return template;
}

// --- Campaigns ---

interface CampaignRow {
  id: string;
  name: string;
  message: string | null;
  senderId: string | null;
  group: string;
  status: CampaignStatus;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  invalid: number;
  unknown: number;
  createdAt: string;
}

function rowToCampaign(r: CampaignRow): Campaign {
  return {
    id: r.id,
    name: r.name,
    message: r.message ?? undefined,
    senderId: r.senderId ?? undefined,
    group: r.group,
    status: r.status,
    total: r.total,
    sent: r.sent,
    failed: r.failed,
    pending: r.pending,
    invalid: r.invalid,
    unknown: r.unknown,
    createdAt: r.createdAt,
  };
}

export function listCampaigns(): Campaign[] {
  const rows = db()
    .prepare<[], CampaignRow>(
      `SELECT id, name, message, senderId, "group" as "group", status,
              total, sent, failed, pending, invalid, unknown, createdAt
       FROM campaigns ORDER BY createdAt DESC`,
    )
    .all();
  return rows.map(rowToCampaign);
}

export function getCampaign(campaignId: string): Campaign | undefined {
  const row = db()
    .prepare<[string], CampaignRow>(
      `SELECT id, name, message, senderId, "group" as "group", status,
              total, sent, failed, pending, invalid, unknown, createdAt
       FROM campaigns WHERE id = ?`,
    )
    .get(campaignId);
  return row ? rowToCampaign(row) : undefined;
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
  db()
    .prepare(
      `INSERT INTO campaigns
         (id, name, message, senderId, "group", status, total, sent, failed, pending, invalid, unknown, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, ?)`,
    )
    .run(
      campaign.id,
      campaign.name,
      campaign.message ?? null,
      campaign.senderId ?? null,
      campaign.group,
      campaign.status,
      campaign.createdAt,
    );
  return campaign;
}

const ALLOWED_CAMPAIGN_FIELDS = new Set([
  "name",
  "message",
  "senderId",
  "group",
  "status",
  "total",
  "sent",
  "failed",
  "pending",
  "invalid",
  "unknown",
]);

export function updateCampaign(
  campaignId: string,
  patch: Partial<Campaign>,
): void {
  const entries = Object.entries(patch).filter(
    ([k, v]) => ALLOWED_CAMPAIGN_FIELDS.has(k) && v !== undefined,
  );
  if (entries.length === 0) return;
  const sets = entries.map(([k]) => `"${k}" = ?`).join(", ");
  const values = entries.map(([, v]) => v as string | number | null);
  db()
    .prepare(`UPDATE campaigns SET ${sets} WHERE id = ?`)
    .run(...values, campaignId);
}

// --- Logs ---

interface LogRow {
  id: string;
  campaignId: string;
  contactId: string;
  contactName: string;
  phone: string;
  body: string;
  status: MessageStatus;
  error: string | null;
  providerMessageId: string | null;
  createdAt: string;
}

function rowToLog(r: LogRow): MessageLog {
  return {
    id: r.id,
    campaignId: r.campaignId,
    contactId: r.contactId,
    contactName: r.contactName,
    phone: r.phone,
    body: r.body,
    status: r.status,
    error: r.error ?? undefined,
    providerMessageId: r.providerMessageId ?? undefined,
    createdAt: r.createdAt,
  };
}

export function listLogs(campaignId?: string): MessageLog[] {
  const sql = `SELECT id, campaignId, contactId, contactName, phone, body,
                      status, error, providerMessageId, createdAt
               FROM message_logs
               ${campaignId ? "WHERE campaignId = ?" : ""}
               ORDER BY createdAt DESC`;
  const rows = campaignId
    ? db().prepare<[string], LogRow>(sql).all(campaignId)
    : db().prepare<[], LogRow>(sql).all();
  return rows.map(rowToLog);
}

export function addLog(log: Omit<MessageLog, "id" | "createdAt">): MessageLog {
  const entry: MessageLog = {
    ...log,
    id: id("msg"),
    createdAt: new Date().toISOString(),
  };
  db()
    .prepare(
      `INSERT INTO message_logs
         (id, campaignId, contactId, contactName, phone, body, status, error, providerMessageId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      entry.id,
      entry.campaignId,
      entry.contactId,
      entry.contactName,
      entry.phone,
      entry.body,
      entry.status,
      entry.error ?? null,
      entry.providerMessageId ?? null,
      entry.createdAt,
    );
  return entry;
}

// Recompute a campaign's sent/failed/pending/invalid/unknown counters from
// its log rows. Called after a webhook flips a log's status.
function recomputeCampaignCounts(campaignId: string): void {
  const counts = db()
    .prepare<
      [string],
      {
        sent: number;
        failed: number;
        pending: number;
        invalid: number;
        unknown: number;
      }
    >(
      `SELECT
         SUM(status = 'sent')    AS sent,
         SUM(status = 'failed')  AS failed,
         SUM(status = 'pending') AS pending,
         SUM(status = 'invalid') AS invalid,
         SUM(status = 'unknown') AS unknown
       FROM message_logs WHERE campaignId = ?`,
    )
    .get(campaignId);

  if (!counts) return;
  const sent = counts.sent ?? 0;
  const pending = counts.pending ?? 0;
  const status: CampaignStatus =
    pending > 0 ? "sending" : sent === 0 ? "failed" : "completed";

  db()
    .prepare(
      `UPDATE campaigns
         SET sent = ?, failed = ?, pending = ?, invalid = ?, unknown = ?, status = ?
         WHERE id = ?`,
    )
    .run(
      sent,
      counts.failed ?? 0,
      pending,
      counts.invalid ?? 0,
      counts.unknown ?? 0,
      status,
      campaignId,
    );
}

export function updateLogByProviderId(
  providerMessageId: string,
  patch: Partial<Pick<MessageLog, "status" | "error">>,
): boolean {
  if (!providerMessageId) return false;
  const row = db()
    .prepare<[string], { id: string; campaignId: string }>(
      `SELECT id, campaignId FROM message_logs WHERE providerMessageId = ? LIMIT 1`,
    )
    .get(providerMessageId);
  if (!row) return false;

  const sets: string[] = [];
  const values: (string | null)[] = [];
  if (patch.status) {
    sets.push("status = ?");
    values.push(patch.status);
  }
  if (patch.error !== undefined) {
    sets.push("error = ?");
    values.push(patch.error ?? null);
  }
  if (sets.length === 0) return true;

  db()
    .prepare(`UPDATE message_logs SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values, row.id);
  recomputeCampaignCounts(row.campaignId);
  return true;
}

// --- HLR reports ---

interface HlrReportRow {
  id: string;
  name: string;
  createdAt: string;
  total: number;
  valid: number;
  invalid: number;
  absent: number;
  results: string;
}

function rowToHlrReport(r: HlrReportRow): HlrReport {
  return {
    id: r.id,
    name: r.name,
    createdAt: r.createdAt,
    total: r.total,
    valid: r.valid,
    invalid: r.invalid,
    absent: r.absent,
    results: JSON.parse(r.results) as HlrResult[],
  };
}

export function listHlrReports(): HlrReport[] {
  return db()
    .prepare<[], HlrReportRow>(
      `SELECT id, name, createdAt, total, valid, invalid, absent, results
       FROM hlr_reports ORDER BY createdAt DESC`,
    )
    .all()
    .map(rowToHlrReport);
}

export function getHlrReport(reportId: string): HlrReport | undefined {
  const row = db()
    .prepare<[string], HlrReportRow>(
      `SELECT id, name, createdAt, total, valid, invalid, absent, results
       FROM hlr_reports WHERE id = ?`,
    )
    .get(reportId);
  return row ? rowToHlrReport(row) : undefined;
}

export function createHlrReport(name: string, results: HlrResult[]): HlrReport {
  const summary = summarizeHlr(results);
  const report: HlrReport = {
    id: id("hlr"),
    name,
    createdAt: new Date().toISOString(),
    ...summary,
    results,
  };
  db()
    .prepare(
      `INSERT INTO hlr_reports (id, name, createdAt, total, valid, invalid, absent, results)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      report.id,
      report.name,
      report.createdAt,
      report.total,
      report.valid,
      report.invalid,
      report.absent,
      JSON.stringify(report.results),
    );
  return report;
}

// --- Billing ---

export function getBalance(): number {
  const row = db()
    .prepare<[], { value: string }>(`SELECT value FROM kv WHERE key = 'balance'`)
    .get();
  return row ? Number(row.value) : 0;
}

export function addBalance(amount: number): number {
  const tx = db().transaction((delta: number): number => {
    const current = getBalance();
    const next = Math.round((current + delta) * 100) / 100;
    db()
      .prepare(`UPDATE kv SET value = ? WHERE key = 'balance'`)
      .run(String(next));
    return next;
  });
  return tx(amount);
}
