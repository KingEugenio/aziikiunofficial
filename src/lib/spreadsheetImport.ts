// Real Excel/CSV transaction import - reads a .xlsx/.xls/.csv file entirely
// in the browser (nothing is ever uploaded to the server for this - the
// parsed rows are turned into normal Transaction objects and saved through
// the same onAddTransaction path a manual entry uses) and maps its columns
// onto Aziiki's own transaction shape. Column headers match what "Export
// Excel CSV" (see BusinessDashboard.tsx's handleExportCSV) already
// produces, so a round trip - export, edit in Excel, re-import - works
// with zero remapping, but recognition is header-based and case/whitespace
// -insensitive, not a fixed column order, so a spreadsheet built by hand
// (or exported from another tool) works too as long as the header names
// are close enough.
//
// Uses SheetJS's own patched distribution (cdn.sheetjs.com), NOT the
// "xlsx" package published to the npm registry - the npm-published version
// has two known high-severity CVEs (prototype pollution, ReDoS) that
// SheetJS stopped backporting fixes for after a dispute with npm; their own
// CDN build is the officially recommended, actually-patched source. See
// package.json's "xlsx" dependency entry.
import * as XLSX from "xlsx";
import type { Transaction, PaymentMethod } from "../types";

export interface SpreadsheetImportResult {
  transactions: Transaction[];
  totalRows: number;
  skippedRows: number;
}

const PAYMENT_METHOD_ALIASES: Record<string, PaymentMethod> = {
  "mobile money": "Mobile Money",
  momo: "Mobile Money",
  "mtn momo": "Mobile Money",
  cash: "Cash",
  "bank transfer": "Bank Transfer",
  bank: "Bank Transfer",
  wire: "Bank Transfer",
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function findColumn(row: Record<string, unknown>, ...candidates: string[]): unknown {
  const normalizedRow = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    normalizedRow.set(normalizeHeader(key), value);
  }
  for (const candidate of candidates) {
    const value = normalizedRow.get(candidate);
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

/** Accepts a JS Date (SheetJS parses real Excel date cells into these
 * automatically), an ISO string, or common "DD/MM/YYYY" / "MM/DD/YYYY"
 * text - falls back to today if the cell can't be read as a date at all,
 * rather than dropping an otherwise-valid row over one bad date cell. */
function parseDate(value: unknown): string {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().split("T")[0];
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value.trim());
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  }
  return new Date().toISOString().split("T")[0];
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && isFinite(value)) return Math.abs(value);
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && isFinite(parsed)) return Math.abs(parsed);
  }
  return null;
}

function parseType(value: unknown, amount: number, rawAmount: unknown): "income" | "expense" {
  const text = String(value ?? "").trim().toLowerCase();
  if (text.startsWith("in") || text === "credit" || text === "cr") return "income";
  if (text.startsWith("ex") || text === "debit" || text === "dr") return "expense";
  // No usable Type column: a negative raw amount is the next-best signal
  // (common in bank/Excel exports), defaulting to income only as a last
  // resort so an ambiguous row doesn't silently vanish from the ledger.
  if (typeof rawAmount === "number" && rawAmount < 0) return "expense";
  if (typeof rawAmount === "string" && rawAmount.trim().startsWith("-")) return "expense";
  return "income";
}

function parsePaymentMethod(value: unknown): PaymentMethod {
  const text = String(value ?? "").trim().toLowerCase();
  return PAYMENT_METHOD_ALIASES[text] ?? "Cash";
}

export async function parseTransactionsFromSpreadsheet(file: File, businessId: string): Promise<SpreadsheetImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { transactions: [], totalRows: 0, skippedRows: 0 };

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const transactions: Transaction[] = [];
  let skippedRows = 0;

  rows.forEach((row, index) => {
    const rawAmount = findColumn(row, "amount", "value", "total");
    const amount = parseAmount(rawAmount);
    if (amount === null || amount <= 0) {
      skippedRows += 1;
      return;
    }

    const description = String(findColumn(row, "description", "notes", "memo", "narration") ?? "").trim();
    const category = String(findColumn(row, "category", "type of expense", "classification") ?? "").trim() || "Uncategorized";

    transactions.push({
      id: `tx-import-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      date: parseDate(findColumn(row, "date", "transaction date")),
      type: parseType(findColumn(row, "type", "direction"), amount, rawAmount),
      category,
      amount,
      description: description || "Imported transaction",
      paymentMethod: parsePaymentMethod(findColumn(row, "payment method", "payment", "channel", "source")),
      businessId,
    });
  });

  return { transactions, totalRows: rows.length, skippedRows };
}
