import { describe, expect, it } from "vitest";
import { mockFetch } from "@/test/mock-fetch";
import { ProviderError } from "@/lib/http";
import { domainDnsRecord, productionAlias, vercelClient } from "./vercel";
import { neonClient } from "./neon";
import { mailFrom, resendClient } from "./resend";
import { REQUIRED_STRIPE_EVENTS, classifyStripeKey, stripeClient, webhookUrl } from "./stripe";
import { githubClient } from "./github";

describe("vercel adapter", () => {
  it("creates a Next.js project linked to the repository, on the team", async () => {
    const f = mockFetch([{ body: { id: "prj_1", name: "wegrocery-riva" } }]);
    const v = vercelClient({ token: "tok", teamId: "team_9", fetchImpl: f });
    const p = await v.createProject({ name: "wegrocery-riva", repo: "federicodecillia/wegrocery" });
    expect(p.id).toBe("prj_1");
    const c = f.calls[0];
    expect(c.method).toBe("POST");
    expect(c.url).toBe("https://api.vercel.com/v11/projects?teamId=team_9");
    expect(c.headers.authorization).toBe("Bearer tok");
    expect(c.body).toEqual({
      name: "wegrocery-riva",
      framework: "nextjs",
      gitRepository: { type: "github", repo: "federicodecillia/wegrocery" },
    });
  });

  it("omits teamId for the personal account", async () => {
    const f = mockFetch([{ body: { id: "prj_1", name: "x" } }]);
    await vercelClient({ token: "tok", fetchImpl: f }).getProject("x");
    expect(f.calls[0].url).toBe("https://api.vercel.com/v9/projects/x");
  });

  it("returns null for a missing project", async () => {
    const f = mockFetch([{ status: 404, body: { error: { message: "not found" } } }]);
    expect(await vercelClient({ token: "t", fetchImpl: f }).getProject("nope")).toBeNull();
  });

  it("upserts env vars as one array", async () => {
    const f = mockFetch([{ status: 201, body: { created: [], failed: [] } }]);
    await vercelClient({ token: "t", teamId: "team_9", fetchImpl: f }).upsertEnv("prj_1", [
      { key: "AUTH_SECRET", value: "s3cret", type: "sensitive", target: ["production", "preview"] },
    ]);
    const c = f.calls[0];
    expect(c.url).toBe("https://api.vercel.com/v10/projects/prj_1/env?upsert=true&teamId=team_9");
    expect(c.body).toEqual([{ key: "AUTH_SECRET", value: "s3cret", type: "sensitive", target: ["production", "preview"] }]);
  });

  it("throws on a partial env failure without echoing values", async () => {
    const f = mockFetch([{ status: 201, body: { failed: [{ error: { code: "ENV_CONFLICT", message: "x", envVarKey: "DATABASE_URL", value: "postgres://secret" } }] } }]);
    const err = await vercelClient({ token: "t", fetchImpl: f })
      .upsertEnv("prj_1", [{ key: "DATABASE_URL", value: "postgres://secret", type: "sensitive", target: ["production"] }])
      .catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.message).toContain("DATABASE_URL (ENV_CONFLICT)");
    expect(err.message).not.toContain("postgres://");
  });

  it("deploys main to production through gitSource", async () => {
    const f = mockFetch([{ body: { id: "dpl_1", readyState: "QUEUED" } }]);
    await vercelClient({ token: "t", teamId: "team_9", fetchImpl: f }).createDeployment({ projectName: "wegrocery-riva", projectId: "prj_1", repoId: 123 });
    const c = f.calls[0];
    expect(c.url).toBe("https://api.vercel.com/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1&teamId=team_9");
    expect(c.body).toEqual({
      name: "wegrocery-riva",
      project: "prj_1",
      target: "production",
      gitSource: { type: "github", repoId: "123", ref: "main" },
    });
  });

  it("adds a domain", async () => {
    const f = mockFetch([{ body: { name: "gas.riva.it", verified: true } }]);
    await vercelClient({ token: "t", fetchImpl: f }).addDomain("prj_1", "gas.riva.it");
    expect(f.calls[0].url).toBe("https://api.vercel.com/v10/projects/prj_1/domains");
    expect(f.calls[0].body).toEqual({ name: "gas.riva.it" });
  });

  it("maps a timeout-free error to ProviderError with the service message", async () => {
    const f = mockFetch([{ status: 403, body: { error: { code: "forbidden", message: "Not authorized" } } }]);
    await expect(vercelClient({ token: "t", fetchImpl: f }).getDeployment("d")).rejects.toThrow("Vercel: Not authorized (HTTP 403)");
  });

  it("picks the production alias", () => {
    expect(productionAlias(["wegrocery-riva-team.vercel.app", "wegrocery-riva.vercel.app", "wegrocery-riva-git-main-team.vercel.app"])).toBe(
      "wegrocery-riva.vercel.app",
    );
    expect(productionAlias(["gas.riva.it"])).toBeNull();
    expect(productionAlias(undefined)).toBeNull();
  });

  it("proposes the DNS record of a custom domain", () => {
    expect(domainDnsRecord("gas.riva.it")).toEqual({ type: "CNAME", name: "gas", value: "cname.vercel-dns.com" });
    expect(domainDnsRecord("riva.it")).toEqual({ type: "A", name: "@", value: "76.76.21.21" });
  });
});

