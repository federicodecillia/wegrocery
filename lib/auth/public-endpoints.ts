import { googleCredentials } from "./config";

// The only Better Auth endpoints that answer over HTTP. Everything else
// (listing or revoking sessions...) is called server-side through its API, or
// not at all.
export function isPublicAuthEndpoint(
  method: string,
  pathname: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const get = ["/api/auth/magic-link/verify"];
  const post = ["/api/auth/sign-in/magic-link", "/api/auth/sign-in/email-otp"];
  if (googleCredentials(env)) {
    get.push("/api/auth/callback/google");
    post.push("/api/auth/sign-in/social");
  }
  if (env.DEMO_MODE === "true") post.push("/api/auth/demo/sign-in");
  if (env.NODE_ENV !== "production" && env.AUTH_DEV_LOGIN_EMAIL?.trim()) post.push("/api/auth/dev/sign-in");
  if (method === "GET") return get.includes(pathname);
  if (method === "POST") return post.includes(pathname);
  return false;
}
