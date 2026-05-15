import { listGroups, contactsByGroup, addContactsToGroup } from "@/lib/store";
import { classifyPhones } from "@/lib/phone";

// GET /api/groups — every group with its contact counts.
export async function GET() {
  const groups = listGroups().map((name) => {
    const contacts = contactsByGroup(name);
    return {
      name,
      count: contacts.length,
      subscribed: contacts.filter((c) => c.status === "subscribed").length,
      createdAt:
        contacts.length > 0
          ? contacts[contacts.length - 1].createdAt
          : new Date().toISOString(),
    };
  });
  return Response.json(groups);
}

// POST /api/groups — create a new group and import phone numbers into it.
export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const numbers: unknown = body.numbers;

  if (!name) {
    return Response.json({ error: "group name is required" }, { status: 400 });
  }
  if (listGroups().includes(name)) {
    return Response.json(
      { error: "a group with that name already exists" },
      { status: 409 },
    );
  }
  if (!Array.isArray(numbers)) {
    return Response.json({ error: "numbers must be an array" }, { status: 400 });
  }

  const { valid, invalid } = classifyPhones(numbers.map(String));
  if (valid.length === 0) {
    return Response.json(
      { error: "add at least one valid phone number" },
      { status: 400 },
    );
  }

  const created = addContactsToGroup(name, valid);
  return Response.json(
    { name, imported: created.length, invalid: invalid.length },
    { status: 201 },
  );
}
