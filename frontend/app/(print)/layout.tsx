"use client";

import { RequireAuth } from "@/lib/auth";

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
