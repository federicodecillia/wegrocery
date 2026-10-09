import { ProviderError, requestJson, withQuery, type FetchLike } from "@/lib/http";

// Thin adapter over the Vercel REST API (checked against vercel.com/docs/rest-api,
// October 2026). Every call carries the instance's teamId: managed
// installations use the operator's own team, group-owned ones the group's
// team the operator was invited to; the token is the operator's personal one.

const API = "https://api.vercel.com";
const SERVICE = "Vercel";

export type EnvTarget = "production" | "preview" | "development";
/** `sensitive` cannot be read back after creation; it is not allowed on development. */
export type EnvType = "sensitive" | "encrypted" | "plain";

export interface EnvVar {
  key: string;
  value: string;
  type: EnvType;
  target: EnvTarget[];
}

export interface VercelProject {
  id: string;
  name: string;
  link?: { type?: string; repoId?: number | string; productionBranch?: string } | null;
}

export type ReadyState = "QUEUED" | "INITIALIZING" | "BUILDING" | "READY" | "ERROR" | "CANCELED" | "DELETED";

export interface VercelDeployment {
  id: string;
  url?: string;
  readyState?: ReadyState;
  alias?: string[];
  errorMessage?: string | null;
}

export interface ProjectDomain {
  name: string;
  verified: boolean;
  verification?: { type: string; domain: string; value: string; reason: string }[];
}

export interface VercelClientOptions {
  token: string;
  teamId?: string | null;
  fetchImpl?: FetchLike;
}

export function vercelClient({ token, teamId, fetchImpl = fetch }: VercelClientOptions) {
  const headers = { Authorization: `Bearer ${token}` };
  const url = (path: string, query: Record<string, string | null | undefined> = {}) =>
    withQuery(`${API}${path}`, { ...query, teamId: teamId ?? undefined });
  const call = <T>(method: string, path: string, body?: unknown, query?: Record<string, string | null | undefined>) =>
    requestJson<T>({ service: SERVICE, fetchImpl, url: url(path, query), method, headers, body });

  return {
    /** POST /v11/projects: a Next.js project linked to the GitHub repository. */
    createProject(input: { name: string; repo: string }) {
      return call<VercelProject>("POST", "/v11/projects", {
        name: input.name,
        framework: "nextjs",
        gitRepository: { type: "github", repo: input.repo },
      });
    },

    /** GET /v9/projects/{idOrName}; null when it does not exist. */
    async getProject(idOrName: string): Promise<VercelProject | null> {
      try {
        return await call<VercelProject>("GET", `/v9/projects/${encodeURIComponent(idOrName)}`);
      } catch (e) {
        if (e instanceof ProviderError && e.status === 404) return null;
        throw e;
      }
    },

    /**
     * POST /v10/projects/{id}/env?upsert=true with an array body. A partial
     * failure (`failed` non-empty) throws, naming the keys only.
     */
    async upsertEnv(projectId: string, vars: EnvVar[]): Promise<void> {
      const res = await call<{ failed?: { error?: { key?: string; envVarKey?: string; code?: string } }[] }>(
        "POST",
        `/v10/projects/${encodeURIComponent(projectId)}/env`,
        vars.map((v) => ({ key: v.key, value: v.value, type: v.type, target: v.target })),
        { upsert: "true" },
      );
      const failed = res?.failed ?? [];
      if (failed.length) {
        const names = failed.map((f) => `${f.error?.envVarKey ?? f.error?.key ?? "?"} (${f.error?.code ?? "error"})`);
        throw new ProviderError(SERVICE, 0, `variabili non salvate: ${names.join(", ")}`);
      }
    },

    /** POST /v13/deployments: a production build of `ref` from the GitHub repository. */
    createDeployment(input: { projectName: string; projectId: string; repoId: string | number; ref?: string }) {
      return call<VercelDeployment>(
        "POST",
        "/v13/deployments",
        {
          name: input.projectName,
          project: input.projectId,
          target: "production",
          gitSource: { type: "github", repoId: String(input.repoId), ref: input.ref ?? "main" },
        },
        { forceNew: "1", skipAutoDetectionConfirmation: "1" },
      );
    },

    /** GET /v13/deployments/{id}. */
    getDeployment(id: string) {
      return call<VercelDeployment>("GET", `/v13/deployments/${encodeURIComponent(id)}`);
    },

    /** POST /v10/projects/{id}/domains. */
    addDomain(projectId: string, name: string) {
      return call<ProjectDomain>("POST", `/v10/projects/${encodeURIComponent(projectId)}/domains`, { name });
    },
  };
}

export type VercelClient = ReturnType<typeof vercelClient>;

export function isFinalState(state: ReadyState | undefined): boolean {
  return state === "READY" || state === "ERROR" || state === "CANCELED" || state === "DELETED";
}

/** DNS record a custom domain needs on Vercel: CNAME for a subdomain, A for an apex. */
export function domainDnsRecord(domain: string): { type: "A" | "CNAME"; name: string; value: string } {
  const labels = domain.split(".");
  return labels.length <= 2
    ? { type: "A", name: "@", value: "76.76.21.21" }
    : { type: "CNAME", name: labels.slice(0, -2).join("."), value: "cname.vercel-dns.com" };
}

/**
 * The production `.vercel.app` address among a deployment's aliases: the
 * shortest one (Vercel adds longer team- and branch-scoped ones). Null when
 * there is none.
 */
export function productionAlias(aliases: string[] | undefined): string | null {
  const candidates = (aliases ?? []).filter((a) => a.endsWith(".vercel.app") && !a.includes("-git-"));
  if (!candidates.length) return null;
  return candidates.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
}

export function vercelDashboardUrl(teamSlugOrId: string | null, projectName: string): string {
  return teamSlugOrId
    ? `https://vercel.com/${encodeURIComponent(teamSlugOrId)}/${encodeURIComponent(projectName)}`
    : `https://vercel.com/dashboard`;
}
