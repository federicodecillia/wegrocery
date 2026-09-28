// Decides where an outbound email may go. Staging and PR previews run on
// copies of the production database, so they hold real members' addresses:
// anything that is not the Vercel *production* deployment (including local dev,
// where VERCEL_ENV is unset) must never reach them. Outside production a send
// is either redirected to EMAIL_REDIRECT_TO (cc dropped, original recipient
// kept visible in the subject) or refused. DEMO_MODE is checked by the caller
// before this and still wins.

export type OutboundEnv = {
  vercelEnv: string | undefined;
  redirectTo?: string | undefined;
};

export type OutboundDecision =
  | { action: "send"; to: string; cc: string[]; subject: string }
  | { action: "block"; error: string };

export function resolveOutbound(
  msg: { to: string; cc?: readonly string[]; subject: string },
  env: OutboundEnv,
  blockedError: string,
): OutboundDecision {
  if (env.vercelEnv === "production") {
    return { action: "send", to: msg.to, cc: [...(msg.cc ?? [])], subject: msg.subject };
  }
  const redirect = env.redirectTo?.trim();
  if (!redirect) return { action: "block", error: blockedError };
  return {
    action: "send",
    to: redirect,
    cc: [],
    subject: `[STAGING -> ${msg.to}] ${msg.subject}`,
  };
}

// Outside production a broadcast (cycle opened/closed) would otherwise land in
// the tester's inbox once per member of the copied database, and every copy
// counts against the Resend quota the production app may share. A few samples
// are enough to check content and links.
export const REDIRECT_BATCH_CAP = 3;

type BatchItem = { to: string; subject: string; text: string };

export type OutboundBatchDecision =
  | { action: "send"; messages: BatchItem[]; suppressed: number }
  | { action: "block"; error: string };

export function resolveOutboundBatch(
  items: ReadonlyArray<BatchItem>,
  env: OutboundEnv,
  blockedError: string,
): OutboundBatchDecision {
  const messages: BatchItem[] = [];
  for (const it of items) {
    const d = resolveOutbound(it, env, blockedError);
    if (d.action === "block") return d;
    messages.push({ to: d.to, subject: d.subject, text: it.text });
  }
  if (env.vercelEnv === "production") return { action: "send", messages, suppressed: 0 };
  const kept = messages.slice(0, REDIRECT_BATCH_CAP);
  return { action: "send", messages: kept, suppressed: messages.length - kept.length };
}

export function outboundEnvFromProcess(): OutboundEnv {
  return { vercelEnv: process.env.VERCEL_ENV, redirectTo: process.env.EMAIL_REDIRECT_TO };
}
