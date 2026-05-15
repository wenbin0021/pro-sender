// Shared phone-number parsing. Used by the Send Now flow, the group import
// dialogs, and the API routes so validation stays consistent everywhere.

export const PHONE_RE = /^\+?[0-9]{6,15}$/;

export function normalizePhone(raw: string): string {
  return raw.replace(/[\s()-]/g, "");
}

// Classify raw phone strings into deduped valid + invalid lists.
export function classifyPhones(input: string[]): {
  valid: string[];
  invalid: string[];
} {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of input) {
    const phone = normalizePhone(String(raw ?? ""));
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    if (PHONE_RE.test(phone)) valid.push(phone);
    else invalid.push(phone);
  }
  return { valid, invalid };
}

// Parse a free-text blob (newline / comma / semicolon separated) for UI input.
// `all` is valid + invalid combined — submit that so the server can count
// invalid numbers too.
export function parsePhoneList(text: string) {
  const { valid, invalid } = classifyPhones(text.split(/[\n,;]+/));
  return { all: [...valid, ...invalid], valid, invalid };
}
