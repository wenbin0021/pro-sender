import ExcelJS from "exceljs";
import { getHlrReport } from "@/lib/store";

// GET /api/hlr/export?id=ID — download a saved HLR report as an .xlsx workbook
// (Summary sheet + per-number Numbers sheet).
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const report = getHlrReport(id);
  if (!report) {
    return Response.json({ error: "HLR report not found" }, { status: 404 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Signal SMS Console";
  wb.created = new Date();

  // --- Summary sheet ---
  const s = wb.addWorksheet("Summary");
  s.columns = [
    { key: "label", width: 22 },
    { key: "value", width: 40 },
  ];
  const title = s.addRow(["HLR Lookup Report"]);
  title.font = { bold: true, size: 14 };
  s.addRow([]);
  s.addRow(["Campaign", report.name]);
  s.addRow(["Generated", new Date(report.createdAt).toLocaleString()]);
  s.addRow(["Numbers checked", report.total]);
  s.addRow(["Valid", report.valid]);
  s.addRow(["Invalid", report.invalid]);
  s.addRow(["Absent", report.absent]);

  // --- Detail sheet ---
  const d = wb.addWorksheet("Numbers");
  d.columns = [
    { header: "#", key: "idx", width: 6 },
    { header: "Phone", key: "phone", width: 20 },
    { header: "Valid", key: "valid", width: 10 },
    { header: "Status", key: "status", width: 12 },
    { header: "Telco", key: "telco", width: 24 },
    { header: "Country", key: "country", width: 18 },
    { header: "Country Code", key: "cc", width: 14 },
    { header: "MCC / MNC", key: "mccmnc", width: 14 },
    { header: "Ported", key: "ported", width: 10 },
  ];
  d.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  d.getRow(1).eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2933" },
    };
  });
  report.results.forEach((r, i) => {
    d.addRow({
      idx: i + 1,
      phone: r.phone,
      valid: r.valid ? "Yes" : "No",
      status: r.status,
      telco: r.network ?? "",
      country: r.country ?? "",
      cc: r.countryCode ?? "",
      mccmnc: r.mccMnc ?? "",
      ported: r.network ? (r.ported ? "Yes" : "No") : "",
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const safeName = report.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="hlr-${safeName}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
