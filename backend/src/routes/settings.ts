import { Router } from "express";
import { z } from "zod";
import { camel, query } from "../db";
import { asyncRoute, HttpError } from "../lib/http";
import { formatInvoiceNo } from "../lib/numbering";
import { TAX_MODES, TAX_ROUNDINGS } from "../lib/totals";

const router = Router();

const settingsSchema = z.object({
  companyNameJa: z.string().min(1),
  companyNameEn: z.string().min(1),
  postalCode: z.string().default(""),
  address: z.string().default(""),
  telFax: z.string().default(""),
  mobile: z.string().default(""),
  email: z.string().default(""),
  registrationNo: z.string().default(""),
  bankBranch: z.string().default(""),
  accountTypeNumber: z.string().default(""),
  accountName: z.string().default(""),
  transferNote: z.string().default(""),
  documentTitle: z.string().min(1),
  documentSubtitle: z.string().default(""),
  introSentence: z.string().default(""),
  invoicePrefix: z.string().min(1).max(12),
  separator: z.string().min(1).max(3),
  yearFormat: z.enum(["YYYY", "YY", "None"]),
  sequenceDigits: z.number().int().min(3).max(8),
  restartEachYear: z.boolean(),
  nextSequence: z.number().int().min(1),
  sequenceYear: z.number().int().min(2000).max(2100),
  nextPaymentNo: z.number().int().min(1),
  nextCustomerNo: z.number().int().min(1),
  nextDraftNo: z.number().int().min(1),
  defaultDueDays: z.number().int().min(0).max(365),
  defaultTerms: z.string().default(""),
  defaultTaxMode: z.enum(TAX_MODES),
  taxRate: z.number().min(0).max(0.5),
  taxLabel: z.string().min(1),
  taxRounding: z.enum(TAX_ROUNDINGS),
});

export async function loadSettingsBundle() {
  const settingsResult = await query("SELECT * FROM settings WHERE id = 1");
  const settings = camel<Record<string, unknown>>(settingsResult.rows[0]);
  const year = new Date().getFullYear();
  let sequence = Number(settings.nextSequence);
  if (settings.restartEachYear && Number(settings.sequenceYear) !== year) sequence = 1;
  const methods = await query("SELECT name FROM payment_methods ORDER BY sort_order, id");
  const units = await query("SELECT name FROM units ORDER BY sort_order, id");
  return {
    settings: {
      ...settings,
      nextInvoicePreview: formatInvoiceNo(
        {
          invoicePrefix: String(settings.invoicePrefix),
          separator: String(settings.separator),
          yearFormat: String(settings.yearFormat),
          sequenceDigits: Number(settings.sequenceDigits),
        },
        year,
        sequence
      ),
    },
    methods: methods.rows.map((row) => row.name as string),
    units: units.rows.map((row) => row.name as string),
    taxModes: TAX_MODES,
    taxRoundings: TAX_ROUNDINGS,
  };
}

router.get(
  "/",
  asyncRoute(async (_req, res) => {
    res.json(await loadSettingsBundle());
  })
);

router.put(
  "/",
  asyncRoute(async (req, res) => {
    const body = settingsSchema.parse(req.body);
    await query(
      `UPDATE settings SET
        company_name_ja = $1, company_name_en = $2, postal_code = $3, address = $4,
        tel_fax = $5, mobile = $6, email = $7, registration_no = $8,
        bank_branch = $9, account_type_number = $10, account_name = $11, transfer_note = $12,
        document_title = $13, document_subtitle = $14, intro_sentence = $15,
        invoice_prefix = $16, separator = $17, year_format = $18, sequence_digits = $19,
        restart_each_year = $20, next_sequence = $21, sequence_year = $22,
        next_payment_no = $23, next_customer_no = $24, next_draft_no = $25,
        default_due_days = $26, default_terms = $27, default_tax_mode = $28,
        tax_rate = $29, tax_label = $30, tax_rounding = $31, updated_at = now()
       WHERE id = 1`,
      [
        body.companyNameJa.trim(),
        body.companyNameEn.trim(),
        body.postalCode.trim(),
        body.address.trim(),
        body.telFax.trim(),
        body.mobile.trim(),
        body.email.trim(),
        body.registrationNo.trim(),
        body.bankBranch.trim(),
        body.accountTypeNumber.trim(),
        body.accountName.trim(),
        body.transferNote.trim(),
        body.documentTitle.trim(),
        body.documentSubtitle.trim(),
        body.introSentence.trim(),
        body.invoicePrefix.trim(),
        body.separator,
        body.yearFormat,
        body.sequenceDigits,
        body.restartEachYear,
        body.nextSequence,
        body.sequenceYear,
        body.nextPaymentNo,
        body.nextCustomerNo,
        body.nextDraftNo,
        body.defaultDueDays,
        body.defaultTerms.trim(),
        body.defaultTaxMode,
        body.taxRate,
        body.taxLabel.trim(),
        body.taxRounding,
      ]
    );
    res.json(await loadSettingsBundle());
  })
);

const listsSchema = z.object({
  methods: z.array(z.string()).min(1),
  units: z.array(z.string()).min(1),
});

router.put(
  "/lists",
  asyncRoute(async (req, res) => {
    const body = listsSchema.parse(req.body);
    const methods = [...new Set(body.methods.map((item) => item.trim()).filter(Boolean))];
    const units = [...new Set(body.units.map((item) => item.trim()).filter(Boolean))];
    if (methods.length === 0 || units.length === 0) {
      throw new HttpError(400, "Keep at least one payment method and one unit.");
    }
    await query("DELETE FROM payment_methods");
    await query("DELETE FROM units");
    for (let i = 0; i < methods.length; i += 1) {
      await query("INSERT INTO payment_methods (name, sort_order) VALUES ($1, $2)", [methods[i], i + 1]);
    }
    for (let i = 0; i < units.length; i += 1) {
      await query("INSERT INTO units (name, sort_order) VALUES ($1, $2)", [units[i], i + 1]);
    }
    res.json(await loadSettingsBundle());
  })
);

export default router;
