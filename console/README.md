# WeGrocery Console

An operator dashboard for running several WeGrocery installations: one
table with the health and the anonymous usage counts of every group, a
provisioning wizard that creates a new installation end to end (Neon
database, Vercel project, email, optional Stripe webhook, first deploy), a
fleet redeploy, and a public intake form for groups that want the app.

It is a separate Next.js 16 app living in `console/` of the WeGrocery
repository, with its own `package.json`, lockfile, registry database and
Vercel project. The main app never imports from here and vice versa.

The UI is in Italian (its only user is the operator); code and docs are in
English.

## The two hosting models

| | A · Managed (`Gestito`) | B · Group-owned (`Del gruppo`) |
|---|---|---|
| Vercel project, Neon database, Resend | in the operator's accounts | in the group's Vercel team and Neon organization |
| How the console reaches them | the operator's personal tokens | the same personal tokens, after the operator is invited to the group's Vercel team and Neon org; the wizard asks for the group's `teamId` / `org_id` |
| Stripe | **always the group's own account** | **always the group's own account** |

For model B the group's Vercel team must be able to read the GitHub
repository (the Vercel GitHub app installed with access to it, or a fork in
the group's GitHub), otherwise creating the project or deploying fails.

## What it never stores

- No member data of any group: the instances only expose anonymous counts.
- No provider secret: the Neon connection string, `AUTH_SECRET`, the Resend
  sending key and the group's Stripe keys go straight from the provider (or
  the random generator) to the instance's Vercel environment variables, typed
  `sensitive`, inside one server action. They are never written to the
  registry, the audit log or the server log.
- The only stored secret is each instance's `INSTANCE_STATS_SECRET` (it only
  unlocks anonymous counts), encrypted with AES-256-GCM under
  `CONSOLE_ENCRYPTION_KEY` and bound to the instance id.
- IP addresses (login and intake rate limits) are stored as keyed hashes.

## Environment variables

| Variable | Required | What |
|---|---|---|
| `DATABASE_URL` | yes | The console's own Neon database (the registry). |
| `MIGRATE_ON_BUILD` | recommended | `true`: production builds apply pending registry migrations first. |
| `CONSOLE_PASSWORD` | yes | Operator password, at least 16 characters. Shorter or unset: login disabled. |
| `CONSOLE_SESSION_SECRET` | yes | At least 32 characters; signs the 12 h session cookie. Changing it (or the password) signs out. |
| `CONSOLE_ENCRYPTION_KEY` | yes | 32 bytes, hex or base64 (`openssl rand -hex 32`); encrypts the stored stats secrets. |
| `CRON_SECRET` | for the cron | Vercel sends it as `Authorization: Bearer …` to `/api/cron/refresh`. Unset: the route answers 404. |
| `RESEND_API_KEY` | for email | The operator's Resend key: the console's own emails, and creating the groups' domains and sending keys. Needs full access. |
| `MAIL_FROM` | for email | Sender of the console's own emails, on a domain verified in that Resend account. |
| `CONSOLE_ALERT_EMAIL` | optional | Where the daily alerts and new intake requests go. |
| `VERCEL_TOKEN` | for provisioning | The operator's personal Vercel token (full account scope, so it reaches invited teams too). |
| `NEON_API_KEY` | for provisioning | The operator's personal Neon API key. |
| `CONSOLE_SHARED_MAIL_DOMAIN` | optional | A domain verified on the operator's Resend account, for groups without their own (`<slug>@domain`). |
| `CONSOLE_SHARED_MAIL_DOMAIN_ID` | with the above | Its Resend domain id: the groups' sending keys are restricted to it. |
| `WEGROCERY_REPO` | optional | Default `federicodecillia/wegrocery`. |
| `WEGROCERY_REPO_ID` | optional | Numeric GitHub repository id for Vercel's `gitSource`; read from the public GitHub API when unset. |
| `GITHUB_TOKEN` | optional | Only raises the GitHub API rate limit (latest release, repository id). |

See `.env.example`.

## Deploy

1. **Registry database**: create a Neon project (free plan is enough) and
   copy its connection string.
2. **Vercel project**: import this repository, set **Root Directory** to
   `console`, framework Next.js. Add the variables above (secrets as
   *Sensitive*), with `MIGRATE_ON_BUILD=true`.
3. **Deploy**. The build applies `drizzle/0000_init.sql` and later files
   (tracked in a `_migrations` table, like the main app). To run them by hand:
   `DATABASE_URL=… node scripts/db-migrate.mjs` (`--status` lists them).
4. **Cron**: `vercel.json` schedules `/api/cron/refresh` once a day at 05:00
   UTC. That is within the Hobby plan, whose cron jobs run at most once a day
   (and at an imprecise minute); no Pro plan needed.
