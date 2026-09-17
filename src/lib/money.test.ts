import { describe, expect, it } from "vitest";
import {
  addMoney,
  applyPercentage,
  calculateInvoiceTotals,
  formatMoney,
  fromMinorUnits,
  multiplyMoney,
  subtractMoney,
  toMinorUnits,
} from "./money";

describe("toMinorUnits / fromMinorUnits", () => {
  it("round-trips a plain 2-decimal amount", () => {
    expect(toMinorUnits(4500.5)).toBe(450050);
    expect(fromMinorUnits(450050)).toBe(4500.5);
  });

  it("uses 0 decimal places for a zero-decimal currency (JPY)", () => {
    expect(toMinorUnits(4500, "JPY")).toBe(4500);
    expect(fromMinorUnits(4500, "JPY")).toBe(4500);
  });

  it("uses 3 decimal places for a three-decimal currency (BHD)", () => {
    expect(toMinorUnits(4.567, "BHD")).toBe(4567);
    expect(fromMinorUnits(4567, "BHD")).toBe(4.567);
  });

  it("rejects a non-finite amount instead of producing NaN money", () => {
    expect(() => toMinorUnits(NaN)).toThrow();
    expect(() => toMinorUnits(Infinity)).toThrow();
  });
});

describe("addMoney / subtractMoney", () => {
  it("adds amounts without floating point drift", () => {
    // 0.1 + 0.2 !== 0.3 in plain floating point - this is exactly the class
    // of bug integer-minor-unit math exists to prevent.
    expect(addMoney(0.1, 0.2)).toBe(0.3);
  });

  it("subtracts without drift", () => {
    expect(subtractMoney(10.0, 0.3)).toBe(9.7);
  });

  it("treats a negative addend as subtraction (used by calculateInvoiceTotals)", () => {
    expect(addMoney(100, -25.5)).toBe(74.5);
  });
});

describe("multiplyMoney", () => {
  it("multiplies a rate by a fractional quantity", () => {
    expect(multiplyMoney(19.99, 2.5)).toBe(49.98);
  });
});

describe("applyPercentage", () => {
  it("applies a whole-number percent", () => {
    expect(applyPercentage(1000, 15)).toBe(150);
  });

  it("applies a fractional percent to 2 decimal places", () => {
    expect(applyPercentage(1000, 7.5)).toBe(75);
  });
});

describe("calculateInvoiceTotals", () => {
  it("computes subtotal, discount, tax, and total for a normal invoice", () => {
    const totals = calculateInvoiceTotals(
      [
        { quantity: 2, rate: 100 },
        { quantity: 1, rate: 50 },
      ],
      10, // 10% discount
      5 // 5% tax
    );
    // subtotal = 250, discount = 25, tax = 12.5, total = 250 - 25 + 12.5
    expect(totals.subtotal).toBe(250);
    expect(totals.discountAmount).toBe(25);
    expect(totals.taxAmount).toBe(12.5);
    expect(totals.total).toBe(237.5);
  });

  it("includes shipping in the total but not in tax/discount base", () => {
    const totals = calculateInvoiceTotals([{ quantity: 1, rate: 100 }], 0, 0, 15);
    expect(totals.subtotal).toBe(100);
    expect(totals.total).toBe(115);
  });

  it("falls back to a zero-value document instead of throwing on a malformed items array", () => {
    // Regression guard: this exact case used to crash the whole render with
    // no error boundary before the defensive Array.isArray check was added.
    const totals = calculateInvoiceTotals(undefined as unknown as [], 10, 5);
    expect(totals).toEqual({ subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0 });
  });

  it("handles an empty items array", () => {
    const totals = calculateInvoiceTotals([], 0, 0);
    expect(totals.total).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats with the given currency symbol and 2 decimal places", () => {
    expect(formatMoney(1234.5, "GHS ")).toBe("GHS 1,234.50");
  });
});
