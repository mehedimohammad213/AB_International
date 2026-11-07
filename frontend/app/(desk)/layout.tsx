"use client";

import Shell from "@/components/Shell";
import { RequireAuth } from "@/lib/auth";

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <Shell>{children}</Shell>
    </RequireAuth>
  );
}
