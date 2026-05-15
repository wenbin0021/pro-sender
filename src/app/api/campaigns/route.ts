import { listCampaigns } from "@/lib/store";

// Campaigns are created by the "Send Now" flow (POST /api/send). This endpoint
// just lists them for the dashboard and the report view.
export async function GET() {
  return Response.json(listCampaigns());
}
