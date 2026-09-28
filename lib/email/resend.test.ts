import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Wiring test: resolveOutbound's decision must be what actually reaches the
// Resend SDK (redirected `to`, no cc, tagged subject), and a blocked send must
// never construct a client. The pure decision itself is covered in
// outbound-policy.test.ts.
const send = vi.fn(async () => ({ data: { id: "em_1" }, error: null }));
const batchSend = vi.fn(async () => ({ data: null, error: null }));
const ctor = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
    batch = { send: batchSend };
    constructor(key: string) {
      ctor(key);
    }
  },
}));

const { sendMail, sendMailBatch } = await import("./resend");
const { REDIRECT_BATCH_CAP } = await import("./outbound-policy");

const ENV_KEYS = ["VERCEL_ENV", "EMAIL_REDIRECT_TO", "DEMO_MODE", "RESEND_API_KEY", "MAIL_FROM"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.RESEND_API_KEY = "re_test";
  process.env.MAIL_FROM = "App <noreply@example.org>";
  send.mockClear();
  batchSend.mockClear();
  ctor.mockClear();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const mail = { to: "member@example.org", cc: ["admin@example.org"], subject: "Ordine", text: "ciao" };

describe("sendMail outbound policy wiring", () => {
  it("passes recipient and cc through in production", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.EMAIL_REDIRECT_TO = "qa@example.org";
    await sendMail(mail);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["member@example.org"], cc: ["admin@example.org"], subject: "Ordine" }),
    );
  });

  it("redirects outside production and drops cc", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.EMAIL_REDIRECT_TO = "qa@example.org";
    const res = await sendMail(mail);
    expect(res).toEqual({ ok: true, id: "em_1" });
    const payload = (send.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(payload.to).toEqual(["qa@example.org"]);
    expect(payload).not.toHaveProperty("cc");
    expect(payload.subject).toBe("[STAGING -> member@example.org] Ordine");
  });

  it("refuses to send outside production without a redirect, before touching Resend", async () => {
    const res = await sendMail(mail);
    expect(res).toHaveProperty("error");
    expect(ctor).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps DEMO_MODE as the first guard", async () => {
    process.env.DEMO_MODE = "true";
    process.env.VERCEL_ENV = "production";
    const res = await sendMail(mail);
    expect(res).toHaveProperty("error");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("sendMailBatch outbound policy wiring", () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ to: `m${i}@example.org`, subject: "S", text: "T" }));

  it("sends every message to its member in production", async () => {
    process.env.VERCEL_ENV = "production";
    const res = await sendMailBatch(items);
    expect(res).toEqual({ ok: true, sent: 10 });
    const chunk = (batchSend.mock.calls[0] as unknown[])[0] as { to: string[] }[];
    expect(chunk.map((m) => m.to[0])).toEqual(items.map((i) => i.to));
  });

  it("redirects and caps the fan-out outside production", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.EMAIL_REDIRECT_TO = "qa@example.org";
    const res = await sendMailBatch(items);
    expect(res).toEqual({ ok: true, sent: REDIRECT_BATCH_CAP });
    const chunk = (batchSend.mock.calls[0] as unknown[])[0] as { to: string[] }[];
    expect(chunk).toHaveLength(REDIRECT_BATCH_CAP);
    expect(chunk.every((m) => m.to[0] === "qa@example.org")).toBe(true);
  });

  it("refuses the whole batch outside production without a redirect", async () => {
    const res = await sendMailBatch(items);
    expect(res).toHaveProperty("error");
    expect(batchSend).not.toHaveBeenCalled();
  });
});
