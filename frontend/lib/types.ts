export type Settings = {
  companyNameJa: string;
  companyNameEn: string;
  postalCode: string;
  address: string;
  telFax: string;
  mobile: string;
  email: string;
  registrationNo: string;
  bankBranch: string;
  accountTypeNumber: string;
  accountName: string;
  transferNote: string;
  documentTitle: string;
  documentSubtitle: string;
  introSentence: string;
  currency: string;
  currencySymbol: string;
  invoicePrefix: string;
  separator: string;
  yearFormat: "YYYY" | "YY" | "None";
  sequenceDigits: number;
  restartEachYear: boolean;
  nextSequence: number;
  sequenceYear: number;
  lastInvoiceNo: string;
  nextPaymentNo: number;
  nextCustomerNo: number;
  nextDraftNo: number;
  defaultDueDays: number;
  defaultTerms: string;
  defaultTaxMode: string;
  taxRate: number;
  taxLabel: string;
  taxRounding: string;
  nextInvoicePreview: string;
};

export type SettingsBundle = {
  settings: Settings;
  methods: string[];
  units: string[];
  taxModes: string[];
  taxRoundings: string[];
};

export type Customer = {
  id: number;
  customerCode: string;
  name: string;
  companyName: string;
  postalCode: string;
  address: string;
  phone: string;
  email: string;
  taxRegNo: string;
  remarks: string;
  duplicateName: boolean;
  duplicateNamePhone: boolean;
  createdAt: string;
};

export type CustomerPage = {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
};

export type CustomerInput = {
  name: string;
  companyName: string;
  postalCode: string;
  address: string;
  phone: string;
  email: string;
  taxRegNo: string;
  remarks: string;
};

export type Line = {
  lineNo?: number;
  description: string;
  qty: number | null;
  unit: string;
  unitPrice: number | null;
  lineTotal?: number;
};

export type Draft = {
  id: number;
  draftCode: string;
  status: string;
  invoiceDate: string | null;
  dueDate: string | null;
  customerId: number | null;
  customerName?: string;
  customerCode?: string;
  subject: string;
  terms: string;
  remarks: string;
  discountRate: number;
  discountFixed: number;
  taxMode: string;
  taxRate: number;
  taxRounding: string;
  otherChargesLabel: string;
  otherCharges: number;
  replacesInvoiceId: number | null;
  replacesNo?: string | null;
  estimatedTotal: number;
  finalizedInvoiceId: number | null;
  savedAt: string;
  lines: Line[];
};

export type Invoice = {
  id: number;
  serialNo: number;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  customerId: number | null;
  customerCode?: string;
  customerName: string;
  customerPhone: string;
  companyName: string;
  postalCode: string;
  address: string;
  email: string;
  customerRegNo: string;
  subject: string;
  terms: string;
  remarks: string;
  subtotal: number;
  discount: number;
  tax: number;
  otherCharges: number;
  grandTotal: number;
  discountRate: number;
  discountFixed: number;
  taxMode: string;
  taxRate: number;
  taxRounding: string;
  taxLabel: string;
  otherChargesLabel: string;
  lineCount: number;
  recordStatus: string;
  replacesNo?: string | null;
  replacedByNo?: string | null;
  finalizedAt: string;
  cancelledAt: string | null;
  cancelReason: string;
  received: number;
  outstanding: number;
  paymentStatus: string;
  lastPaymentDate: string | null;
  overdue: string;
  daysOverdue: number | null;
  lines?: Line[];
  payments?: Payment[];
};

export type Payment = {
  id: number;
  paymentCode: string;
  invoiceId: number;
  invoiceNo?: string;
  customerName: string;
  paymentDate: string;
  amount: number;
  method: string;
  reference: string;
  remarks: string;
  entryType: string;
  reversesCode?: string | null;
  status: string;
  flag: string;
  recordedAt: string;
};

export type Dashboard = {
  year: number;
  finalizedInvoices: number;
  totalInvoiced: number;
  paymentsReceived: number;
  outstanding: number;
  unpaid: number;
  partiallyPaid: number;
  fullyPaid: number;
  overdueInvoices: number;
  overdueReceivables: number;
  cancelled: number;
  paymentsOutsideYear: number;
  months: {
    month: number;
    invoicesIssued: number;
    invoiceValue: number;
    paymentsReceived: number;
    outstanding: number;
  }[];
};

export type AuditEntry = {
  id: number;
  occurredAt: string;
  operatorName: string;
  action: string;
  document: string;
  details: string;
};
