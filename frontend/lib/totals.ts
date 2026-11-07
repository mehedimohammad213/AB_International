export type TaxRounding = "Round down" | "Round" | "Round up";

export type DraftLine = {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
};

function snap(value: number) {
  const nearest = Math.round(value);
  return Math.abs(value - nearest) < 1e-8 ? nearest : value;
}

export function roundYen(value: number, mode: TaxRounding | string) {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(snap(value));
  let rounded = Math.round(abs);
  if (mode === "Round down") rounded = Math.floor(abs + 1e-8);
  if (mode === "Round up") rounded = Math.ceil(abs - 1e-8);
  return sign * rounded;
}

export function computeTotals(input: {
  lines: DraftLine[];
  discountPercent: number;
  discountFixed: number;
  taxMode: string;
  taxRate: number;
  taxRounding: string;
  otherCharges: number;
}) {
  const lines = input.lines.map((line) => ({
    ...line,
    lineTotal: roundYen(line.qty * line.unitPrice, "Round"),
  }));
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const discount = Math.min(
    subtotal,
    roundYen(subtotal * (input.discountPercent / 100), "Round") + roundYen(input.discountFixed, "Round")
  );
  const base = subtotal - discount;
  const applied = input.taxMode.startsWith("Not") ? 0 : input.taxRate;
  let tax = 0;
  if (input.taxMode.startsWith("Exc")) tax = roundYen(base * applied, input.taxRounding);
  if (input.taxMode.startsWith("Inc")) tax = roundYen((base * applied) / (1 + applied), input.taxRounding);
  const otherCharges = roundYen(input.otherCharges, "Round");
  const grandTotal = base + (input.taxMode.startsWith("Exc") ? tax : 0) + otherCharges;
  return { lines, subtotal, discount, tax, otherCharges, grandTotal };
}
