import { getPool } from "./db";
import { excelDate, isoDate } from "./lib/numbering";

const TERMS = "お支払期限までに下記口座へお振込みください。";

type SeedLine = { description: string; qty: number; unit: string; unitPrice: number };

type SeedInvoice = {
  no: string;
  serial: number;
  date: number;
  due: number;
  customer: string;
  subject: string;
  subtotal: number;
  discount: number;
  tax: number;
  other: number;
  grand: number;
  taxMode: string;
  taxRate: number;
  lines: SeedLine[];
  finalized: number;
};

const invoices: SeedInvoice[] = [
  {
    no: "ABI-2026-0001",
    serial: 1,
    date: 46303,
    due: 46333,
    customer: "CUST-0001",
    subject: "Toshiba Laptob",
    subtotal: 268000,
    discount: 0,
    tax: 26800,
    other: 0,
    grand: 294800,
    taxMode: "Exclusive (add to prices)",
    taxRate: 0.1,
    finalized: 46305.041747685187,
    lines: [
      { description: "Toshiba Laptob", qty: 1, unit: "unit", unitPrice: 250000 },
      { description: "Mouse", qty: 1, unit: "unit", unitPrice: 5000 },
      { description: "Keyboard", qty: 1, unit: "unit", unitPrice: 10000 },
      { description: "Mouse Pad", qty: 1, unit: "unit", unitPrice: 3000 },
    ],
  },
  {
    no: "ABI-2026-0002",
    serial: 2,
    date: 46305,
    due: 46335,
    customer: "CUST-0002",
    subject: "Bicyle",
    subtotal: 27500,
    discount: 0,
    tax: 2750,
    other: 0,
    grand: 30250,
    taxMode: "Exclusive (add to prices)",
    taxRate: 0.1,
    finalized: 46305.044953703713,
    lines: [
      { description: "Bicyle", qty: 1, unit: "unit", unitPrice: 25000 },
      { description: "Tube", qty: 1, unit: "unit", unitPrice: 500 },
      { description: "Mirror", qty: 1, unit: "unit", unitPrice: 2000 },
    ],
  },
  {
    no: "ABI-2026-0003",
    serial: 3,
    date: 46305,
    due: 46335,
    customer: "CUST-0002",
    subject: "中古車販売 TOYOTA HARRIER 2017",
    subtotal: 5500000,
    discount: 0,
    tax: 550000,
    other: 0,
    grand: 6050000,
    taxMode: "Exclusive (add to prices)",
    taxRate: 0.1,
    finalized: 46305.051030092603,
    lines: [{ description: "TOYOTA HARRIER 2017", qty: 1, unit: "unit", unitPrice: 5500000 }],
  },
  {
    no: "ABI-2026-0004",
    serial: 4,
    date: 46305,
    due: 46335,
    customer: "CUST-0003",
    subject: "Mouse Pad",
    subtotal: 34000,
    discount: 0,
    tax: 0,
    other: 0,
    grand: 34000,
    taxMode: "Not applied",
    taxRate: 0,
    finalized: 46305.069895833331,
    lines: [{ description: "Mouse Pad", qty: 1, unit: "unit", unitPrice: 34000 }],
  },
  {
    no: "ABI-2026-0005",
    serial: 5,
    date: 46305,
    due: 46335,
    customer: "CUST-0005",
    subject: "ssssas",
    subtotal: 439493,
    discount: 0,
    tax: 0,
    other: 0,
    grand: 439493,
    taxMode: "Not applied",
    taxRate: 0,
    finalized: 46305.09034722222,
    lines: [{ description: "ssssas", qty: 1, unit: "unit", unitPrice: 439493 }],
  },
  {
    no: "ABI-2026-0006",
    serial: 6,
    date: 46305,
    due: 46335,
    customer: "CUST-0006",
    subject: "",
    subtotal: 13000,
    discount: 0,
    tax: 0,
    other: 0,
    grand: 13000,
    taxMode: "Not applied",
    taxRate: 0,
    finalized: 46305.091562499998,
    lines: [{ description: "ASDFVCVSD", qty: 1, unit: "unit", unitPrice: 13000 }],
  },
];

