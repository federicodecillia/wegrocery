import { Resend } from "resend";
import { t } from "@/lib/i18n";

type Attachment = {
  filename: string;
  content: Buffer | string;
};

type SendMailOpts = {
  to: string;
  cc?: string | string[];
  // Optional override for the From header. When omitted, falls back to
  // MAIL_FROM. Note that Resend requires the From domain to be verified
  // on the account, so passing an arbitrary email may fail at send time.
  from?: string;
  subject: string;
  text: string;
  attachments?: Attachment[];
};

// Returns the configured default sender (MAIL_FROM) so the client can
// pre-fill the Mittente field of the supplier-email dialog.
export function getMailFromDefault(): string | null {
  return process.env.MAIL_FROM ?? null;
}

// Thin wrapper around Resend's SDK that returns a discriminated result
// instead of throwing. Read env vars lazily so the module can be imported
// in environments where Resend isn't configured (e.g. local dev without
// the API key) without crashing at startup.
export async function sendMail(
  opts: SendMailOpts,
): Promise<{ ok: true; id?: string } | { error: string }> {
  if (process.env.DEMO_MODE === "true") {
    return { error: t.errors.demoEmailDisabled };
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = opts.from?.trim() || process.env.MAIL_FROM;
  if (!apiKey) return { error: "RESEND_API_KEY non configurata" };
  if (!from) return { error: "MAIL_FROM non configurata" };

  try {
    const resend = new Resend(apiKey);
    const ccList = opts.cc == null ? [] : Array.isArray(opts.cc) ? opts.cc : [opts.cc];
    const { data, error } = await resend.emails.send({
      from,
      to: [opts.to],
      ...(ccList.length > 0 ? { cc: ccList } : {}),
      subject: opts.subject,
      text: opts.text,
      ...(opts.attachments ? { attachments: opts.attachments } : {}),
    });
    if (error) return { error: error.message || t.errors.emailSendFailed };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.emailSendFailed };
  }
}

// Sends many independent one-off emails in a single call via Resend's batch
// API (up to 100 per request — this sidesteps the 2 req/s rate limit and the
// serverless timeout when notifying a whole cooperative). Chunks internally so
// callers don't have to. Same guards as sendMail: blocked in demo, never
// throws, returns a discriminated result. No attachments (batch doesn't
// support them). `sent` counts messages handed to Resend, not deliveries.
export async function sendMailBatch(
  items: ReadonlyArray<{ to: string; subject: string; text: string }>,
  from?: string,
): Promise<{ ok: true; sent: number } | { error: string }> {
  if (items.length === 0) return { ok: true, sent: 0 };
  if (process.env.DEMO_MODE === "true") return { error: t.errors.demoEmailDisabled };
  const apiKey = process.env.RESEND_API_KEY;
  const sender = from?.trim() || process.env.MAIL_FROM;
  if (!apiKey) return { error: "RESEND_API_KEY non configurata" };
  if (!sender) return { error: "MAIL_FROM non configurata" };

  try {
    const resend = new Resend(apiKey);
    for (let i = 0; i < items.length; i += 100) {
      const chunk = items.slice(i, i + 100);
      const { error } = await resend.batch.send(
        chunk.map((it) => ({ from: sender, to: [it.to], subject: it.subject, text: it.text })),
      );
      if (error) return { error: error.message || t.errors.emailSendFailed };
    }
    return { ok: true, sent: items.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : t.errors.emailSendFailed };
  }
}
