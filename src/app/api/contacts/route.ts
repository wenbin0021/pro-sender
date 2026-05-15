import { contactsByGroup, addContactsToGroup, listGroups } from "@/lib/store";
import { classifyPhones } from "@/lib/phone";

// GET /api/contacts?group=NAME — the phone numbers in one group.
export async function GET(request: Request) {
  const group = new URL(request.url).searchParams.get("group");
  if (!group) {
    return Response.json({ error: "group is required" }, { status: 400 });
  }
  if (!listGroups().includes(group)) {
    return Response.json({ error: "group not found" }, { status: 404 });
  }
  return Response.json(contactsByGroup(group));
}

// POST /api/contacts — bulk-add phone numbers to an existing group.
export async function POST(request: Request) {
  const body = await request.json();
  const group = String(body.group ?? "").trim();
  const numbers: unknown = body.numbers;

  if (!group || !listGroups().includes(group)) {
    return Response.json({ error: "unknown group" }, { status: 404 });
  }
  if (!Array.isArray(numbers)) {
    return Response.json({ error: "numbers must be an array" }, { status: 400 });
  }

  const { valid, invalid } = classifyPhones(numbers.map(String));
  if (valid.length === 0) {
    return Response.json(
      { error: "no valid phone numbers in the list" },
      { status: 400 },
    );
  }

  const created = addContactsToGroup(group, valid);
  return Response.json(
    {
      group,
      imported: created.length,
      duplicates: valid.length - created.length,
      invalid: invalid.length,
    },
    { status: 201 },
  );
}