export async function seed() {
  const pool = getPool();
  const existing = await pool.query("SELECT 1 FROM settings WHERE id = 1");
  if (existing.rows[0]) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO settings (
        id, company_name_ja, company_name_en, postal_code, address, tel_fax, mobile, email, registration_no,
        bank_branch, account_type_number, account_name, transfer_note, document_title, document_subtitle,
        intro_sentence, invoice_prefix, separator, year_format, sequence_digits, restart_each_year,
        next_sequence, sequence_year, last_invoice_no, next_payment_no, next_customer_no, next_draft_no,
        default_due_days, default_terms, default_tax_mode, tax_rate, tax_label, tax_rounding
      ) VALUES (
        1, '株式会社ABINTERNATIONAL', 'AB International', '〒323-1104', '栃木県栃木市藤岡町藤岡２６８１－１',
        '0282 33 9190', '080-4730-4426', '[Enter company email]', 'T1060001034321',
        '栃木銀行 小山支店', '普通 1089719', 'カ) エービーインターナシヨナル',
        '振込手数料は御社ご負担にてお願いいたします。', '請求書', 'INVOICE',
        '下記のとおりご請求申し上げます。', 'ABI', '-', 'YYYY', 4, true,
        7, 2026, 'ABI-2026-0006', 4, 7, 1,
        30, $1, 'Not applied', 0.10, '消費税', 'Round down'
      )`,
      [TERMS]
    );

    const methods = ["銀行振込 Bank transfer", "現金 Cash", "小切手 Cheque", "モバイル決済 Mobile payment", "クレジットカード Card", "その他 Other"];
    const units = ["台", "個", "式", "件", "本", "セット", "pcs", "unit"];
    for (let i = 0; i < methods.length; i += 1) {
      await client.query("INSERT INTO payment_methods (name, sort_order) VALUES ($1, $2)", [methods[i], i + 1]);
    }
    for (let i = 0; i < units.length; i += 1) {
      await client.query("INSERT INTO units (name, sort_order) VALUES ($1, $2)", [units[i], i + 1]);
    }

    const customers = [
      ["CUST-0001", "Md. Shakhawat Bhuiyan", "ABC company", "1230", "Uttara", "234321", "shakhawat@gmail.com", "23454321", "", 46305.038680555554],
      ["CUST-0002", "Md. Risalat Bhuiyan", "1230", "", "Dhanmondi", "9876789", "risalat@gmail.com", "876678", "", 46305.04383101852],
      ["CUST-0003", "Adwa Bhuiyan", "abcd", "2321", "Japan", "32343", "adwa@gmail.com", "343", "", 46305.065787037027],
      ["CUST-0004", "Saifan Bhuiyan", "", "", "", "", "", "", "", 46305.06858796296],
      ["CUST-0005", "Lisa", "dreamagent", "232", "3432", "3432", "23432", "195", "", 46305.089201388888],
      ["CUST-0006", "SDS", "WDS", "195", "", "444", "", "", "", 46305.091087962966],
    ];
    const customerIds = new Map<string, number>();
    for (const row of customers) {
      const inserted = await client.query(
        `INSERT INTO customers (
          customer_code, name, company_name, postal_code, address, phone, email, tax_reg_no, remarks, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING id`,
        [...row.slice(0, 9), excelDate(Number(row[9])).toISOString()]
      );
      customerIds.set(String(row[0]), inserted.rows[0].id);
    }

    const invoiceIds = new Map<string, number>();
    for (const invoice of invoices) {
      const inserted = await client.query(
        `INSERT INTO invoices (
          serial_no, invoice_no, invoice_date, due_date, customer_id, customer_name, customer_phone,
          company_name, postal_code, address, email, customer_reg_no, subject, terms, remarks,
          subtotal, discount, tax, other_charges, grand_total, discount_rate, discount_fixed,
          tax_mode, tax_rate, tax_rounding, tax_label, other_charges_label, line_count, finalized_at
        )
        SELECT $1,$2,$3,$4,c.id,c.name,c.phone,c.company_name,c.postal_code,c.address,c.email,c.tax_reg_no,
               $5,$6,'',$7,$8,$9,$10,$11,0,0,$12,$13,'Round down','消費税','',$14,$15
        FROM customers c WHERE c.customer_code = $16
        RETURNING id`,
        [
          invoice.serial,
          invoice.no,
          isoDate(invoice.date),
          isoDate(invoice.due),
          invoice.subject,
          TERMS,
          invoice.subtotal,
          invoice.discount,
          invoice.tax,
          invoice.other,
          invoice.grand,
          invoice.taxMode,
          invoice.taxRate,
          invoice.lines.length,
          excelDate(invoice.finalized).toISOString(),
          invoice.customer,
        ]
      );
      invoiceIds.set(invoice.no, inserted.rows[0].id);
      for (let i = 0; i < invoice.lines.length; i += 1) {
        const line = invoice.lines[i];
        await client.query(
          `INSERT INTO invoice_lines (invoice_id, line_no, description, qty, unit, unit_price, line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [inserted.rows[0].id, i + 1, line.description, line.qty, line.unit, line.unitPrice, line.qty * line.unitPrice]
        );
      }
    }

    const payments = [
      ["PAY-000001", "ABI-2026-0001", 46305, 294800, 46305.04246527778],
      ["PAY-000002", "ABI-2026-0002", 46305, 30250, 46305.045266203713],
      ["PAY-000003", "ABI-2026-0003", 46305, 6050000, 46305.051817129628],
    ];
    for (const payment of payments) {
      const invoiceNo = String(payment[1]);
      await client.query(
        `INSERT INTO payments (
          payment_code, invoice_id, customer_name, payment_date, amount, method, entry_type, status, recorded_at
        )
        SELECT $1, i.id, i.customer_name, $2, $3, '現金 Cash', 'Payment', 'Active', $4
        FROM invoices i WHERE i.invoice_no = $5`,
        [payment[0], isoDate(Number(payment[2])), payment[3], excelDate(Number(payment[4])).toISOString(), invoiceNo]
      );
    }

    const audits: [number, string, string, string, string][] = [
      [46305.038680555554, "md. Arafat", "Add customer", "CUST-0001", "Md. Shakhawat Bhuiyan"],
      [46305.041747685187, "md. Arafat", "Finalize invoice", "ABI-2026-0001", "Md. Shakhawat Bhuiyan / ¥294,800 / 4 line(s)"],
      [46305.04246527778, "md. Arafat", "Record payment", "ABI-2026-0001", "PAY-000001 / ¥294,800 / 現金 Cash"],
      [46305.042812500003, "md. Arafat", "Export PDF", "ABI-2026-0001", "ABI-2026-0001.pdf"],
      [46305.04383101852, "md. Arafat", "Add customer", "CUST-0002", "Md. Risalat Bhuiyan"],
      [46305.044953703713, "md. Arafat", "Finalize invoice", "ABI-2026-0002", "Md. Risalat Bhuiyan / ¥30,250 / 3 line(s)"],
      [46305.045266203713, "md. Arafat", "Record payment", "ABI-2026-0002", "PAY-000002 / ¥30,250 / 現金 Cash"],
      [46305.045520833337, "md. Arafat", "Export PDF", "ABI-2026-0002", "ABI-2026-0002.pdf"],
      [46305.048159722217, "md. Arafat", "Export PDF", "DRAFT", "DRAFT_20261010_010920.pdf"],
      [46305.051030092603, "md. Arafat", "Finalize invoice", "ABI-2026-0003", "Md. Risalat Bhuiyan / ¥6,050,000 / 1 line(s)"],
      [46305.051817129628, "md. Arafat", "Record payment", "ABI-2026-0003", "PAY-000003 / ¥6,050,000 / 現金 Cash"],
      [46305.052268518521, "md. Arafat", "Export PDF", "ABI-2026-0003", "ABI-2026-0003.pdf"],
      [46305.065787037027, "md. Arafat", "Add customer", "CUST-0003", "Adwa Bhuiyan"],
      [46305.06858796296, "md. Arafat", "Add customer", "CUST-0004", "Saifan Bhuiyan"],
      [46305.069895833331, "md. Arafat", "Finalize invoice", "ABI-2026-0004", "Adwa Bhuiyan / ¥34,000 / 1 line(s)"],
      [46305.083749999998, "Claude (correction)", "Correct payment date", "ABI-2026-0001", "PAY-000001: payment date 2025/10/10 -> 2026/10/10"],
      [46305.083749999998, "Claude (correction)", "Correct payment date", "ABI-2026-0002", "PAY-000002: payment date 2025/10/10 -> 2026/10/10"],
      [46305.083749999998, "Claude (correction)", "Correct payment date", "ABI-2026-0003", "PAY-000003: payment date 2025/10/10 -> 2026/10/10"],
      [46305.089201388888, "md. Arafat", "Add customer", "CUST-0005", "Lisa"],
      [46305.09034722222, "md. Arafat", "Finalize invoice", "ABI-2026-0005", "Lisa / ¥439,493 / 1 line(s)"],
      [46305.091087962966, "md. Arafat", "Add customer", "CUST-0006", "SDS"],
      [46305.091562499998, "md. Arafat", "Finalize invoice", "ABI-2026-0006", "SDS / ¥13,000 / 1 line(s)"],
      [46317.81355324074, "md. Arafat", "Export PDF", "ABI-2026-0002", "ABI-2026-0002.pdf"],
      [46317.81925925926, "md. Arafat", "Save customer changes", "", "0 customer(s); 0 new ID(s)"],
    ];
    for (const entry of audits) {
      await client.query(
        `INSERT INTO audit_log (occurred_at, operator_name, action, document, details) VALUES ($1,$2,$3,$4,$5)`,
        [excelDate(entry[0]).toISOString(), entry[1], entry[2], entry[3], entry[4]]
      );
    }

    await client.query("COMMIT");
    console.log(`Seeded ${customers.length} customers, ${invoices.length} invoices, ${payments.length} payments.`);
    void customerIds;
    void invoiceIds;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
