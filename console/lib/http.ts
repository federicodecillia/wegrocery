// Small fetch helpers shared by the provider adapters and the instance
// probes. Every call takes an injectable fetch (tests pass a fake) and a
// timeout. Error messages carry the service's own message and status, never
// a request body or a header (they may hold tokens or secrets).

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const DEFAULT_TIMEOUT_MS = 10_000;

export class ProviderError extends Error {
  constructor(
    readonly service: string,
    readonly status: number,
    message: string,
  ) {
    super(`${service}: ${message}${status ? ` (HTTP ${status})` : ""}`);
    this.name = "ProviderError";
  }
}

export async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/** The service's error message from a JSON body, without echoing anything long. */
export function errorMessageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    const err = o.error;
    const candidates = [
      typeof err === "object" && err ? (err as Record<string, unknown>).message : undefined,
      typeof err === "string" ? err : undefined,
      o.message,
    ];
    for (const c of candidates) if (typeof c === "string" && c) return c.slice(0, 300);
  }
  return fallback;
}

export async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export interface JsonRequest {
  service: string;
  fetchImpl: FetchLike;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

/** A JSON call that throws ProviderError on a non-2xx answer or a network failure. */
export async function requestJson<T>(req: JsonRequest): Promise<T> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      req.fetchImpl,
      req.url,
      {
        method: req.method ?? "GET",
        headers: {
          Accept: "application/json",
          ...(req.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...req.headers,
        },
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      },
      req.timeoutMs,
    );
  } catch (e) {
    const reason = e instanceof Error && e.name === "AbortError" ? "timeout" : "network error";
    throw new ProviderError(req.service, 0, reason);
  }
  const body = await readJson(res);
  if (!res.ok) throw new ProviderError(req.service, res.status, errorMessageFrom(body, res.statusText || "request failed"));
  return body as T;
}

export function withQuery(base: string, params: Record<string, string | null | undefined>): string {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}
