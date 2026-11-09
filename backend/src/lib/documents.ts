import { z } from "zod";
import { TAX_MODES, TAX_ROUNDINGS, computeTotals, type TaxMode, type TaxRounding } from "./totals";
import { HttpError } from "./http";

const lineSchema = z.object({
  description: z.string().default(""),
  qty: z.number().finite().nullable().optional(),
  unit: z.string().default(""),
  unitPrice: z.number().finite().nullable().optional(),
});

export const documentSchema = z.object({
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  customerId: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
    z.number().int().positive().nullable().optional()
  ),
  subject: z.string().default(""),
  terms: z.string().default(""),
  remarks: z.string().default(""),
  discountPercent: z.number().min(0).max(100).default(0),
  discountFixed: z.number().int().min(0).default(0),
  taxMode: z.enum(TAX_MODES),
  taxRate: z.number().min(0).max(0.5),
  taxRounding: z.enum(TAX_ROUNDINGS),
  otherChargesLabel: z.string().default(""),
  otherCharges: z.number().int().default(0),
  lines: z.array(lineSchema).max(30),
});

export type DocumentInput = z.infer<typeof documentSchema>;

function isCompleteLine(line: {
  description: string;
  qty: number | null;
  unit: string;
  unitPrice: number | null;
}) {
  return (
    Boolean(line.description) &&
    line.qty != null &&
    line.qty > 0 &&
    line.unitPrice != null &&
    Number.isInteger(line.unitPrice) &&
    line.unitPrice >= 0
  );
}

function isBlankLine(line: {
  description: string;
  qty: number | null;
  unit: string;
  unitPrice: number | null;
}) {
  // Placeholder rows from the form (default qty/unit, no description/price) are ignored.
  return !line.description && line.unitPrice == null;
}

export function prepareDocument(input: DocumentInput, requireComplete: boolean) {
  let lines = input.lines
    .map((line) => ({
      description: line.description.trim(),
      qty: line.qty ?? null,
      unit: (line.unit || "").trim(),
      unitPrice: line.unitPrice ?? null,
    }))
    .filter((line) => !isBlankLine(line));

  if (lines.length > 30) throw new HttpError(400, "An invoice can have at most 30 lines.");

  if (requireComplete) {
    for (const line of lines) {
      if (!line.description) throw new HttpError(400, "Every item needs a description.");
      if (line.qty == null || line.qty <= 0) throw new HttpError(400, `Quantity for “${line.description}” must be greater than 0.`);
      if (line.unitPrice == null || !Number.isInteger(line.unitPrice) || line.unitPrice < 0) {
        throw new HttpError(400, `Unit price for “${line.description}” must be a whole yen amount.`);
      }
    }
    if (!input.invoiceDate) throw new HttpError(400, "Enter the invoice date.");
    if (!input.customerId) throw new HttpError(400, "Choose a customer.");
    if (lines.length === 0) throw new HttpError(400, "Add at least one item.");
  } else {
    lines = lines.filter(isCompleteLine);
  }

  const totals = computeTotals({
    lines: lines.map((line) => ({
      description: line.description,
      qty: line.qty ?? 0,
      unit: line.unit,
      unitPrice: line.unitPrice ?? 0,
    })),
    discountPercent: input.discountPercent,
    discountFixed: input.discountFixed,
    taxMode: input.taxMode as TaxMode,
    taxRate: input.taxRate,
    taxRounding: input.taxRounding as TaxRounding,
    otherCharges: input.otherCharges,
  });

  return { input, lines: totals.lines, totals };
}

export function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
