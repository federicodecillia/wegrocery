// One place that reads the console's environment, lazily (the build must
// work with none of it). Values are never logged; callers get them only to
// pass on to the service they belong to.

export const MIN_PASSWORD_LENGTH = 16;
export const MIN_SESSION_SECRET_LENGTH = 32;

function read(name: string): string | null {
  const v = process.env[name]?.trim();
  return v ? v : null;
}

/** The operator password, or null when missing or too short (login disabled). */
export function consolePassword(): string | null {
  const v = process.env.CONSOLE_PASSWORD;
  return v && v.length >= MIN_PASSWORD_LENGTH ? v : null;
}

export function sessionSecret(): string | null {
  const v = process.env.CONSOLE_SESSION_SECRET;
  return v && v.length >= MIN_SESSION_SECRET_LENGTH ? v : null;
}

/** Both auth variables are usable: the login form works. */
export function authConfigured(): boolean {
  return consolePassword() !== null && sessionSecret() !== null;
}

export const env = {
  encryptionKey: () => read("CONSOLE_ENCRYPTION_KEY"),
  cronSecret: () => read("CRON_SECRET"),
  alertEmail: () => read("CONSOLE_ALERT_EMAIL"),
  resendApiKey: () => read("RESEND_API_KEY"),
  mailFrom: () => read("MAIL_FROM"),
  vercelToken: () => read("VERCEL_TOKEN"),
  neonApiKey: () => read("NEON_API_KEY"),
  sharedMailDomain: () => read("CONSOLE_SHARED_MAIL_DOMAIN"),
  sharedMailDomainId: () => read("CONSOLE_SHARED_MAIL_DOMAIN_ID"),
  repo: () => read("WEGROCERY_REPO") ?? "federicodecillia/wegrocery",
  repoId: () => read("WEGROCERY_REPO_ID"),
  githubToken: () => read("GITHUB_TOKEN"),
};

/** Names of the provider tokens that are missing, for the UI. */
export function missingProviderTokens(): string[] {
  const missing: string[] = [];
  if (!env.vercelToken()) missing.push("VERCEL_TOKEN");
  if (!env.neonApiKey()) missing.push("NEON_API_KEY");
  if (!env.resendApiKey()) missing.push("RESEND_API_KEY");
  if (!env.encryptionKey()) missing.push("CONSOLE_ENCRYPTION_KEY");
  return missing;
}
