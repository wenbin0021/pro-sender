import { listLogs } from "@/lib/store";

export async function GET(request: Request) {
  const campaignId = new URL(request.url).searchParams.get("campaignId") ?? undefined;
  return Response.json(listLogs(campaignId));
}