describe("neon adapter", () => {
  it("creates a Postgres 17 project in Frankfurt for the organization", async () => {
    const f = mockFetch([{ status: 201, body: { project: { id: "proud-river-123" }, connection_uris: [{ connection_uri: "postgres://u:p@h/db" }] } }]);
    const r = await neonClient({ apiKey: "napi", fetchImpl: f }).createProject({ name: "wegrocery-riva", orgId: "org-1" });
    expect(r).toEqual({ id: "proud-river-123" });
    const c = f.calls[0];
    expect(c.url).toBe("https://console.neon.tech/api/v2/projects");
    expect(c.headers.authorization).toBe("Bearer napi");
    expect(c.body).toEqual({ project: { name: "wegrocery-riva", region_id: "aws-eu-central-1", pg_version: 17, org_id: "org-1" } });
  });

  it("fetches the pooled connection URI", async () => {
    const f = mockFetch([{ body: { uri: "postgres://u:p@h-pooler/neondb" } }]);
    const uri = await neonClient({ apiKey: "napi", fetchImpl: f }).connectionUri("proud-river-123");
    expect(uri).toBe("postgres://u:p@h-pooler/neondb");
    expect(f.calls[0].url).toBe(
      "https://console.neon.tech/api/v2/projects/proud-river-123/connection_uri?database_name=neondb&role_name=neondb_owner&pooled=true",
    );
  });
});

describe("resend adapter", () => {
  it("creates a domain in eu-west-1", async () => {
    const f = mockFetch([{ body: { id: "dom_1", name: "gasriva.it", status: "not_started", records: [] } }]);
    await resendClient({ apiKey: "re_x", fetchImpl: f }).createDomain("gasriva.it");
    expect(f.calls[0].url).toBe("https://api.resend.com/domains");
    expect(f.calls[0].body).toEqual({ name: "gasriva.it", region: "eu-west-1" });
  });

  it("verifies and reads a domain", async () => {
    const f = mockFetch([{ body: { id: "dom_1" } }, { body: { id: "dom_1", name: "x", status: "verified" } }]);
    const r = resendClient({ apiKey: "re_x", fetchImpl: f });
    await r.verifyDomain("dom_1");
    expect((await r.getDomain("dom_1")).status).toBe("verified");
    expect(f.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://api.resend.com/domains/dom_1/verify",
      "GET https://api.resend.com/domains/dom_1",
    ]);
  });

  it("creates a sending-only key restricted to the domain", async () => {
    const f = mockFetch([{ body: { id: "key_1", token: "re_new" } }]);
    const k = await resendClient({ apiKey: "re_x", fetchImpl: f }).createSendingKey("wegrocery-riva", "dom_1");
    expect(k.token).toBe("re_new");
    expect(f.calls[0].body).toEqual({ name: "wegrocery-riva", permission: "sending_access", domain_id: "dom_1" });
  });

  it("formats a sender", () => {
    expect(mailFrom('GAS "Riva" <x>', "riva@mail.example")).toBe("GAS Riva x <riva@mail.example>");
  });
});

describe("stripe adapter", () => {
  it("classifies keys", () => {
    expect(classifyStripeKey("sk_live_abcdefghijkl")).toEqual({ kind: "secret", mode: "live" });
    expect(classifyStripeKey("rk_test_abcdefghijkl")).toEqual({ kind: "restricted", mode: "test" });
    expect(classifyStripeKey("pk_live_abcdefghijkl")).toBeNull();
    expect(classifyStripeKey("whatever")).toBeNull();
  });

  it("builds the webhook URL", () => {
    expect(webhookUrl("https://gas.riva.it/")).toBe("https://gas.riva.it/api/stripe/webhook");
  });

  it("replaces an endpoint on the same URL and subscribes the required events", async () => {
    const url = "https://gas.riva.it/api/stripe/webhook";
    const f = mockFetch([
      { body: { data: [{ id: "we_old", url }, { id: "we_other", url: "https://other.example/hook" }] } },
      { body: { id: "we_old", deleted: true } },
      { body: { id: "we_new", url, secret: "whsec_abc" } },
    ]);
    const r = await stripeClient({ secretKey: "sk_test_x", fetchImpl: f }).replaceWebhookEndpoint(url, "WeGrocery riva");
    expect(r).toEqual({ id: "we_new", secret: "whsec_abc" });
    expect(f.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET https://api.stripe.com/v1/webhook_endpoints?limit=100",
      "DELETE https://api.stripe.com/v1/webhook_endpoints/we_old",
      "POST https://api.stripe.com/v1/webhook_endpoints",
    ]);
    const post = f.calls[2];
    expect(post.headers["content-type"]).toBe("application/x-www-form-urlencoded");
    const form = new URLSearchParams(post.body as string);
    expect(form.get("url")).toBe(url);
    expect(form.getAll("enabled_events[]")).toEqual([...REQUIRED_STRIPE_EVENTS]);
  });
});

describe("github adapter", () => {
  it("reads the repository id and latest release", async () => {
    const f = mockFetch([{ body: { id: 987654 } }, { body: { tag_name: "v1.26.0" } }]);
    const g = githubClient({ fetchImpl: f });
    expect(await g.repoId("federicodecillia/wegrocery")).toBe(987654);
    expect(await g.latestRelease("federicodecillia/wegrocery")).toBe("v1.26.0");
    expect(f.calls[1].url).toBe("https://api.github.com/repos/federicodecillia/wegrocery/releases/latest");
    expect(f.calls[0].headers["user-agent"]).toBe("wegrocery-console");
  });
});
