import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Synchronous SQLite handle, shared across the app.
//
// Stored on globalThis so the connection survives Next.js dev-mode HMR
// reloads — opening a new handle on every request would leak file
// descriptors. Schema is idempotent so re-running `init()` after a hot
// reload is safe.

const globalForDb = globalThis as unknown as { __sqlite?: Database.Database };

function dbPath(): string {
  const fromEnv = process.env.DATABASE_PATH?.trim();
  return resolve(process.cwd(), fromEnv && fromEnv.length > 0 ? fromEnv : "data/pro-sender.db");
}

function open(): Database.Database {
  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  const handle = new Database(path);
  handle.pragma("journal_mode = WAL");
  handle.pragma("foreign_keys = ON");
  init(handle);
  return handle;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT NOT NULL,
  "group" TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('subscribed','unsubscribed')),
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_group ON contacts("group");
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contacts_group_phone ON contacts("group", phone);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT,
  senderId TEXT,
  "group" TEXT NOT NULL,
  status TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 0,
  invalid INTEGER NOT NULL DEFAULT 0,
  unknown INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_campaigns_createdAt ON campaigns(createdAt DESC);

CREATE TABLE IF NOT EXISTS message_logs (
  id TEXT PRIMARY KEY,
  campaignId TEXT NOT NULL,
  contactId TEXT NOT NULL,
  contactName TEXT NOT NULL,
  phone TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  providerMessageId TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_campaign ON message_logs(campaignId);
CREATE INDEX IF NOT EXISTS idx_logs_provider ON message_logs(providerMessageId);
CREATE INDEX IF NOT EXISTS idx_logs_createdAt ON message_logs(createdAt DESC);

CREATE TABLE IF NOT EXISTS hlr_reports (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  total INTEGER NOT NULL,
  valid INTEGER NOT NULL,
  invalid INTEGER NOT NULL,
  absent INTEGER NOT NULL,
  results TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function init(handle: Database.Database): void {
  handle.exec(SCHEMA);

  // Seed singletons.
  const setBalance = handle.prepare(
    "INSERT OR IGNORE INTO kv (key, value) VALUES ('balance', ?)",
  );
  setBalance.run("128.5");

  // First-run demo seed — only when the contacts table is empty so we don't
  // re-seed on every dev reload.
  const row = handle
    .prepare<[], { c: number }>("SELECT COUNT(*) as c FROM contacts")
    .get();
  if (row && row.c === 0) {
    seed(handle);
  }
}

// Mirrors the original in-memory seed: a handful of contacts, templates,
// historical campaigns + their logs, and a couple of HLR reports — enough for
// the dashboard charts to render meaningfully on first launch.
function seed(handle: Database.Database): void {
  // Lazy import to avoid a circular load with hlr/types if they ever pull in
  // db helpers themselves.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { lookupNumbers } = require("./hlr") as typeof import("./hlr");

  const now = Date.now();
  const DAY = 86400000;
  const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();
  const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

  const tx = handle.transaction(() => {
    const insertContact = handle.prepare(
      `INSERT INTO contacts (id, name, phone, "group", status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const contacts = [
      ["c1", "Alice Tan", "+6591234567", "vip", "subscribed", iso(DAY * 21)],
      ["c2", "Bob Lim", "+6598765432", "vip", "subscribed", iso(DAY * 20)],
      ["c3", "Carol Ng", "+6590001111", "newsletter", "subscribed", iso(DAY * 18)],
      ["c4", "David Wong", "+6592223333", "newsletter", "unsubscribed", iso(DAY * 17)],
      ["c5", "Eve Chua", "+6594445555", "newsletter", "subscribed", iso(DAY * 15)],
      ["c6", "Frank Goh", "+6596667777", "vip", "subscribed", iso(DAY * 12)],
      ["c7", "Grace Teo", "+6593334444", "onboarding", "subscribed", iso(DAY * 9)],
      ["c8", "Henry Koh", "+6595556666", "onboarding", "subscribed", iso(DAY * 6)],
      ["c9", "Iris Sim", "+6597778888", "newsletter", "subscribed", iso(DAY * 4)],
      ["c10", "Jack Lau", "+6598889999", "onboarding", "subscribed", iso(DAY * 2)],
    ] as const;
    for (const c of contacts) insertContact.run(...c);

    const insertTemplate = handle.prepare(
      `INSERT INTO templates (id, name, body, createdAt) VALUES (?, ?, ?, ?)`,
    );
    const templates = [
      ["t1", "Welcome", "Hi {{name}}, welcome aboard! Reply STOP to opt out.", iso(DAY * 21)],
      ["t2", "Promo", "Hi {{name}}, enjoy 20% off this week only. Reply STOP to opt out.", iso(DAY * 11)],
      ["t3", "Reminder", "Hi {{name}}, your appointment is tomorrow. Reply STOP to opt out.", iso(DAY * 5)],
    ] as const;
    for (const t of templates) insertTemplate.run(...t);

    const insertCampaign = handle.prepare(
      `INSERT INTO campaigns
         (id, name, message, senderId, "group", status, total, sent, failed, pending, invalid, unknown, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertLog = handle.prepare(
      `INSERT INTO message_logs
         (id, campaignId, contactId, contactName, phone, body, status, error, providerMessageId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    type Status = "sent" | "failed" | "pending" | "invalid" | "unknown";
    const rollStatus = (): Status => {
      const r = Math.random();
      if (r < 0.78) return "sent";
      if (r < 0.87) return "failed";
      if (r < 0.93) return "pending";
      if (r < 0.97) return "unknown";
      return "invalid";
    };

    const history = [
      { name: "Onboarding wave 1", templateBody: templates[0][2], group: "onboarding", daysAgo: 6, recipients: 14 },
      { name: "Weekend promo", templateBody: templates[1][2], group: "newsletter", daysAgo: 4, recipients: 28 },
      { name: "VIP early access", templateBody: templates[1][2], group: "vip", daysAgo: 2, recipients: 19 },
      { name: "Appointment reminders", templateBody: templates[2][2], group: "onboarding", daysAgo: 1, recipients: 22 },
    ];

    for (const h of history) {
      const campaignId = id("camp");
      const counts: Record<Status, number> = { sent: 0, failed: 0, pending: 0, invalid: 0, unknown: 0 };
      for (let i = 0; i < h.recipients; i++) {
        const status = rollStatus();
        counts[status]++;
        const contact = contacts[i % contacts.length];
        const contactName = contact[1] ?? contact[2];
        insertLog.run(
          id("msg"),
          campaignId,
          contact[0],
          contactName,
          status === "invalid" ? `${contact[2]}-x` : contact[2],
          h.templateBody.replace(/\{\{\s*name\s*\}\}/g, contactName),
          status,
          status === "failed"
            ? "Carrier rejected message"
            : status === "invalid"
              ? "Invalid phone number format"
              : status === "unknown"
                ? "No delivery receipt"
                : null,
          status === "invalid"
            ? null
            : `mock_${Math.random().toString(36).slice(2, 12)}`,
          iso(DAY * h.daysAgo - i * 60000),
        );
      }
      insertCampaign.run(
        campaignId,
        h.name,
        h.templateBody,
        null,
        h.group,
        "completed",
        h.recipients,
        counts.sent,
        counts.failed,
        counts.pending,
        counts.invalid,
        counts.unknown,
        iso(DAY * h.daysAgo),
      );
    }

    const insertHlr = handle.prepare(
      `INSERT INTO hlr_reports (id, name, createdAt, total, valid, invalid, absent, results)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
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
    for (const h of hlrSeed) {
      const results = lookupNumbers(h.phones);
      insertHlr.run(
        id("hlr"),
        h.name,
        iso(DAY * h.daysAgo),
        results.length,
        results.filter((r) => r.valid).length,
        results.filter((r) => r.status === "invalid").length,
        results.filter((r) => r.status === "absent").length,
        JSON.stringify(results),
      );
    }
  });
  tx();
}

export function db(): Database.Database {
  if (!globalForDb.__sqlite) globalForDb.__sqlite = open();
  return globalForDb.__sqlite;
}
