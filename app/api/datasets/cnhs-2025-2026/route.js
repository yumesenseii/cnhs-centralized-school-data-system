import { NextResponse } from "next/server";
import { queryCnhsHistoricalLearners, loadCnhsHistoricalRecords } from "@/lib/datasets/cnhsDatasetLoader";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const exportFormat = searchParams.get("export");

    if (exportFormat === "csv") {
      const records = loadCnhsHistoricalRecords();
      if (!records.length) {
        return new NextResponse("No historical records found", { status: 404 });
      }
      const headers = Object.keys(records[0]);
      const csvRows = [headers.join(",")];
      for (const r of records) {
        const row = headers.map((h) => {
          const val = r[h];
          if (val === null || val === undefined) return "";
          if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return String(val);
        });
        csvRows.push(row.join(","));
      }

      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="CNHS_Historical_Dataset_SY_2025_2026.csv"',
        },
      });
    }

    const schoolYear = searchParams.get("schoolYear") || "SY 2025-2026";
    const gradeLevel = searchParams.get("grade") || searchParams.get("gradeLevel");
    const pathway = searchParams.get("pathway");
    const tier = searchParams.get("tier");
    const readingLevel = searchParams.get("readingLevel");
    const riskLevel = searchParams.get("risk") || searchParams.get("riskLevel");
    const status = searchParams.get("status");
    const outcome = searchParams.get("outcome");
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

    const result = queryCnhsHistoricalLearners({
      schoolYear,
      gradeLevel,
      pathway,
      tier,
      readingLevel,
      riskLevel,
      status,
      outcome,
      search,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to query historical dataset:", err);
    return NextResponse.json(
      { error: "Failed to process historical dataset request" },
      { status: 500 }
    );
  }
}
