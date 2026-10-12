import { parseLogoFile } from "@/lib/brand/identity";
import { getLogoBytes } from "@/lib/brand/get-brand";

// The logo uploaded by the admins (lib/brand/identity.ts). Its URL carries the
// upload time, so a new logo is a new URL and this one can be cached for good.
// Public through proxy.ts (by its extension): the login page shows it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const file = parseLogoFile((await params).file);
  if (!file) return new Response("Not Found", { status: 404 });
  const logo = await getLogoBytes().catch(() => null);
  if (!logo) return new Response("Not Found", { status: 404 });
  return new Response(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": logo.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
