#!/usr/bin/env node
// scripts/setup.mjs
//
// One-shot project bootstrap. Run `npm run setup` after cloning to:
//   1. Confirm Node version
//   2. Ensure dependencies are installed
//   3. Create .env.local from .env.example (only if it doesn't exist)
//   4. Auto-generate a random AUTH_SECRET if it's blank
//   5. Print clear next steps
//
// Idempotent — re-running won't clobber an existing .env.local.

import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_LOCAL = resolve(root, ".env.local");
const ENV_EXAMPLE = resolve(root, ".env.example");

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

function log(line = "") {
  process.stdout.write(line + "\n");
}
function step(label) {
  log(`${c.cyan}${c.bold}▸${c.reset} ${label}`);
}
function ok(label) {
  log(`  ${c.green}✓${c.reset} ${label}`);
}
function warn(label) {
  log(`  ${c.yellow}!${c.reset} ${label}`);
}
function fail(label) {
  log(`  ${c.red}✗${c.reset} ${label}`);
}

// ── 1. Node version ────────────────────────────────────────────────────────
step("Checking Node.js version");
const [major] = process.versions.node.split(".").map(Number);
if (major < 20) {
  fail(`Node ${process.versions.node} detected — need 20 or newer.`);
  process.exit(1);
}
ok(`Node ${process.versions.node}`);

// ── 2. Dependencies ────────────────────────────────────────────────────────
step("Checking dependencies");
const nodeModules = resolve(root, "node_modules");
if (!existsSync(nodeModules)) {
  warn("node_modules missing — running `npm install`...");
  const r = spawnSync("npm", ["install"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    fail("npm install failed");
    process.exit(r.status ?? 1);
  }
}
ok("dependencies installed");

// ── 3. .env.local ──────────────────────────────────────────────────────────
step("Configuring .env.local");
if (!existsSync(ENV_EXAMPLE)) {
  fail(".env.example is missing — repo is in a bad state.");
  process.exit(1);
}
if (existsSync(ENV_LOCAL)) {
  ok(".env.local already exists — leaving it alone");
} else {
  copyFileSync(ENV_EXAMPLE, ENV_LOCAL);
  ok("created .env.local from .env.example");
}

// ── 4. Inject AUTH_SECRET if blank ─────────────────────────────────────────
{
  const content = readFileSync(ENV_LOCAL, "utf8");
  const match = content.match(/^AUTH_SECRET=(.*)$/m);
  if (match && match[1].trim() === "") {
    const secret = randomBytes(32).toString("hex");
    const updated = content.replace(
      /^AUTH_SECRET=.*$/m,
      `AUTH_SECRET=${secret}`,
    );
    writeFileSync(ENV_LOCAL, updated);
    ok(`generated AUTH_SECRET (${secret.slice(0, 8)}…)`);
  } else if (match) {
    ok("AUTH_SECRET already set");
  } else {
    warn("no AUTH_SECRET line in .env.local — add one manually");
  }
}

// ── 5. Next steps ──────────────────────────────────────────────────────────
log();
log(`${c.bold}Setup complete.${c.reset}`);
log();
log(`Next steps:`);
log();
log(`  1. Open ${c.cyan}.env.local${c.reset} and set:`);
log(`       ${c.dim}ADMIN_PASSWORD=${c.reset}  (your login password)`);
log(`       ${c.dim}MMDSMART_API_KEY=${c.reset} (from mmdsmart dashboard, if going live)`);
log(`       ${c.dim}SMS_PROVIDER=mmdsmart${c.reset} (to use the real provider)`);
log();
log(`  2. Start the dev server:`);
log(`       ${c.cyan}npm run dev${c.reset}`);
log();
log(`  3. (Optional) Expose the webhook for MessageWhiz callbacks:`);
log(`       ${c.cyan}npm run tunnel${c.reset}   ${c.dim}(Windows only; needs ngrok)${c.reset}`);
log();
