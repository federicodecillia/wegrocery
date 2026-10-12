import { requestJson, type FetchLike } from "@/lib/http";

// The public GitHub API, for two facts about the WeGrocery repository: its
// numeric id (Vercel's gitSource needs it) and the latest release tag. No
// token needed; GITHUB_TOKEN only raises the rate limit.

const API = "https://api.github.com";
const SERVICE = "GitHub";

export function githubClient({ token, fetchImpl = fetch }: { token?: string | null; fetchImpl?: FetchLike } = {}) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "wegrocery-console",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return {
    async repoId(repo: string): Promise<number> {
      const res = await requestJson<{ id: number }>({ service: SERVICE, fetchImpl, url: `${API}/repos/${repo}`, headers });
      return res.id;
    },
    async latestRelease(repo: string): Promise<string | null> {
      const res = await requestJson<{ tag_name?: string }>({ service: SERVICE, fetchImpl, url: `${API}/repos/${repo}/releases/latest`, headers });
      return res.tag_name ?? null;
    },
  };
}
