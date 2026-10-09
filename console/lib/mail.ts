import { env } from "@/lib/env";
import { resendClient } from "@/lib/providers/resend";
import { reportError } from "@/lib/report-error";

// The console's own emails (alerts, new intake requests, handover), sent with
// the console's RESEND_API_KEY and MAIL_FROM. Skipped when either is unset.

export function mailConfigured(): boolean {
  return Boolean(env.resendApiKey() && env.mailFrom());
}

export async function sendConsoleMail(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = env.resendApiKey();
  const from = env.mailFrom();
  if (!apiKey || !from) return false;
  try {
    await resendClient({ apiKey }).sendEmail({ from, to: [to], subject, text });
    return true;
  } catch (e) {
    reportError("mail", e);
    return false;
  }
}

/** To the operator, when CONSOLE_ALERT_EMAIL is set. */
export async function mailOperator(subject: string, text: string): Promise<boolean> {
  const to = env.alertEmail();
  return to ? sendConsoleMail(to, subject, text) : false;
}