5. Sign in at `/login`. Share `/richiesta` with groups that want the app.

Locally: `cp .env.example .env.local`, fill it, `npm install`,
`npm run db:migrate`, `npm run dev` (port 3100).

## Adding the existing installations

On each installation (production, demo, …):

1. Set `INSTANCE_STATS_SECRET` in its Vercel project, at least 32
   characters: `openssl rand -hex 32`. Redeploy. Without it the main app's
   `GET /api/instance-stats` answers 404.
2. In the console, *Aggiungi istanza esistente*: name, slug, URL, model, the
   same secret (pasted once, stored encrypted), and the Vercel project id if
   the console should redeploy it. Give production installations with real
   members a high *ordine di rilascio* (e.g. 1000) so a fleet update reaches
   them last.

## How it talks to the instances

- `GET /api/health` (public): `{ ok, version, db }`, 503 when the database
  is down.
- `GET /api/instance-stats`: signed with `x-wegrocery-timestamp` (unix
  seconds) and `x-wegrocery-signature` = lowercase hex HMAC-SHA256, keyed with
  the instance's `INSTANCE_STATS_SECRET`, of `${timestamp}.GET./api/instance-stats`
  (300 s clock skew). Implemented in `lib/stats/signature.ts`, checked against
  a vector computed with `openssl`.

## The provisioning wizard

Steps are stored in `provisioning_steps`; each is idempotent and can be
retried (*Riprova*) or resumed later from the instance page.

1. **Anagrafica**: group, slug, first admin, language, currency, time zone,
   model (+ team/org ids for model B). Can start from an intake request.
2. **Identità iniziale**: app name, short name, colours (live preview and
   WCAG AA check), logo URL. Produces `NEXT_PUBLIC_BRAND_JSON` and
   `NEXT_PUBLIC_TIME_ZONE`; the group refines the brand in the app's own setup.
3. **Database**: Neon project `wegrocery-<slug>`, Postgres 17, `aws-eu-central-1`.
4. **App**: Vercel project `wegrocery-<slug>` linked to the repository, then
   every variable in one server action (`DATABASE_URL` and
   `MIGRATE_ON_BUILD` on production only).
5. **Email**: the group's domain on Resend (`eu-west-1`, DNS records to copy,
   *Verifica*), or the shared domain; then a sending-only key restricted to that
   domain, written with `MAIL_FROM`. Resend Free allows 3 domains and 100
   emails a day per account.
6. **Pagamenti** (optional): the group's `sk_…`/`rk_…` key creates the
   webhook endpoint with the events in `lib/providers/stripe.ts` (a copy of
   the main app's `REQUIRED_STRIPE_EVENTS`; keep them in step) and writes
   `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Live keys only work on
   the production deployment.
7. **Pubblica**: a production deployment of `main` through `gitSource`,
   then polling until the build is ready, `/api/health` is ok and the signed
   stats show no pending migration.
8. **Dominio** (optional): adds a custom domain to the project, shows the
   DNS record, updates `APP_BASE_URL` (a redeploy applies it).
9. **Consegna**: the Italian text for the first admin, to copy or email.

## Fleet

*Ridistribuisci versione* redeploys one instance; *Aggiorna flotta*
redeploys every live instance one at a time, ordered by `rollout_order`
(then creation date), waiting for each `/api/health` before the next and
stopping at the first failure. The browser drives the sequence through short
server actions, so no request outlives a serverless function timeout; keep
the page open while it runs.

## Development

```bash
npm run dev         # http://localhost:3100
npx tsc --noEmit
npm run lint
npx vitest run      # pure unit tests, no database, no network
npx next build      # needs no environment variable
```

CI: `.github/workflows/console.yml`. The root app's TypeScript, ESLint and
Vitest configs exclude `console/`.

## Security notes

- Single operator, password login: constant-time comparison, at most 5
  failed attempts per IP in 15 minutes, `httpOnly` + `Secure` +
  `SameSite=Strict` cookie with an HMAC-signed 12 h token. `proxy.ts`
  redirects early; every page, route handler and server action checks the
  session again.
- Every write action goes to `audit_log` with a short detail and never a
  secret value.
- Token scopes: the Vercel and Neon tokens are personal and broad by nature
  (the APIs have no narrower scope for project creation); keep them only in
  the console's Vercel project as *Sensitive*. The Resend key needs full
  access to create domains and keys; the keys it creates for the groups are
  sending-only and restricted to one domain.
- The public intake form warns not to paste secrets, refuses text that
  looks like a key, has a honeypot, length limits and 3 submissions per IP
  per hour.
