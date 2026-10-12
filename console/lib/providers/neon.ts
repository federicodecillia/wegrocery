import { requestJson, withQuery, type FetchLike } from "@/lib/http";

// Thin adapter over the Neon API v2 (api-docs.neon.tech, October 2026). With
// a personal API key the organization must be named: `org_id` inside the
// project for creation. The connection string is fetched only when it is
// written to Vercel and is never returned to a page or stored.

const API = "https://console.neon.tech/api/v2";
const SERVICE = "Neon";

export const DEFAULT_REGION = "aws-eu-central-1";
export const DEFAULT_PG_VERSION = 17;
/** Names Neon gives the first database and role of a new project. */
export const DEFAULT_DATABASE = "neondb";
export const DEFAULT_ROLE = "neondb_owner";

export interface NeonClientOptions {
  apiKey: string;
  fetchImpl?: FetchLike;
}

export function neonClient({ apiKey, fetchImpl = fetch }: NeonClientOptions) {
  const headers = { Authorization: `Bearer ${apiKey}` };

  return {
    /** POST /projects. Returns only the id: the response's connection URIs are dropped. */
    async createProject(input: { name: string; orgId?: string | null; regionId?: string; pgVersion?: number }): Promise<{ id: string }> {
      const res = await requestJson<{ project: { id: string } }>({
        service: SERVICE,
        fetchImpl,
        url: `${API}/projects`,
        method: "POST",
        headers,
        body: {
          project: {
            name: input.name,
            region_id: input.regionId ?? DEFAULT_REGION,
            pg_version: input.pgVersion ?? DEFAULT_PG_VERSION,
            ...(input.orgId ? { org_id: input.orgId } : {}),
          },
        },
      });
      return { id: res.project.id };
    },

    /** GET /projects/{id}/connection_uri: the pooled URI of the default branch. */
    async connectionUri(projectId: string, opts: { database?: string; role?: string; pooled?: boolean } = {}): Promise<string> {
      const res = await requestJson<{ uri: string }>({
        service: SERVICE,
        fetchImpl,
        url: withQuery(`${API}/projects/${encodeURIComponent(projectId)}/connection_uri`, {
          database_name: opts.database ?? DEFAULT_DATABASE,
          role_name: opts.role ?? DEFAULT_ROLE,
          pooled: String(opts.pooled ?? true),
        }),
        headers,
      });
      return res.uri;
    },
  };
}

export type NeonClient = ReturnType<typeof neonClient>;

export function neonDashboardUrl(projectId: string): string {
  return `https://console.neon.tech/app/projects/${encodeURIComponent(projectId)}`;
}
