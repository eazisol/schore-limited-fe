import ExcelJS from "exceljs";
import { formatUkDate, formatUkDateDots } from "@/lib/week-ending";
import type {
  ApiDailyClientExport,
  ApiDailyProgrammeExport,
  ApiDailyProgrammeExportSheet,
} from "@/lib/api/services/daily-programme";

const CLIENT_HEADERS = [
  "Export date",
  "Job",
  "Property",
  "Address",
  "Postcode",
  "Property type",
  "Client",
  "Status",
  "Note",
  "Operative",
  "Trade",
  "Task",
  "Attendance period",
] as const;

const OPERATIVE_HEADERS = [
  "PROPERTY",
  "Client",
  "Post Code",
  "Type",
  "Starting",
  "HO",
  "DAY",
  "Trade",
  "NAME",
  "TIME",
  "NEXT DAY",
] as const;

function cellText(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

function buildClientRows(job: ApiDailyClientExport, exportDateLabel: string): (string | number)[][] {
  const status = job.status ?? "";
  const note = job.reason ?? "";
  if (job.lines.length > 0) {
    return job.lines.map((line) => [
      exportDateLabel,
      job.taskNumber,
      job.propertyName,
      job.propertyAddress ?? "",
      job.postCode ?? "",
      job.propertyType ?? "",
      job.client ?? "",
      status,
      note,
      line.operativeName ?? "",
      line.trade ?? "",
      line.task ?? "",
      line.attendancePeriod ?? "",
    ]);
  }

  return [
    [
      exportDateLabel,
      job.taskNumber,
      job.propertyName,
      job.propertyAddress ?? "",
      job.postCode ?? "",
      job.propertyType ?? "",
      job.client ?? "",
      status,
      note,
      "",
      "",
      "",
      "",
    ],
  ];
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFF00" },
    };
  });
}

function writeClientSheet(ws: ExcelJS.Worksheet, sheet: ApiDailyProgrammeExportSheet) {
  ws.addRow([...CLIENT_HEADERS]);
  styleHeaderRow(ws.getRow(1));
  const exportDateLabel = formatUkDate(sheet.date);
  for (const job of sheet.clientJobs ?? []) {
    for (const row of buildClientRows(job, exportDateLabel)) {
      ws.addRow(row.map(cellText));
    }
  }
  ws.columns = CLIENT_HEADERS.map(() => ({ width: 16 }));
}

function writeOperativeSheet(ws: ExcelJS.Worksheet, sheet: ApiDailyProgrammeExportSheet) {
  ws.addRow([...OPERATIVE_HEADERS]);
  styleHeaderRow(ws.getRow(1));
  for (const row of sheet.operativeRows ?? []) {
    ws.addRow([
      cellText(row.propertyName),
      cellText(row.client),
      cellText(row.postCode),
      cellText(row.type),
      cellText(formatUkDate(row.startingDate)),
      cellText(row.handOverDate ? formatUkDate(row.handOverDate) : ""),
      row.daysCount,
      cellText(row.trade),
      cellText(row.name),
      cellText(row.time),
      cellText(row.nextDay),
    ]);
  }
  ws.columns = OPERATIVE_HEADERS.map(() => ({ width: 14 }));

  const groups = sheet.noteGroups ?? [];
  if (groups.length === 0) return;

  ws.addRow([]);
  const noteTitle = ws.addRow(["Note"]);
  noteTitle.font = { bold: true };

  for (const group of groups) {
    const header = ws.addRow([group.jobName]);
    header.font = { bold: true, underline: true };
    for (const note of group.notes) {
      ws.addRow([note]);
    }
  }
}

function sheetNameForDate(isoDate: string): string {
  const name = formatUkDateDots(isoDate);
  return name.slice(0, 31) || "Sheet";
}

export async function downloadDailyProgrammeExportXlsx(data: ApiDailyProgrammeExport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Schore";
  workbook.created = new Date();

  const usedNames = new Set<string>();
  for (const sheet of data.sheets) {
    let name = sheetNameForDate(sheet.date);
    if (usedNames.has(name)) {
      let i = 2;
      while (usedNames.has(`${name.slice(0, 28)}_${i}`)) i += 1;
      name = `${name.slice(0, 28)}_${i}`;
    }
    usedNames.add(name);

    const ws = workbook.addWorksheet(name);
    if (data.exportType === "operative") {
      writeOperativeSheet(ws, sheet);
    } else {
      writeClientSheet(ws, sheet);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const from = data.fromDate ?? data.sheets[0]?.date ?? "all";
  const to = data.toDate ?? data.sheets[data.sheets.length - 1]?.date ?? "all";
  a.download = `daily-${data.exportType}-${from}_to_${to}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
