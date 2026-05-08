// ─── Base API Client ──────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const apiFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error(`[API] ${res.status} ${res.statusText} on ${init?.method || 'GET'} ${path}`, body);
    throw new ApiError(res.status, body.error || "UNKNOWN_ERROR", body.message || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
};

export const api = {
  get:    <T>(path: string)                  => apiFetch<T>(path),
  post:   <T>(path: string, body: unknown)   => apiFetch<T>(path, { method: "POST",   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)   => apiFetch<T>(path, { method: "PUT",    body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)   => apiFetch<T>(path, { method: "PATCH",  body: JSON.stringify(body) }),
  delete: <T = void>(path: string)           => apiFetch<T>(path, { method: "DELETE" }),
};
