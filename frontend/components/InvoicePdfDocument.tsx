"use client";

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { yen, ymdJa } from "@/lib/format";
import { ensurePdfFonts } from "@/lib/pdf-fonts";
import type { Invoice, Settings } from "@/lib/types";

ensurePdfFonts();

const MIN_ITEM_ROWS = 7;
const ACCENT = "#3A7FC1";

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 10,
    color: "#111",
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 42,
  },
  titleBox: {
    borderWidth: 1,
    borderColor: "#111",
    backgroundColor: ACCENT,
    paddingVertical: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 8,
    color: "#111",
  },
  dateRow: {
    alignItems: "flex-end",
    marginBottom: 14,
  },
  dateText: {
    fontSize: 11,
  },
  invoiceNo: {
    fontSize: 9,
    marginTop: 2,
  },
  banner: {
    backgroundColor: "#fff6df",
    borderWidth: 1,
    borderColor: "#d7b56a",
    borderStyle: "dashed",
    padding: 8,
    marginBottom: 10,
  },
  bannerBad: {
    backgroundColor: "#fdecee",
    borderColor: "#e7b4bc",
  },
  parties: {
    flexDirection: "row",
    marginBottom: 16,
  },
  partyLeft: {
    width: "50%",
    paddingRight: 12,
  },
  partyRight: {
    width: "50%",
    paddingLeft: 12,
  },
  line: { marginBottom: 2, fontSize: 10 },
  lineRight: { marginBottom: 2, fontSize: 10, textAlign: "right" },
  partyName: { fontSize: 12, fontWeight: 700, marginTop: 4, marginBottom: 2 },
  partyNameRight: { fontSize: 12, fontWeight: 700, marginTop: 4, marginBottom: 2, textAlign: "right" },
  intro: { marginBottom: 12, fontSize: 10 },
  amountBox: {
    borderWidth: 1,
    borderColor: "#111",
    flexDirection: "row",
    marginBottom: 14,
  },
  amountLabelCell: {
    width: "40%",
    borderRightWidth: 1,
    borderRightColor: "#111",
    backgroundColor: ACCENT,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  amountLabel: {
    fontSize: 13,
    fontWeight: 700,
    textAlign: "center",
  },
  amountValueCell: {
    width: "60%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  amountValue: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: "center",
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#111",
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111",
    backgroundColor: ACCENT,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111",
    minHeight: 22,
  },
  tableRowLast: {
    flexDirection: "row",
    minHeight: 22,
  },
  th: {
    fontSize: 10,
    fontWeight: 700,
    textAlign: "center",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  td: {
    fontSize: 9,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  cItem: {
    width: "58%",
    borderRightWidth: 1,
    borderRightColor: "#111",
  },
  cQty: {
    width: "14%",
    borderRightWidth: 1,
    borderRightColor: "#111",
    textAlign: "center",
  },
  cAmt: {
    width: "28%",
    textAlign: "right",
  },
  summaryWrap: {
    alignItems: "flex-end",
    marginBottom: 16,
  },
  summaryTable: {
    width: "42%",
    borderWidth: 1,
    borderColor: "#111",
  },
  summaryRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111",
    minHeight: 22,
  },
  summaryRowLast: {
    flexDirection: "row",
    minHeight: 22,
  },
  summaryLabelCell: {
    width: "45%",
    borderRightWidth: 1,
    borderRightColor: "#111",
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: 700,
    textAlign: "center",
  },
  summaryValueCell: {
    width: "55%",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  summaryValue: {
    fontSize: 10,
    textAlign: "right",
  },
  bankBlock: {
    marginBottom: 14,
  },
  bankTitle: {
    fontWeight: 700,
    marginBottom: 4,
    fontSize: 11,
  },
  remarksBox: {
    borderWidth: 1,
    borderColor: "#111",
    minHeight: 70,
    padding: 8,
  },
  remarksTitle: {
    fontWeight: 700,
    marginBottom: 4,
  },
});

function displayName(invoice: Invoice) {
  const company = invoice.companyName.trim();
  const person = invoice.customerName.trim();
  if (company) return company;
  return person;
}

export default function InvoicePdfDocument({
  settings,
  invoice,
  draft = false,
}: {
  settings: Settings;
  invoice: Invoice;
  draft?: boolean;
  logoSrc?: string;
}) {
  const postal = invoice.postalCode.replace(/^〒/, "").trim();
  const companyPostal = settings.postalCode.replace(/^〒/, "").trim();
  const lines = invoice.lines || [];
  const blankCount = Math.max(0, MIN_ITEM_ROWS - lines.length);
  const intro = settings.introSentence?.trim() || "下記のとおりご請求書申し上げます";

  const summaryRows: { label: string; value: string; last?: boolean }[] = [
    { label: "小計", value: invoice.subtotal ? yen(invoice.subtotal) : "" },
  ];
  if (invoice.discount) summaryRows.push({ label: "値引", value: yen(-invoice.discount) });
  summaryRows.push({ label: "消費税", value: invoice.tax ? yen(invoice.tax) : "" });
  if (invoice.otherCharges) {
    summaryRows.push({ label: invoice.otherChargesLabel || "その他", value: yen(invoice.otherCharges) });
  }
  summaryRows.push({ label: "合計(税込)", value: yen(invoice.grandTotal), last: true });

  return (
    <Document
      title={`${invoice.invoiceNo || "invoice"}`}
      author={settings.companyNameEn || "AB International"}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.titleBox}>
          <Text style={styles.title}>{settings.documentTitle || "請求書"}</Text>
        </View>

        <View style={styles.dateRow}>
          <Text style={styles.dateText}>{ymdJa(invoice.invoiceDate)}</Text>
          {invoice.invoiceNo ? <Text style={styles.invoiceNo}>請求書番号 {invoice.invoiceNo}</Text> : null}
        </View>

        {draft && (
          <View style={styles.banner}>
            <Text>下書き DRAFT — 未確定 / not a finalized invoice</Text>
          </View>
        )}
        {invoice.recordStatus === "Cancelled" && (
          <View style={[styles.banner, styles.bannerBad]}>
            <Text>取消 CANCELLED — この請求書は無効です / this invoice has been cancelled</Text>
          </View>
        )}

        <View style={styles.parties}>
          <View style={styles.partyLeft}>
            {postal ? <Text style={styles.line}>〒{postal}</Text> : null}
            {invoice.address ? <Text style={styles.line}>{invoice.address}</Text> : null}
            {displayName(invoice) ? <Text style={styles.partyName}>{displayName(invoice)}</Text> : null}
          </View>
          <View style={styles.partyRight}>
            {companyPostal ? <Text style={styles.lineRight}>〒{companyPostal}</Text> : null}
            {settings.address ? <Text style={styles.lineRight}>{settings.address}</Text> : null}
            <Text style={styles.partyNameRight}>{settings.companyNameJa || settings.companyNameEn}</Text>
            {settings.telFax ? <Text style={styles.lineRight}>TEL/FAX: {settings.telFax}</Text> : null}
            {settings.mobile ? <Text style={styles.lineRight}>携帯：{settings.mobile}</Text> : null}
          </View>
        </View>

        <Text style={styles.intro}>{intro}</Text>

        <View style={styles.amountBox}>
          <View style={styles.amountLabelCell}>
            <Text style={styles.amountLabel}>合計金額</Text>
          </View>
          <View style={styles.amountValueCell}>
            <Text style={styles.amountValue}>{yen(invoice.grandTotal)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.cItem, { textAlign: "center" }]}>商品</Text>
            <Text style={[styles.th, styles.cQty]}>数量</Text>
            <Text style={[styles.th, styles.cAmt, { textAlign: "center" }]}>金額</Text>
          </View>

          {lines.map((line, index) => (
            <View
              key={`${line.description}-${index}`}
              style={index === lines.length - 1 && blankCount === 0 ? styles.tableRowLast : styles.tableRow}
              wrap={false}
            >
              <Text style={[styles.td, styles.cItem]}>{line.description}</Text>
              <Text style={[styles.td, styles.cQty]}>{line.qty ?? ""}</Text>
              <Text style={[styles.td, styles.cAmt]}>{yen(line.lineTotal)}</Text>
            </View>
          ))}

          {Array.from({ length: blankCount }).map((_, index) => (
            <View
              key={`blank-${index}`}
              style={index === blankCount - 1 ? styles.tableRowLast : styles.tableRow}
              wrap={false}
            >
              <Text style={[styles.td, styles.cItem]}> </Text>
              <Text style={[styles.td, styles.cQty]}> </Text>
              <Text style={[styles.td, styles.cAmt]}> </Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryWrap} wrap={false}>
          <View style={styles.summaryTable}>
            {summaryRows.map((row) => (
              <View key={row.label} style={row.last ? styles.summaryRowLast : styles.summaryRow}>
                <View style={styles.summaryLabelCell}>
                  <Text style={styles.summaryLabel}>{row.label}</Text>
                </View>
                <View style={styles.summaryValueCell}>
                  <Text style={[styles.summaryValue, row.last ? { fontWeight: 700 } : undefined]}>{row.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.bankBlock}>
          <Text style={styles.bankTitle}>振込先</Text>
          {settings.accountName ? <Text style={styles.line}>{settings.accountName}</Text> : null}
          {settings.bankBranch ? <Text style={styles.line}>{settings.bankBranch}</Text> : null}
          {settings.accountTypeNumber ? <Text style={styles.line}>{settings.accountTypeNumber}</Text> : null}
          {settings.transferNote ? <Text style={styles.line}>{settings.transferNote}</Text> : null}
        </View>

        <View style={styles.remarksBox}>
          <Text style={styles.remarksTitle}>備考</Text>
          {invoice.subject ? <Text style={styles.line}>件名: {invoice.subject}</Text> : null}
          {invoice.terms ? <Text style={styles.line}>{invoice.terms}</Text> : null}
          {invoice.remarks ? <Text style={styles.line}>{invoice.remarks}</Text> : null}
          {invoice.replacesNo ? (
            <Text style={styles.line}>本請求書は {invoice.replacesNo} を訂正・再発行したものです。</Text>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}
