import { listTemplates, createTemplate } from "@/lib/store";

export async function GET() {
  return Response.json(listTemplates());
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const templateBody = String(body.body ?? "").trim();

  if (!name || !templateBody) {
    return Response.json({ error: "name and body are required" }, { status: 400 });
  }

  const template = createTemplate({ name, body: templateBody });
  return Response.json(template, { status: 201 });
}
