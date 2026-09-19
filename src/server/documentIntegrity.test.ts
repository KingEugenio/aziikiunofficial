import { describe, expect, it } from "vitest";
import { REASON_MIN_LENGTH, diffFields, evaluateInvoiceChange, parseReason } from "./documentIntegrity";

const sent = { status: "Sent", invoice_number: "INV-0001", partial_paid_amount: 0 };
const draft = { status: "Draft", invoice_number: "INV-0002", partial_paid_amount: 0 };

describe("parseReason", () => {
  it("accepts a real reason and trims it", () => {
    expect(parseReason("  Customer asked for a corrected quantity  ")).toBe("Customer asked for a corrected quantity");
  });
  it("rejects missing, non-string and too-short reasons", () => {
    expect(parseReason(undefined)).toBeNull();
    expect(parseReason(42)).toBeNull();
    expect(parseReason("typo")).toBeNull();
    expect(parseReason(" ".repeat(20))).toBeNull();
    expect(parseReason("x".repeat(REASON_MIN_LENGTH - 1))).toBeNull();
  });
  it("caps very long reasons instead of failing", () => {
    expect(parseReason("y".repeat(900))!.length).toBe(500);
  });
});

describe("evaluateInvoiceChange", () => {
  it("leaves a Draft completely free to edit", () => {
    const v = evaluateInvoiceChange(draft, { items: [{}], discount: 5, invoiceNumber: "INV-9999" });
    expect(v.locked).toBe(false);
    expect(v.needsReason).toBe(false);
    expect(v.numberChangeBlocked).toBe(false);
  });

  it("needs a reason for any material change to a saved invoice", () => {
    for (const fields of [{ items: [] }, { discount: 10 }, { taxRate: 5 }, { dueDate: "2026-12-01" }, { customerId: "c1" }, { currency: "USD" }]) {
      expect(evaluateInvoiceChange(sent, fields).needsReason).toBe(true);
    }
  });

  it("lets a saved invoice move forward through its normal life without a reason", () => {
    expect(evaluateInvoiceChange(sent, { status: "Paid" })).toMatchObject({ needsReason: false, workflowOnly: true });
    expect(evaluateInvoiceChange(sent, { status: "Overdue" }).needsReason).toBe(false);
    expect(evaluateInvoiceChange({ ...sent, status: "Overdue" }, { status: "Paid" }).needsReason).toBe(false);
  });

  it("lets more of a part-payment be recorded, but not less", () => {
    const partial = { ...sent, partial_paid_amount: 100 };
    expect(evaluateInvoiceChange(partial, { partialPaidAmount: 150 }).needsReason).toBe(false);
    expect(evaluateInvoiceChange(partial, { partialPaidAmount: 40 }).needsReason).toBe(true);
  });

  it("treats going backwards as a change that needs a reason - including 'un-locking' back to Draft", () => {
    expect(evaluateInvoiceChange({ ...sent, status: "Paid" }, { status: "Sent" }).needsReason).toBe(true);
    expect(evaluateInvoiceChange({ ...sent, status: "Paid" }, { status: "Overdue" }).needsReason).toBe(true);
    expect(evaluateInvoiceChange(sent, { status: "Draft" }).needsReason).toBe(true);
  });

  it("does not let a status change smuggle in a material change", () => {
    expect(evaluateInvoiceChange(sent, { status: "Paid", discount: 50 }).needsReason).toBe(true);
  });

  it("never allows the number of a saved invoice to change, reason or not", () => {
    expect(evaluateInvoiceChange(sent, { invoiceNumber: "INV-7777" }).numberChangeBlocked).toBe(true);
    // Re-sending the same number is not a change.
    expect(evaluateInvoiceChange(sent, { invoiceNumber: "INV-0001" }).numberChangeBlocked).toBe(false);
  });
});

describe("diffFields", () => {
  it("keeps only what actually changed, as before/after", () => {
    expect(
      diffFields([
        ["discount", 0, 10],
        ["taxRate", 15, 15],
        ["items", [{ description: "a", quantity: 1, rate: 5 }], [{ description: "a", quantity: 2, rate: 5 }]],
      ])
    ).toEqual({
      discount: { from: 0, to: 10 },
      items: { from: [{ description: "a", quantity: 1, rate: 5 }], to: [{ description: "a", quantity: 2, rate: 5 }] },
    });
  });
  it("treats undefined and null as the same 'empty'", () => {
    expect(diffFields([["customClientName", undefined, null]])).toEqual({});
  });
});
