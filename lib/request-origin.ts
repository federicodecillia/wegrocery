import { headers } from "next/headers";

// The URL the member is on, so a Stripe success/cancel redirect brings them
// back to the same deploy (production, staging alias or local dev).
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
