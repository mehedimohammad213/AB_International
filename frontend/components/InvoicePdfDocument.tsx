"use client";

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { ymd, yen } from "@/lib/format";
import { ensurePdfFonts } from "@/lib/pdf-fonts";
import type { Invoice, Settings } from "@/lib/types";

ensurePdfFonts();

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 9,
    color: "#1a1a1a",
    paddingTop: 78,
    paddingBottom: 36,
    paddingHorizontal: 36,
  },
  header: {
    position: "absolute",
    top: 22,
    left: 36,
    right: 36,
    height: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    width: 130,
    height: 42,
    objectFit: "contain",
  },
  titleBlock: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 10,
    color: "#b8963e",
    letterSpacing: 3,
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
  grid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 10,
  },
  colLeft: { flex: 1.2 },
  colRight: { flex: 0.8 },
  strong: { fontWeight: 700, marginTop: 2, marginBottom: 2 },
  muted: { color: "#6d645c" },
  intro: { marginBottom: 6 },
  amountBox: {
    borderWidth: 2,
    borderColor: "#1a1a1a",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginVertical: 10,
  },
  amountLabel: { fontSize: 14, fontWeight: 700 },
  amountValue: { fontSize: 16, fontWeight: 700 },
  table: { width: "100%", marginTop: 4 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cfc3b4",
    paddingBottom: 5,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f3ebe2",
    paddingVertical: 5,
    alignItems: "flex-start",
  },
  th: { fontSize: 8, color: "#5c534c", fontWeight: 700 },
  td: { fontSize: 9 },
  cNo: { width: "6%" },
  cDesc: { width: "40%", paddingRight: 6 },
  cQty: { width: "12%", textAlign: "right", paddingRight: 6 },
  cUnit: { width: "12%", paddingLeft: 4 },
  cPrice: { width: "15%", textAlign: "right" },
  cAmt: { width: "15%", textAlign: "right" },
  foot: {
    flexDirection: "row",
    gap: 16,
    marginTop: 14,
  },
  footLeft: { flex: 1.1 },
  footRight: { flex: 0.9 },
  footTitle: { fontWeight: 700, marginBottom: 4 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 4,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e6da",
  },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 12,
    fontWeight: 700,
    marginTop: 2,
    marginBottom: 6,
  },
  footerNote: { marginTop: 10, color: "#6d645c", fontSize: 8 },
});

function taxCaption(invoice: Invoice, settings: Settings) {
  const taxPercent = Math.round(invoice.taxRate * 1000) / 10;
  if (invoice.taxRate === 0) return settings.taxLabel || "消費税";
  if (invoice.taxMode.startsWith("Inc")) return `${invoice.taxLabel} (${taxPercent}% 内税)`;
  return `${invoice.taxLabel} (${taxPercent}%)`;
}

