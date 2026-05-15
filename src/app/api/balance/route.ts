import { getBalance } from "@/lib/store";

export async function GET() {
  return Response.json({ balance: getBalance() });
}
