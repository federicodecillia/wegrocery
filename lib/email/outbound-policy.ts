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

export function outboundEnvFromProcess(): OutboundEnv {
  return { vercelEnv: process.env.VERCEL_ENV, redirectTo: process.env.EMAIL_REDIRECT_TO };
}
