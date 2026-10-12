import type { FetchLike } from "@/lib/http";

// A recording fake fetch for the adapter tests: each call is answered by the
// next queued response, and kept for assertions on method, URL, headers and
// body.

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export function mockFetch(responses: { status?: number; body?: unknown }[]): FetchLike & { calls: RecordedCall[] } {
  const queue = [...responses];
  const calls: RecordedCall[] = [];
  const fn = (async (input: string, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
    let body: unknown = init?.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // form-encoded or plain text: keep the string
      }
    }
    calls.push({ url: input, method: init?.method ?? "GET", headers, body });
    const next = queue.shift() ?? { status: 500, body: { error: { message: "no response queued" } } };
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as FetchLike & { calls: RecordedCall[] };
  fn.calls = calls;
  return fn;
}
