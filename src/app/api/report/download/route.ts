import ExcelJS from "exceljs";
import { getCampaign, listLogs } from "@/lib/store";

// Generates the campaign report as a downloadable .xlsx workbook:
//   Sheet 1 "Summary"    — campaign metadata + per-outcome breakdown
//   Sheet 2 "Recipients" — one row per submitted number
export async function GET(request: Request) {
  const campaignId = new URL(request.url).searchParams.get("campaignId");
  if (!campaignId) {
    return Response.json({ error: "campaignId is required" }, { status: 400 });
  }

  const campaign = getCampaign(campaignId);
  if (!campaign) {
    return Response.json({ error: "campaign not found" }, { status: 404 });
  }
  const logs = listLogs(campaignId);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Signal SMS Console";
  wb.created = new Date();

  // --- Summary sheet ---
  const summary = wb.addWorksheet("Summary");
  summary.columns = [
    { key: "label", width: 22 },
    { key: "value", width: 60 },
  ];

  const titleRow = summary.addRow(["Campaign Report"]);
  titleRow.font = { bold: true, size: 14 };
  summary.addRow([]);
  summary.addRow(["Campaign", campaign.name]);
  summary.addRow(["Created", new Date(campaign.createdAt).toLocaleString()]);
  summary.addRow(["Sender ID", campaign.senderId ?? "(provider default)"]);
  summary.addRow(["Status", campaign.status]);
  summary.addRow([]);
  const msgHeader = summary.addRow(["Message content"]);
  msgHeader.font = { bold: true };
  const msgRow = summary.addRow(["", campaign.message ?? ""]);
  msgRow.getCell("value").alignment = { wrapText: true, vertical: "top" };
  summary.addRow([]);

  const breakdownHeader = summary.addRow(["Outcome", "Count"]);
  breakdownHeader.font = { bold: true };
  breakdownHeader.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2933" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });
  summary.addRow(["Total numbers", campaign.total]);
  summary.addRow(["Sent (success)", campaign.sent]);
  summary.addRow(["Failed", campaign.failed]);
  summary.addRow(["Pending", campaign.pending]);
  summary.addRow(["Invalid number", campaign.invalid]);
  summary.addRow(["Unknown", campaign.unknown]);

  // --- Recipients sheet ---
  const detail = wb.addWorksheet("Recipients");
  detail.columns = [
    { header: "#", key: "idx", width: 6 },
    { header: "Phone", key: "phone", width: 20 },
    { header: "Status", key: "status", width: 14 },
    { header: "Error", key: "error", width: 30 },
    { header: "Provider Msg ID", key: "pmid", width: 24 },
    { header: "Timestamp", key: "ts", width: 24 },
  ];
  detail.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  detail.getRow(1).eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2933" },
    };
  });

  // Oldest first reads more naturally in an exported sheet.
  const ordered = [...logs].reverse();
  ordered.forEach((log, i) => {
    detail.addRow({
      idx: i + 1,
      phone: log.phone,
      status: log.status,
      error: log.error ?? "",
      pmid: log.providerMessageId ?? "",
      ts: new Date(log.createdAt).toLocaleString(),
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const safeName = campaign.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report-${safeName}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
