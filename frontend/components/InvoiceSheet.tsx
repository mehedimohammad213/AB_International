import { ymd, yen } from "@/lib/format";
import type { Invoice, Settings } from "@/lib/types";

export default function InvoiceSheet({
  settings,
  invoice,
  draft = false,
}: {
  settings: Settings;
  invoice: Invoice;
  draft?: boolean;
}) {
  const company = invoice.companyName.trim();
  const person = invoice.customerName.trim();
  const postal = invoice.postalCode.replace(/^〒/, "");
  const reg = invoice.customerRegNo.trim();
  const hideEmail = !settings.email || settings.email.startsWith("[");
  const taxPercent = Math.round(invoice.taxRate * 1000) / 10;
  const taxCaption =
    invoice.taxRate === 0
      ? settings.taxLabel || "消費税"
      : invoice.taxMode.startsWith("Inc")
        ? `${invoice.taxLabel} (${taxPercent}% 内税)`
        : `${invoice.taxLabel} (${taxPercent}%)`;

  return (
    <article className="sheet">
      <header className="sheet-top">
        <img src="/logo.png" alt="AB International" />
        <div className="sheet-top-title">
          <h1>{settings.documentTitle || "請求書"}</h1>
          <p>{settings.documentSubtitle || "INVOICE"}</p>
        </div>
      </header>

      {draft && <div className="banner">下書き DRAFT — 未確定 / not a finalized invoice</div>}
      {invoice.recordStatus === "Cancelled" && (
        <div className="banner bad">取消 CANCELLED — この請求書は無効です / this invoice has been cancelled</div>
      )}

      <div className="sheet-grid">
        <div>
          {postal && <div>〒{postal}</div>}
          {invoice.address && <div>{invoice.address}</div>}
          <strong>{company ? `${company} 御中` : person ? `${person} 様` : ""}</strong>
          {company && person && <div>ご担当: {person} 様</div>}
          {reg && <div>登録番号: {reg}</div>}
        </div>
        <div>
          <div>請求書番号 No. <strong>{invoice.invoiceNo}</strong></div>
          <div>請求日 Date {ymd(invoice.invoiceDate)}</div>
          <div>お支払期限 Due {ymd(invoice.dueDate)}</div>
          <div className="muted" style={{ marginTop: 10 }}>{settings.companyNameJa}</div>
          <div>{settings.companyNameEn}</div>
          <div>{settings.postalCode} {settings.address}</div>
          {settings.telFax && <div>TEL/FAX: {settings.telFax}</div>}
          {settings.mobile && <div>携帯: {settings.mobile}</div>}
          {settings.registrationNo && <div>登録番号: {settings.registrationNo}</div>}
          {!hideEmail && <div>Email: {settings.email}</div>}
        </div>
      </div>

      <p>{settings.introSentence}</p>
      {invoice.subject && <div>件名: {invoice.subject}</div>}

      <div className="amount-box">
        <span>ご請求金額</span>
        <span>{yen(invoice.grandTotal)}</span>
      </div>

      <table className="sheet-lines">
        <thead>
          <tr>
            <th>No.</th>
            <th>品名 Description</th>
            <th className="num">数量</th>
            <th>単位</th>
            <th className="num">単価 (¥)</th>
            <th className="num">金額 (¥)</th>
          </tr>
        </thead>
        <tbody>
          {(invoice.lines || []).map((line, index) => (
            <tr key={`${line.description}-${index}`}>
              <td>{index + 1}</td>
              <td className="wrap">{line.description}</td>
              <td className="num">{line.qty}</td>
              <td>{line.unit}</td>
              <td className="num">{yen(line.unitPrice)}</td>
              <td className="num">{yen(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="foot">
        <div>
          <strong>振込先 Bank transfer</strong>
          <div>{settings.bankBranch}</div>
          <div>{settings.accountTypeNumber}</div>
          <div>口座名義: {settings.accountName}</div>
          <div>{settings.transferNote}</div>
          {invoice.terms && <p>支払条件: {invoice.terms}</p>}
          {(invoice.remarks || invoice.replacesNo) && (
            <>
              <strong>備考 Remarks</strong>
              <div>{invoice.remarks}</div>
              {invoice.replacesNo && (
                <div>本請求書は {invoice.replacesNo} を訂正・再発行したものです。 (Replaces invoice {invoice.replacesNo})</div>
              )}
            </>
          )}
        </div>
        <div className="totals">
          <div><span>小計 Subtotal</span><span>{yen(invoice.subtotal)}</span></div>
          <div><span>値引 Discount</span><span>{invoice.discount ? yen(-invoice.discount) : yen(0)}</span></div>
          <div><span>{taxCaption}</span><span>{yen(invoice.tax)}</span></div>
          <div><span>{invoice.otherChargesLabel || "その他 Other charges"}</span><span>{yen(invoice.otherCharges)}</span></div>
          <div className="grand"><span>{invoice.tax ? "合計 Total (税込)" : "合計 Total"}</span><span>{yen(invoice.grandTotal)}</span></div>
          {!draft && <div><span>入金済 Paid</span><span>{yen(-invoice.received)}</span></div>}
          {!draft && <div><span>差引残高 Balance due</span><span>{yen(invoice.outstanding)}</span></div>}
        </div>
      </div>
      <p className="muted">金額は日本円 (JPY) で表示しています | Amounts in Japanese Yen (JPY)</p>
    </article>
  );
}
