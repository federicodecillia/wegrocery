// "by flylabs.ai" signature for FlyLabs products (Playbook 2.11).
// FlyLabs Kit registry module `firma` 1.0, as the kit ships it, with
// by-flylabs-paths.ts next to it. It follows the app theme: shadcn tokens for the
// words, `--flylabs-ai` and `--flylabs-spark` (in app/globals.css) for the brand
// colours, so no hex lives in the component (Playbook 2.2).
import { BY_FLYLABS_PATHS, BY_FLYLABS_VIEWBOX } from "./by-flylabs-paths";

export type Locale = "it" | "en";

/** Width / height of the artwork, to size the box without layout shift. */
export const BY_FLYLABS_RATIO = 6.318;

/** Below this width the spark dot no longer reads: use the plain text. */
export const BY_FLYLABS_MIN_WIDTH = 120;

export const FLYLABS_SITE = "https://www.flylabs.ai";

/** Where the signature links: the product page on flylabs.ai, else the home, in the user's language. */
export function flylabsHref(locale: Locale, productSlug?: string): string {
  return productSlug ? `${FLYLABS_SITE}/${locale}/${productSlug}` : `${FLYLABS_SITE}/${locale}`;
}

type Props = {
  locale: Locale;
  /** Slug of the product page on flylabs.ai, e.g. "gpt-chatbot". Without it, the home. */
  productSlug?: string;
  /** Height in px. The width follows (min 120 px wide, so at least 19 px high). */
  height?: number;
  /** Inside an app the link opens a new tab; on public pages it stays in the same one. */
  newTab?: boolean;
  /** Plain text instead of the drawn wordmark, for small spots. */
  text?: boolean;
  className?: string;
};

export function ByFlylabs({ locale, productSlug, height = 20, newTab = false, text = false, className }: Props) {
  const href = flylabsHref(locale, productSlug);
  const target = newTab ? { target: "_blank", rel: "noopener" } : {};
  if (text || height * BY_FLYLABS_RATIO < BY_FLYLABS_MIN_WIDTH) {
    return (
      <a href={href} {...target} className={["text-muted-foreground hover:text-foreground", className].filter(Boolean).join(" ")}>
        by flylabs.ai
      </a>
    );
  }
  return (
    <a href={href} {...target} aria-label="by flylabs.ai" className={["inline-flex items-center", className].filter(Boolean).join(" ")}>
      <svg
        viewBox={BY_FLYLABS_VIEWBOX}
        height={height}
        width={Math.round(height * BY_FLYLABS_RATIO)}
        aria-hidden="true"
        focusable="false"
      >
        <path d={BY_FLYLABS_PATHS.by} className="fill-muted-foreground" />
        <path d={BY_FLYLABS_PATHS.flylabs} className="fill-foreground" />
        <path d={BY_FLYLABS_PATHS.dot} className="fill-(--flylabs-spark)" />
        <path d={BY_FLYLABS_PATHS.ai} className="fill-(--flylabs-ai)" />
      </svg>
    </a>
  );
}
