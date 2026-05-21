// ─── Base API Client ──────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

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

export interface SipraRequestInit extends RequestInit {
  skipGlobalRedirect?: boolean;
}

export const apiFetch = async <T>(path: string, init?: SipraRequestInit): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error(`[API] ${res.status} ${res.statusText} on ${init?.method || 'GET'} ${path}`, body);
    
    if (res.status === 403 && !init?.skipGlobalRedirect) {
      if (typeof window !== "undefined" && window.location.pathname !== "/access-denied") {
        window.location.href = "/access-denied";
      }
    }
    
    throw new ApiError(res.status, body.error || "UNKNOWN_ERROR", body.message || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
};

export const api = {
  get:    <T>(path: string, init?: SipraRequestInit)                  => apiFetch<T>(path, init),
  post:   <T>(path: string, body: unknown, init?: SipraRequestInit)   => apiFetch<T>(path, { ...init, method: "POST",   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown, init?: SipraRequestInit)   => apiFetch<T>(path, { ...init, method: "PUT",    body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown, init?: SipraRequestInit)   => apiFetch<T>(path, { ...init, method: "PATCH",  body: JSON.stringify(body) }),
  delete: <T = void>(path: string, init?: SipraRequestInit)           => apiFetch<T>(path, { ...init, method: "DELETE" }),
};
