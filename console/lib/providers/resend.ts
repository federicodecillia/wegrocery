import { requestJson, type FetchLike } from "@/lib/http";

// Thin adapter over the Resend API (resend.com/docs/api-reference, October
// 2026): domains, a sending-only API key restricted to one domain, and plain
// text emails for the operator's own alerts. Resend Free allows 3 domains and
// 100 emails a day per account.

const API = "https://api.resend.com";
const SERVICE = "Resend";

export const DEFAULT_REGION = "eu-west-1";

export type DomainStatus = "not_started" | "pending" | "verified" | "failed" | "temporary_failure" | string;

export interface DnsRecord {
  record: string;
  name: string;
  type: string;
  value: string;
  ttl?: string | number;
  status?: string;
  priority?: number;
}

export interface ResendDomain {
  id: string;
  name: string;
  status: DomainStatus;
  region?: string;
  records?: DnsRecord[];
}

export interface ResendClientOptions {
  apiKey: string;
  fetchImpl?: FetchLike;
}

export function resendClient({ apiKey, fetchImpl = fetch }: ResendClientOptions) {
  const headers = { Authorization: `Bearer ${apiKey}` };
  const call = <T>(method: string, path: string, body?: unknown) =>
    requestJson<T>({ service: SERVICE, fetchImpl, url: `${API}${path}`, method, headers, body });

  return {
    /** POST /domains. */
    createDomain(name: string, region = DEFAULT_REGION) {
      return call<ResendDomain>("POST", "/domains", { name, region });
    },
    /** GET /domains/{id}: status and the DNS records to add. */
    getDomain(id: string) {
      return call<ResendDomain>("GET", `/domains/${encodeURIComponent(id)}`);
    },
    /** POST /domains/{id}/verify: asks Resend to check the records again. */
    verifyDomain(id: string) {
      return call<{ id: string }>("POST", `/domains/${encodeURIComponent(id)}/verify`);
    },
    /** POST /api-keys: a key that can only send, and only from `domainId`. */
    createSendingKey(name: string, domainId: string) {
      return call<{ id: string; token: string }>("POST", "/api-keys", {
        name: name.slice(0, 50),
        permission: "sending_access",
        domain_id: domainId,
      });
    },
    /** POST /emails: one plain-text message. */
    sendEmail(input: { from: string; to: string[]; subject: string; text: string }) {
      return call<{ id: string }>("POST", "/emails", input);
    },
  };
}

export type ResendClient = ReturnType<typeof resendClient>;

/** `"Name" <local@domain>` with the display name stripped of characters that break the header. */
export function mailFrom(displayName: string, address: string): string {
  const clean = displayName.replace(/[<>"\r\n]/g, "").trim() || "WeGrocery";
  return `${clean} <${address}>`;
}
