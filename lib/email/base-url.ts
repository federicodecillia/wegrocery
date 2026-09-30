// Absolute base URL for links inside outbound emails (e.g. the manage-
// preferences link). A background send or a Server Action has no request
// origin to build them from, so we read it from env.
//
// APP_BASE_URL (explicit, no trailing slash) wins; otherwise fall back to
// Vercel's production URL. Returns null when neither is set — callers then
// omit the links rather than emitting broken relative URLs.
export function getAppBaseUrl(): string | null {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return null;
}
