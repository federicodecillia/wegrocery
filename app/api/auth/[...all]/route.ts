import { toNextJsHandler } from "better-auth/next-js";
import { getAuthInstance } from "@/auth";
import { isPublicAuthEndpoint } from "@/lib/auth/public-endpoints";

// Better Auth over HTTP, limited to the endpoints the login needs
// (lib/auth/public-endpoints.ts); everything else is a 404.
// Built on the first request, not at import (the build has no database).
const handler = () => toNextJsHandler(getAuthInstance());
const notFound = () => new Response("Not Found", { status: 404 });

export async function GET(request: Request): Promise<Response> {
  return isPublicAuthEndpoint("GET", new URL(request.url).pathname) ? handler().GET(request) : notFound();
}

export async function POST(request: Request): Promise<Response> {
  return isPublicAuthEndpoint("POST", new URL(request.url).pathname) ? handler().POST(request) : notFound();
}
