import type { Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Record-integrity rules for saved invoices and receipts.
 *
 * Aziiki is the business's book of record, so once a document is issued it
 * shouldn't be quietly rewritten. The rules, in one place:
 *
 *  - An invoice is a free working copy only while it is a Draft. From Sent
 *    onward (Sent / Paid / Overdue) it is LOCKED.
 *  - A receipt is proof of payment: locked from the moment it exists.
 *  - Locked documents can still move through their normal life (Draft -> Sent
 *    -> Paid, recording a further part-payment) without ceremony - that is
 *    just doing business - but every such step is still logged.
 *  - Any other change, or deleting the document, needs a written reason of at
 *    least REASON_MIN_LENGTH characters. It is written to the append-only
 *    document_change_log (migration 0060) BEFORE the change is applied, with
 *    exactly what changed (before/after), or a full snapshot for a delete.
 *  - The document number is its identity: never changeable once saved, with
 *    or without a reason.
 */
export const REASON_MIN_LENGTH = 10;
export const REASON_MAX_LENGTH = 500;

export type DocumentKind = "invoice" | "receipt";
export type ChangeAction = "amended" | "deleted" | "status_changed" | "amendment_failed";

// Normal forward progress of an invoice - allowed without a reason.
const FORWARD_STATUS: Record<string, string[]> = {
  Draft: ["Sent", "Paid", "Overdue"],
  Sent: ["Paid", "Overdue"],
  Overdue: ["Paid"],
  Paid: [],
};

/** The trimmed reason if it's long enough, else null. */
export function parseReason(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length < REASON_MIN_LENGTH) return null;
  return trimmed.slice(0, REASON_MAX_LENGTH);
}

export interface InvoiceChangeVerdict {
  /** The invoice is past Draft. */
  locked: boolean;
  /** This change needs a written reason. */
  needsReason: boolean;
  /** Attempt to change the invoice number of a saved invoice. */
  numberChangeBlocked: boolean;
  /** Only normal workflow (status forward / part-payment up) - logged, no reason. */
  workflowOnly: boolean;
}

/**
 * Decides how strict to be with a PATCH to an invoice.
 * `existing` is the stored row (snake_case); `fields` is the validated body
 * WITHOUT changeReason.
 */
export function evaluateInvoiceChange(
  existing: { status: string; invoice_number: string; partial_paid_amount: number | string },
  fields: Record<string, unknown>
): InvoiceChangeVerdict {
  const locked = existing.status !== "Draft";
  const keys = Object.keys(fields).filter((k) => fields[k] !== undefined);

  const numberChangeBlocked =
    locked && fields.invoiceNumber !== undefined && fields.invoiceNumber !== existing.invoice_number;

  if (!locked) {
    return { locked, needsReason: false, numberChangeBlocked, workflowOnly: false };
  }

  const materialKeys = keys.filter((k) => k !== "status" && k !== "partialPaidAmount");
  let workflowOnly = materialKeys.length === 0 && keys.length > 0;

  if (workflowOnly && fields.status !== undefined && fields.status !== existing.status) {
    const allowed = FORWARD_STATUS[existing.status] ?? [];
    if (!allowed.includes(fields.status as string)) workflowOnly = false;
  }
  if (workflowOnly && fields.partialPaidAmount !== undefined) {
    if (Number(fields.partialPaidAmount) < Number(existing.partial_paid_amount)) workflowOnly = false;
  }

  return { locked, needsReason: !workflowOnly, numberChangeBlocked, workflowOnly };
}

/** 428 Precondition Required - the client should ask for a reason and retry. */
export function respondReasonRequired(res: Response, what: string): void {
  res.status(428).json({
    error: `This ${what} is locked to protect your records. To change or delete it, give a reason (at least ${REASON_MIN_LENGTH} characters) - it is saved permanently in the change history.`,
    code: "REASON_REQUIRED",
    minLength: REASON_MIN_LENGTH,
  });
}

export function respondNumberLocked(res: Response, what: string): void {
  res.status(403).json({
    error: `A saved ${what}'s number can't be changed - it identifies the record. Issue a new one instead.`,
    code: "NUMBER_LOCKED",
  });
}

/** Only the keys whose value actually differs, as { key: { from, to } }. */
export function diffFields(pairs: Array<[string, unknown, unknown]>): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, from, to] of pairs) {
    if (JSON.stringify(from ?? null) !== JSON.stringify(to ?? null)) changes[key] = { from: from ?? null, to: to ?? null };
  }
  return changes;
}

export interface ChangeLogEntry {
  businessId: string;
  userId: string;
  documentType: DocumentKind;
  documentId: string;
  documentNumber?: string | null;
  action: ChangeAction;
  reason?: string | null;
  changes: Record<string, unknown>;
}

/**
 * Appends to the change log. Throws on failure: callers write the log BEFORE
 * changing the document, so if the record of a change can't be saved, the
 * change doesn't happen.
 */
export async function logDocumentChange(supabase: SupabaseClient, entry: ChangeLogEntry): Promise<void> {
  const { error } = await supabase.from("document_change_log").insert({
    business_id: entry.businessId,
    user_id: entry.userId,
    document_type: entry.documentType,
    document_id: entry.documentId,
    document_number: entry.documentNumber ?? null,
    action: entry.action,
    reason: entry.reason ?? null,
    changes: entry.changes,
  });
  if (error) throw new Error(`Couldn't save the change history, so nothing was changed: ${error.message}`);
}

/** Best-effort note that a logged amendment then failed to apply. Never throws. */
export async function logAmendmentFailed(supabase: SupabaseClient, entry: Omit<ChangeLogEntry, "action" | "reason" | "changes">, message: string) {
  try {
    await logDocumentChange(supabase, { ...entry, action: "amendment_failed", reason: null, changes: { error: message } });
  } catch {
    // The original error is what the caller reports; this is only a courtesy note.
  }
}
