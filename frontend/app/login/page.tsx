"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { ready, token, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && token) {
      const next = searchParams.get("next") || "/";
      router.replace(next.startsWith("/") ? next : "/");
    }
  }, [ready, token, router, searchParams]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username.trim(), password);
      const next = searchParams.get("next") || "/";
      router.replace(next.startsWith("/") ? next : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || token) {
    return <div className="auth-loading">Loading…</div>;
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <img src="/logo.png" alt="AB International" />
          <div>
            <strong>AB INTERNATIONAL</strong>
            <span>請求・入金システム</span>
          </div>
        </div>
        <h1>Sign in</h1>
        <p>Enter your credentials to open the invoice desk.</p>
        {error ? <div className="alert">{error}</div> : null}
        <label>
          Username
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button className="btn gold" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
