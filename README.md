# AB International Invoice

A yen invoicing desk for AB International, rebuilt from the Excel workbook `AB_International_Invoice_System_updated.xlsm`.

The web app keeps the same workflow:

- Customers get permanent IDs (`CUST-0001`). Later edits do not change invoices already issued.
- Drafts have no invoice number and are not receivables.
- Finalize issues a permanent number such as `ABI-2026-0007`. Numbers are never reused.
- Totals are whole yen: line amount, percent and/or fixed discount, tax (not applied, exclusive, or inclusive) and other charges.
- Payments can be partial. A mistake is corrected with a reversal row. Nothing is deleted.
- Cancel is blocked while payments remain. Correct / Reissue copies the invoice into a new draft; finalizing it cancels the old one and transfers the payments.
- The dashboard, register, printable invoice and audit log follow the workbook.

The API uses Express, TypeScript and PostgreSQL with SQL. There is no ORM.

The database is seeded with the customers, invoices, payments and audit history from the workbook.

## Run it

PostgreSQL is not required as a separate install. The API starts an embedded PostgreSQL on port `54329` the first time you run it (the binaries download once).

```powershell
cd D:\mehedi\risalat
npm install
npm install --prefix backend
npm install --prefix frontend
npm run dev
```

- Web: http://localhost:9003
- API: http://localhost:9004

Put your name in the sidebar. It is stored on the audit log.

To use your own PostgreSQL instead, set `EMBEDDED_POSTGRES=false` in `backend/.env` and point `DATABASE_URL` at that server. `docker compose up -d` in this folder starts PostgreSQL 16 on port 5432. Then run `npm run db:setup --prefix backend` once.

## Checks

```powershell
npm test --prefix backend
```
