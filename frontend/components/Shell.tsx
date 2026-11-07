"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Dashboard", ja: "経営サマリー" },
  { href: "/customers", label: "Customers", ja: "顧客一覧" },
  { href: "/invoices/new", label: "New invoice", ja: "請求書作成" },
  { href: "/invoices", label: "Register", ja: "請求書台帳" },
  { href: "/drafts", label: "Drafts", ja: "下書き" },
  { href: "/payments", label: "Payments", ja: "入金記録" },
  { href: "/settings", label: "Settings", ja: "設定" },
  { href: "/audit", label: "Audit log", ja: "操作履歴" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [operator, setOperator] = useState("Operator");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    setOperator(localStorage.getItem("ab-operator") || "Operator");
  }, []);

  function saveOperator(value: string) {
    setOperator(value);
    localStorage.setItem("ab-operator", value);
  }

  return (
    <div className="desk">
      <aside className="nav">
        <div className="brand">
          <img src="/logo.png" alt="AB International" />
          <div>
            <strong>AB INTERNATIONAL</strong>
            <span>請求・入金</span>
          </div>
        </div>
        <nav>
          {links.map((link) => {
            const active = ready && (link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`));
            const exactNew = link.href === "/invoices" && pathname.startsWith("/invoices/new");
            return (
              <Link key={link.href} href={link.href} className={active && !exactNew ? "active" : undefined}>
                {link.label}
                <span className="ja">{link.ja}</span>
              </Link>
            );
          })}
        </nav>
        <label className="operator">
          Your name on the audit log
          <input value={operator} onChange={(event) => saveOperator(event.target.value)} />
        </label>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
