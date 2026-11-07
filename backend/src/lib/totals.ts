export const TAX_MODES = [
  "Not applied",
  "Exclusive (add to prices)",
  "Inclusive (prices include tax)",
] as const;

export const TAX_ROUNDINGS = ["Round down", "Round", "Round up"] as const;

export type TaxMode = (typeof TAX_MODES)[number];
export type TaxRounding = (typeof TAX_ROUNDINGS)[number];

export type LineInput = {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
};

export type ComputedLine = LineInput & { lineNo: number; lineTotal: number };

export type TotalsInput = {
  lines: LineInput[];
  discountPercent: number;
  discountFixed: number;
  taxMode: TaxMode;
  taxRate: number;
  taxRounding: TaxRounding;
  otherCharges: number;
};

export type Totals = {
  lines: ComputedLine[];
  subtotal: number;
  discount: number;
  discountRate: number;
  tax: number;
  taxRateApplied: number;
  otherCharges: number;
  grandTotal: number;
};

function snap(value: number) {
  const nearest = Math.round(value);
  return Math.abs(value - nearest) < 1e-8 ? nearest : value;
}

export function roundYen(value: number, mode: TaxRounding) {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(snap(value));
  let rounded = Math.round(abs);
  if (mode === "Round down") rounded = Math.floor(abs + 1e-8);
  if (mode === "Round up") rounded = Math.ceil(abs - 1e-8);
  return sign * rounded;
}

export function lineTotal(qty: number, unitPrice: number) {
  return roundYen(qty * unitPrice, "Round");
}

export function computeTotals(input: TotalsInput): Totals {
  const lines = input.lines.map((line, index) => ({
    ...line,
    lineNo: index + 1,
    lineTotal: lineTotal(line.qty, line.unitPrice),
  }));
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const discountRate = input.discountPercent / 100;
  const percentPart = roundYen(subtotal * discountRate, "Round");
  const fixedPart = roundYen(input.discountFixed, "Round");
  const discount = Math.min(subtotal, percentPart + fixedPart);
  const base = subtotal - discount;
  const applied = input.taxMode.startsWith("Not") ? 0 : input.taxRate;
  let tax = 0;
  if (input.taxMode.startsWith("Exc")) tax = roundYen(base * applied, input.taxRounding);
  if (input.taxMode.startsWith("Inc")) {
    tax = roundYen((base * applied) / (1 + applied), input.taxRounding);
  }
  const otherCharges = roundYen(input.otherCharges, "Round");
  const grandTotal = base + (input.taxMode.startsWith("Exc") ? tax : 0) + otherCharges;
  return {
    lines,
    subtotal,
    discount,
    discountRate,
    tax,
    taxRateApplied: applied,
    otherCharges,
    grandTotal,
  };
}