export default function InvoicePdfDocument({
  settings,
  invoice,
  draft = false,
  logoSrc,
}: {
  settings: Settings;
  invoice: Invoice;
  draft?: boolean;
  logoSrc: string;
}) {
  const company = invoice.companyName.trim();
  const person = invoice.customerName.trim();
  const postal = invoice.postalCode.replace(/^〒/, "");
  const reg = invoice.customerRegNo.trim();
  const hideEmail = !settings.email || settings.email.startsWith("[");
  const caption = taxCaption(invoice, settings);

  return (
    <Document
      title={`${invoice.invoiceNo || "invoice"}`}
      author={settings.companyNameEn || "AB International"}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={logoSrc} style={styles.logo} />
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{settings.documentTitle || "請求書"}</Text>
            <Text style={styles.subtitle}>{settings.documentSubtitle || "INVOICE"}</Text>
          </View>
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

        <View style={styles.grid}>
          <View style={styles.colLeft}>
            {postal ? <Text>〒{postal}</Text> : null}
            {invoice.address ? <Text>{invoice.address}</Text> : null}
            <Text style={styles.strong}>
              {company ? `${company} 御中` : person ? `${person} 様` : ""}
            </Text>
            {company && person ? <Text>ご担当: {person} 様</Text> : null}
            {reg ? <Text>登録番号: {reg}</Text> : null}
          </View>
          <View style={styles.colRight}>
            <Text>
              請求書番号 No. <Text style={styles.strong}>{invoice.invoiceNo}</Text>
            </Text>
            <Text>請求日 Date {ymd(invoice.invoiceDate)}</Text>
            <Text>お支払期限 Due {ymd(invoice.dueDate)}</Text>
            <Text style={[styles.muted, { marginTop: 8 }]}>{settings.companyNameJa}</Text>
            <Text>{settings.companyNameEn}</Text>
            <Text>
              {settings.postalCode} {settings.address}
            </Text>
            {settings.telFax ? <Text>TEL/FAX: {settings.telFax}</Text> : null}
            {settings.mobile ? <Text>携帯: {settings.mobile}</Text> : null}
            {settings.registrationNo ? <Text>登録番号: {settings.registrationNo}</Text> : null}
            {!hideEmail ? <Text>Email: {settings.email}</Text> : null}
          </View>
        </View>

        <Text style={styles.intro}>{settings.introSentence}</Text>
        {invoice.subject ? <Text>件名: {invoice.subject}</Text> : null}

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>ご請求金額</Text>
          <Text style={styles.amountValue}>{yen(invoice.grandTotal)}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.th, styles.cNo]}>No.</Text>
            <Text style={[styles.th, styles.cDesc]}>品名 Description</Text>
            <Text style={[styles.th, styles.cQty]}>数量</Text>
            <Text style={[styles.th, styles.cUnit]}>単位</Text>
            <Text style={[styles.th, styles.cPrice]}>単価 (¥)</Text>
            <Text style={[styles.th, styles.cAmt]}>金額 (¥)</Text>
          </View>
          {(invoice.lines || []).map((line, index) => (
            <View key={`${line.description}-${index}`} style={styles.tableRow} wrap={false}>
              <Text style={[styles.td, styles.cNo]}>{index + 1}</Text>
              <Text style={[styles.td, styles.cDesc]}>{line.description}</Text>
              <Text style={[styles.td, styles.cQty]}>{line.qty ?? ""}</Text>
              <Text style={[styles.td, styles.cUnit]}>{line.unit}</Text>
              <Text style={[styles.td, styles.cPrice]}>{yen(line.unitPrice)}</Text>
              <Text style={[styles.td, styles.cAmt]}>{yen(line.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.foot} wrap={false}>
          <View style={styles.footLeft}>
            <Text style={styles.footTitle}>振込先 Bank transfer</Text>
            <Text>{settings.bankBranch}</Text>
            <Text>{settings.accountTypeNumber}</Text>
            <Text>口座名義: {settings.accountName}</Text>
            <Text>{settings.transferNote}</Text>
            {invoice.terms ? <Text style={{ marginTop: 6 }}>支払条件: {invoice.terms}</Text> : null}
            {(invoice.remarks || invoice.replacesNo) && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.footTitle}>備考 Remarks</Text>
                {invoice.remarks ? <Text>{invoice.remarks}</Text> : null}
                {invoice.replacesNo ? (
                  <Text>
                    本請求書は {invoice.replacesNo} を訂正・再発行したものです。 (Replaces invoice {invoice.replacesNo})
                  </Text>
                ) : null}
              </View>
            )}
          </View>
          <View style={styles.footRight}>
            <View style={styles.totalRow}>
              <Text>小計 Subtotal</Text>
              <Text>{yen(invoice.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>値引 Discount</Text>
              <Text>{invoice.discount ? yen(-invoice.discount) : yen(0)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>{caption}</Text>
              <Text>{yen(invoice.tax)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>{invoice.otherChargesLabel || "その他 Other charges"}</Text>
              <Text>{yen(invoice.otherCharges)}</Text>
            </View>
            <View style={styles.grandRow}>
              <Text>{invoice.tax ? "合計 Total (税込)" : "合計 Total"}</Text>
              <Text>{yen(invoice.grandTotal)}</Text>
            </View>
            {!draft && (
              <>
                <View style={styles.totalRow}>
                  <Text>入金済 Paid</Text>
                  <Text>{yen(-invoice.received)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text>差引残高 Balance due</Text>
                  <Text>{yen(invoice.outstanding)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        <Text style={styles.footerNote}>
          金額は日本円 (JPY) で表示しています | Amounts in Japanese Yen (JPY)
        </Text>
      </Page>
    </Document>
  );
}
