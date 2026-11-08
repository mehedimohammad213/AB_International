import { clearAuthStorage, getStoredToken } from "./auth-storage";

export class ApiError extends Error {
  status: number;
  confirm?: string;

  constructor(status: number, message: string, confirm?: string) {
    super(message);
    this.status = status;
    this.confirm = confirm;
  }
}

const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9004";

type ApiOptions = RequestInit & { skipAuth?: boolean };

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { skipAuth, headers, ...rest } = options;
  const operator = typeof window === "undefined" ? "Operator" : localStorage.getItem("ab-operator") || "Operator";
  const token = skipAuth ? null : getStoredToken();

  const response = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      "X-Operator": operator,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !skipAuth && typeof window !== "undefined") {
      clearAuthStorage();
      if (!window.location.pathname.startsWith("/login")) {
        const next = window.location.pathname + window.location.search;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
      }
    }
    throw new ApiError(response.status, data.error || response.statusText, data.confirm);
  }
  return data as T;
}

export async function send<T>(path: string, body: Record<string, unknown>, method = "POST") {
  const payload = { ...body };
  for (;;) {
    try {
      return await api<T>(path, { method, body: JSON.stringify(payload) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.confirm) {
        if (!window.confirm(error.message)) throw error;
        payload[error.confirm] = true;
        continue;
      }
      throw error;
    }
  }
}
