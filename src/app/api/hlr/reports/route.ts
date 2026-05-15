import { listHlrReports } from "@/lib/store";

// GET /api/hlr/reports — every saved HLR report, newest first.
export async function GET() {
  return Response.json(listHlrReports());
}
