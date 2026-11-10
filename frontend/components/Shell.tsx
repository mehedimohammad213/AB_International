"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

const links = [
  { href: "/", label: "Dashboard", ja: "経営サマリー" },
  { href: "/customers", label: "Customers", ja: "顧客一覧" },
  { href: "/invoices", label: "Invoices", ja: "請求書" },
  // { href: "/payments", label: "Payments", ja: "入金履歴" },
  { href: "/settings", label: "Settings", ja: "設定" },
  // { href: "/audit", label: "Audit log", ja: "操作履歴" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
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

  function onLogout() {
    logout();
    router.replace("/login");
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
            return (
              <Link key={link.href} href={link.href} className={active ? "active" : undefined}>
                {link.label}
                <span className="ja">{link.ja}</span>
              </Link>
            );
          })}
        </nav>
        <div className="nav-foot">
          <label className="operator">
            Your name on the audit log
            <input value={operator} onChange={(event) => saveOperator(event.target.value)} />
          </label>
          <button className="btn ghost logout-btn" type="button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
