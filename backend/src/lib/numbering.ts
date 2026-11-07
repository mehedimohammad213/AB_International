export function formatCode(prefix: string, value: number, width: number) {
  return `${prefix}${String(value).padStart(width, "0")}`;
}

export function formatInvoiceNo(
  settings: {
    invoicePrefix: string;
    separator: string;
    yearFormat: string;
    sequenceDigits: number;
  },
  year: number,
  sequence: number
) {
  const sep = settings.separator || "-";
  const digits = String(sequence).padStart(settings.sequenceDigits, "0");
  if (settings.yearFormat === "None") return `${settings.invoicePrefix}${sep}${digits}`;
  const yearText = settings.yearFormat === "YY" ? String(year).slice(-2) : String(year);
  return `${settings.invoicePrefix}${sep}${yearText}${sep}${digits}`;
}

export function excelDate(serial: number) {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
}

export function isoDate(serial: number) {
  return excelDate(serial).toISOString().slice(0, 10);
}
