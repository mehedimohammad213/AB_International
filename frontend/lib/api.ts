export class ApiError extends Error {
  status: number;
  confirm?: string;

  constructor(status: number, message: string, confirm?: string) {
    super(message);
    this.status = status;
    this.confirm = confirm;
  }
}

const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const operator = typeof window === "undefined" ? "Operator" : localStorage.getItem("ab-operator") || "Operator";
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Operator": operator,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
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
