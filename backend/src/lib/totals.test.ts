import assert from "node:assert/strict";
import test from "node:test";
import { formatInvoiceNo } from "./numbering";
import { computeTotals } from "./totals";

test("exclusive 10% matches the issued workbook invoices", () => {
  const laptop = computeTotals({
    lines: [
      { description: "Toshiba Laptob", qty: 1, unit: "unit", unitPrice: 250000 },
      { description: "Mouse", qty: 1, unit: "unit", unitPrice: 5000 },
      { description: "Keyboard", qty: 1, unit: "unit", unitPrice: 10000 },
      { description: "Mouse Pad", qty: 1, unit: "unit", unitPrice: 3000 },
    ],
    discountPercent: 0,
    discountFixed: 0,
    taxMode: "Exclusive (add to prices)",
    taxRate: 0.1,
    taxRounding: "Round down",
    otherCharges: 0,
  });
  assert.equal(laptop.subtotal, 268000);
  assert.equal(laptop.tax, 26800);
  assert.equal(laptop.grandTotal, 294800);

  const bike = computeTotals({
    lines: [
      { description: "Bicyle", qty: 1, unit: "unit", unitPrice: 25000 },
      { description: "Tube", qty: 1, unit: "unit", unitPrice: 500 },
      { description: "Mirror", qty: 1, unit: "unit", unitPrice: 2000 },
    ],
    discountPercent: 0,
    discountFixed: 0,
    taxMode: "Exclusive (add to prices)",
    taxRate: 0.1,
    taxRounding: "Round down",
    otherCharges: 0,
  });
  assert.equal(bike.subtotal, 27500);
  assert.equal(bike.tax, 2750);
  assert.equal(bike.grandTotal, 30250);
});

test("inclusive tax stays inside the item prices", () => {
  const totals = computeTotals({
    lines: [{ description: "Part", qty: 1, unit: "個", unitPrice: 1100 }],
    discountPercent: 10,
    discountFixed: 0,
    taxMode: "Inclusive (prices include tax)",
    taxRate: 0.1,
    taxRounding: "Round",
    otherCharges: 0,
  });
  assert.equal(totals.discount, 110);
  assert.equal(totals.tax, 90);
  assert.equal(totals.grandTotal, 990);
});

test("discount percent and fixed amount are capped at the subtotal", () => {
  const totals = computeTotals({
    lines: [{ description: "Item", qty: 2, unit: "件", unitPrice: 500 }],
    discountPercent: 50,
    discountFixed: 800,
    taxMode: "Not applied",
    taxRate: 0.1,
    taxRounding: "Round down",
    otherCharges: 100,
  });
  assert.equal(totals.subtotal, 1000);
  assert.equal(totals.discount, 1000);
  assert.equal(totals.tax, 0);
  assert.equal(totals.grandTotal, 100);
});

test("invoice numbers follow prefix, year format and padding", () => {
  assert.equal(
    formatInvoiceNo(
      { invoicePrefix: "ABI", separator: "-", yearFormat: "YYYY", sequenceDigits: 4 },
      2026,
      7
    ),
    "ABI-2026-0007"
  );
  assert.equal(
    formatInvoiceNo(
      { invoicePrefix: "ABI", separator: "-", yearFormat: "None", sequenceDigits: 4 },
      2026,
      7
    ),
    "ABI-0007"
  );
});
