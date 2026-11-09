"use client";

import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import InvoicePdfDocument from "@/components/InvoicePdfDocument";
import type { Invoice, Settings } from "@/lib/types";

export default function InvoicePdfPreview({
  settings,
  invoice,
  draft = false,
}: {
  settings: Settings;
  invoice: Invoice;
  draft?: boolean;
}) {
  const logoSrc = typeof window !== "undefined" ? `${window.location.origin}/logo.png` : "/logo.png";
  const fileName = `${invoice.invoiceNo || "invoice"}.pdf`;
  const renderDoc = () => (
    <InvoicePdfDocument settings={settings} invoice={invoice} draft={draft} logoSrc={logoSrc} />
  );

  return (
    <div style={{ width: "min(920px, 100%)", margin: "0 auto" }}>
      <div className="actions no-print" style={{ marginBottom: 12, justifyContent: "flex-end" }}>
        <PDFDownloadLink document={renderDoc()} fileName={fileName} className="btn gold">
          {({ loading }) => (loading ? "Preparing PDF…" : "Download PDF")}
        </PDFDownloadLink>
      </div>
      <div
        style={{
          height: "calc(100vh - 140px)",
          minHeight: 680,
          border: "1px solid #e4d9cc",
          borderRadius: 12,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <PDFViewer width="100%" height="100%" showToolbar>
          {renderDoc()}
        </PDFViewer>
      </div>
    </div>
  );
}
