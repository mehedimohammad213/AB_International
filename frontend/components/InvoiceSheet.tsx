import { yen, ymdJa } from "@/lib/format";
import type { Invoice, Settings } from "@/lib/types";

const MIN_ITEM_ROWS = 7;

export default function InvoiceSheet({
  settings,
  invoice,
  draft = false,
}: {
  settings: Settings;
  invoice: Invoice;
  draft?: boolean;
}) {
  const postal = invoice.postalCode.replace(/^〒/, "").trim();
  const companyPostal = settings.postalCode.replace(/^〒/, "").trim();
  const company = invoice.companyName.trim();
  const person = invoice.customerName.trim();
  const displayName = company || person;
  const lines = invoice.lines || [];
  const blankCount = Math.max(0, MIN_ITEM_ROWS - lines.length);
  const intro = settings.introSentence?.trim() || "下記のとおりご請求書申し上げます";

  return (
    <article className="sheet sora-sheet">
      <div className="sora-title">{settings.documentTitle || "請求書"}</div>

      <div className="sora-date">
        <div>{ymdJa(invoice.invoiceDate)}</div>
        {invoice.invoiceNo && <div className="sora-invoice-no">請求書番号 {invoice.invoiceNo}</div>}
      </div>

      {draft && <div className="banner">下書き DRAFT — 未確定 / not a finalized invoice</div>}
      {invoice.recordStatus === "Cancelled" && (
        <div className="banner bad">取消 CANCELLED — この請求書は無効です / this invoice has been cancelled</div>
      )}

      <div className="sora-parties">
        <div className="sora-party left">
          {postal && <div>〒{postal}</div>}
          {invoice.address && <div>{invoice.address}</div>}
          {displayName && <strong>{displayName}</strong>}
        </div>
        <div className="sora-party right">
          {companyPostal && <div>〒{companyPostal}</div>}
          {settings.address && <div>{settings.address}</div>}
          <strong>{settings.companyNameJa || settings.companyNameEn}</strong>
          {settings.telFax && <div>TEL/FAX: {settings.telFax}</div>}
          {settings.mobile && <div>携帯：{settings.mobile}</div>}
        </div>
      </div>

      <p className="sora-intro">{intro}</p>

      <div className="sora-amount">
        <span>合計金額</span>
        <span>{yen(invoice.grandTotal)}</span>
      </div>

      <table className="sora-lines">
        <thead>
          <tr>
            <th>商品</th>
            <th>数量</th>
            <th>金額</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.description}-${index}`}>
              <td className="wrap">{line.description}</td>
              <td className="qty">{line.qty}</td>
              <td className="num">{yen(line.lineTotal)}</td>
            </tr>
          ))}
          {Array.from({ length: blankCount }).map((_, index) => (
            <tr key={`blank-${index}`} className="blank">
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="sora-summary">
        <tbody>
          <tr>
            <th>小計</th>
            <td>{invoice.subtotal ? yen(invoice.subtotal) : ""}</td>
          </tr>
          {!!invoice.discount && (
            <tr>
              <th>値引</th>
              <td>{yen(-invoice.discount)}</td>
            </tr>
          )}
          <tr>
            <th>消費税</th>
            <td>{invoice.tax ? yen(invoice.tax) : ""}</td>
          </tr>
          {!!invoice.otherCharges && (
            <tr>
              <th>{invoice.otherChargesLabel || "その他"}</th>
              <td>{yen(invoice.otherCharges)}</td>
            </tr>
          )}
          <tr className="total">
            <th>合計(税込)</th>
            <td>{yen(invoice.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div className="sora-bank">
        <strong>振込先</strong>
        {settings.accountName && <div>{settings.accountName}</div>}
        {settings.bankBranch && <div>{settings.bankBranch}</div>}
        {settings.accountTypeNumber && <div>{settings.accountTypeNumber}</div>}
        {settings.transferNote && <div>{settings.transferNote}</div>}
      </div>

      <div className="sora-remarks">
        <strong>備考</strong>
        {invoice.subject && <div>件名: {invoice.subject}</div>}
        {invoice.terms && <div>{invoice.terms}</div>}
        {invoice.remarks && <div>{invoice.remarks}</div>}
        {invoice.replacesNo && <div>本請求書は {invoice.replacesNo} を訂正・再発行したものです。</div>}
      </div>
    </article>
  );
}
