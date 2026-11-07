import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { ByFlylabs } from "@/components/by-flylabs";
import { RichText } from "@/components/rich-text";
import { getBrand } from "@/lib/brand/get-brand";
import { FLYLABS_PRODUCT_SLUG } from "@/lib/brand/flylabs";
import { getPublicCycles, getPublicProducts } from "@/lib/db/public";
import { t } from "@/lib/i18n";
import { formatDate, formatDateTime, formatMoney, formatTime } from "@/lib/i18n/format";
import { getPaymentSettings } from "@/lib/payments/get-settings";
import { joinAction, pickPublicCycle } from "@/lib/public-page";

// Read on every visit: the admins may switch the page off at any time.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [brand, settings] = await Promise.all([getBrand(), getPaymentSettings()]);
  const indexable = settings.publicPage.enabled && settings.publicPage.indexable;
  return {
    title: brand.appName,
    description: brand.description,
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title: brand.appName, description: brand.description, images: [{ url: brand.logoUrl }] },
  };
}

// The group's shop window for people who are not in yet (lib/public-page.ts):
// its text, the next cycle and, if the admins want, its products. No session,
// no personal data: the queries are in lib/db/public.ts. Off: /login.
export default async function PublicGroupPage() {
  const [brand, settings] = await Promise.all([getBrand(), getPaymentSettings()]);
  if (!settings.publicPage.enabled) redirect("/login");
  const s = t.publicPage;
  const cycle = pickPublicCycle(await getPublicCycles(), new Date());
  const items = cycle && settings.publicPage.productsPreview ? await getPublicProducts(cycle.cycleId) : [];
  const join = joinAction(settings.signupMode);

  const button = "inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 text-[15px] font-bold";
  const when = (d: Date | null) => (d ? formatDateTime(d, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : null);
  const pickup = cycle?.pickupDate
    ? `${formatDate(cycle.pickupDate, { weekday: "long", day: "numeric", month: "long" })}, ${formatTime(cycle.pickupDate)}${cycle.pickupEndTime ? `-${cycle.pickupEndTime}` : ""}`
    : null;

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-8">
      <header className="flex flex-col items-center text-center">
        <BrandLogo src={brand.logoUrl} alt="" shortName={brand.shortName} />
        <h1 className="mt-3 text-title font-black text-foreground">{brand.appName}</h1>
        {brand.description ? <p className="mt-1 text-sm text-secondary-foreground">{brand.description}</p> : null}
      </header>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/login" className={`${button} bg-primary text-primary-foreground`}>
          {s.signIn}
        </Link>
        {join ? (
          <Link href="/aderisci" className={`${button} border border-border bg-card text-foreground`}>
            {join === "request" ? s.askToJoin : s.signUp}
          </Link>
        ) : null}
      </div>

      {settings.publicPage.intro ? (
        <section className="mt-6 rounded-card border border-border bg-card p-5 shadow-card">
          <RichText text={settings.publicPage.intro} />
        </section>
      ) : null}

      <section aria-labelledby="next-cycle" className="mt-6 rounded-card border border-border bg-card p-5 shadow-card">
        <h2 id="next-cycle" className="text-[17px] font-bold text-foreground">
          {cycle?.status === "planned" ? s.planned : s.next}
        </h2>
        {cycle ? (
          <>
            <p className="mt-1 text-[15px] font-semibold text-foreground">{cycle.title}</p>
            <dl className="mt-3 space-y-2 text-[14px]">
              {cycle.status === "planned" && cycle.orderOpenAt ? (
                <div>
                  <dt className="text-secondary-foreground">{s.opens}</dt>
                  <dd className="font-medium text-foreground">{when(cycle.orderOpenAt)}</dd>
                </div>
              ) : null}
              {cycle.orderCloseAt ? (
                <div>
                  <dt className="text-secondary-foreground">{s.closes}</dt>
                  <dd className="font-medium text-foreground">{when(cycle.orderCloseAt)}</dd>
                </div>
              ) : null}
              {pickup ? (
                <div>
                  <dt className="text-secondary-foreground">{s.pickup}</dt>
                  <dd className="font-medium text-foreground">
                    {pickup}
                    {cycle.pickupTentative ? ` (${s.toConfirm})` : null}
                  </dd>
                </div>
              ) : null}
            </dl>
            {cycle.datesTentative ? <p className="mt-2 text-[13px] text-secondary-foreground">{s.tentative}</p> : null}
          </>
        ) : (
          <p className="mt-1 text-[14px] text-secondary-foreground">{s.none}</p>
        )}
      </section>

      {items.length > 0 ? (
        <section aria-labelledby="products" className="mt-6 rounded-card border border-border bg-card p-5 shadow-card">
          <h2 id="products" className="text-[17px] font-bold text-foreground">
            {s.products(items.length)}
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {items.map((p) => (
              <li key={p.productId} className="flex items-start justify-between gap-3 py-2.5">
                <span className="min-w-0 text-[14px] text-foreground">
                  {p.emoji ? <span aria-hidden className="mr-1.5">{p.emoji}</span> : null}
                  <span className="font-medium">{p.name}</span>
                  {p.variant || p.format ? (
                    <span className="text-secondary-foreground"> · {[p.variant, p.format].filter(Boolean).join(", ")}</span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-[14px] font-semibold text-foreground">
                  {formatMoney(p.unitPrice)}
                  {p.unit ? <span className="font-normal text-secondary-foreground">/{p.unit}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 text-center text-[14px] text-secondary-foreground">
        <p>
          {s.contact}{" "}
          <a href={`mailto:${brand.supportEmail}`} className="font-semibold text-foreground underline">
            {brand.supportEmail}
          </a>
        </p>
        {brand.privacyUrl || brand.termsUrl ? (
          <p className="mt-2 flex flex-wrap justify-center gap-x-4">
            {brand.privacyUrl ? (
              <a href={brand.privacyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">
                {t.login.privacyLink}
              </a>
            ) : null}
            {brand.termsUrl ? (
              <a href={brand.termsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">
                {t.login.termsLink}
              </a>
            ) : null}
          </p>
        ) : null}
        {brand.flylabsSignature ? (
          <ByFlylabs
            locale={brand.locale}
            productSlug={FLYLABS_PRODUCT_SLUG}
            text
            newTab
            className="mt-2 inline-flex min-h-11 items-center text-label text-secondary-foreground! hover:text-foreground!"
          />
        ) : null}
      </section>
    </main>
  );
}
