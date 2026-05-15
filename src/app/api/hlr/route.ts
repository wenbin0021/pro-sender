import { lookupNumbers } from "@/lib/hlr";
import { normalizePhone } from "@/lib/phone";
import { createHlrReport } from "@/lib/store";

// POST /api/hlr — run a named HLR lookup on a batch of phone numbers and
// persist it as an HLR report.
export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const numbers: unknown = body.numbers;

  if (!name) {
    return Response.json({ error: "campaign name is required" }, { status: 400 });
  }
  if (!Array.isArray(numbers)) {
    return Response.json({ error: "numbers must be an array" }, { status: 400 });
  }

  // Dedupe by normalized form so the report has one row per number.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const n of numbers) {
    const norm = normalizePhone(String(n ?? ""));
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    unique.push(norm);
  }

  if (unique.length === 0) {
    return Response.json({ error: "no numbers submitted" }, { status: 400 });
  }

  // Simulate the latency of a real HLR gateway round-trip.
  await new Promise((r) =>
    setTimeout(r, Math.min(1600, 250 + unique.length * 25)),
  );

  const results = lookupNumbers(unique);
  const report = createHlrReport(name, results);
  return Response.json(report, { status: 201 });
}
