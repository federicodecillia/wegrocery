# Run WeGrocery for your group

This guide takes a group from nothing to a working WeGrocery in about 30
minutes, without touching the code: one Vercel project, one Neon database,
one email domain. Everything else (online payments, Google sign-in, error
reporting) can be added later.

The app tells you at every step what is still missing: admin → Impostazioni
→ *Configuration status*, or `npm run doctor` from a checkout with your
environment. It shows variable names and states, never a value.

## What you need

- A **GitHub** account (the deploy copies the code into a repository of yours).
- A **Vercel** account. Check that your plan fits your use: the Hobby plan is
  for non-commercial use, a group that collects money through the app may
  need Pro.
- A **Resend** account ([resend.com](https://resend.com)) and a domain you can
  add DNS records to: members sign in with a link sent by email.
- The group's name, logo and colours (optional, see step 4).

The database is created for you on **Neon** during the deploy.

## 1. Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ffedericodecillia%2Fwegrocery&project-name=wegrocery&repository-name=wegrocery&env=AUTH_SECRET%2CBOOTSTRAP_ADMIN_EMAIL%2CRESEND_API_KEY%2CMAIL_FROM%2CMIGRATE_ON_BUILD&envDefaults=%7B%22MIGRATE_ON_BUILD%22%3A%22true%22%7D&envDescription=AUTH_SECRET%3A%20run%20openssl%20rand%20-hex%2032.%20BOOTSTRAP_ADMIN_EMAIL%3A%20your%20address%2C%20it%20becomes%20the%20first%20admin.%20RESEND_API_KEY%20and%20MAIL_FROM%3A%20email%20from%20a%20domain%20verified%20on%20Resend.%20Keep%20MIGRATE_ON_BUILD%3Dtrue.&envLink=https%3A%2F%2Fgithub.com%2Ffedericodecillia%2Fwegrocery%2Fblob%2Fmain%2Fdocs%2Fself-hosting.md%232-the-variables-the-deploy-asks-for&stores=%5B%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%7D%5D)

The button walks you through:

1. **Git repository**: Vercel creates a copy of WeGrocery in your GitHub
   account. Name it as you like.
2. **Neon**: add the database it proposes: pick the region closest to your
   members, switch **Auth off** (WeGrocery has its own sign-in; Neon Auth
   would only add tables and variables you do not use) and keep the free
   plan, enough to start. It sets `DATABASE_URL` on the project for you.
3. **Environment variables**: the five in step 2 below.
4. **Deploy**. The build applies every migration to the empty database
   (`MIGRATE_ON_BUILD`), then the app goes live at
   `https://<project>.vercel.app`.

Vercel may start a first build before your variables are saved. That build
runs without them and does not create the tables: when the project shows
them under Settings → Environment Variables, open Deployments → ⋯ →
**Redeploy** on the latest one. The redeploy applies the migrations.

## 2. The variables the deploy asks for

| Variable | What to put |
|---|---|
| `AUTH_SECRET` | A random key that signs the sessions. Generate it with `openssl rand -hex 32` and keep it: changing it signs everyone out. |
| `BOOTSTRAP_ADMIN_EMAIL` | Your email address. The first time you sign in with it you become the group's admin (step 3). |
| `RESEND_API_KEY` | An API key from Resend → API Keys, with permission to send. |
| `MAIL_FROM` | The sender of every email, on a domain verified on Resend, e.g. `Riverside GAS <noreply@riverside.example>`. |
| `MIGRATE_ON_BUILD` | Leave `true`: every production build applies the new migrations first, so an update is just a redeploy. Preview builds never migrate. |

To verify the domain on Resend: Resend → Domains → Add domain, then add the
DNS records it shows at your domain provider. It takes a few minutes. Until
the domain is verified no email leaves, so nobody can sign in.

## 3. Become the admin

1. Open the app and enter the address you put in `BOOTSTRAP_ADMIN_EMAIL`.
2. Open the link in the email: you are in, as admin.
3. Open admin → Impostazioni → *Configuration status*. *First admin* now says
   the variable is no longer needed: remove `BOOTSTRAP_ADMIN_EMAIL` from the
   Vercel project (Settings → Environment Variables). It is ignored anyway
   as soon as the group has an active admin.

Any other address that tries to sign in gets an email saying it is not a
member: members are added by an admin (step 5).

## 4. Your group's name, logo and colours

The simplest way is in the app: after your first sign-in, Admin offers a
**first-run setup** (also at `/admin/avvio`) that walks you through name,
logo, colours, contacts, payments and "Our group", then checks that email
and Stripe work. Everything stays editable in Admin → Impostazioni.

Language, currency and time zone are chosen once, in the environment. The
same identity can also be given as a starting point there (the app's
settings win over it). Add these in Vercel → Settings → Environment
Variables, then redeploy (Deployments → ⋯ → Redeploy): they are read when
the app is built.

- `NEXT_PUBLIC_BRAND_JSON`: the group's identity as one line of JSON. Start
  from [brand.example.json](brand.example.json); every field is optional and
  falls back to WeGrocery's.

  | Field | Meaning |
  |---|---|
  | `appName`, `shortName` | Full name, and the short one for the home screen icon |
  | `description`, `orgName` | Description for search engines; legal name in email signatures |
  | `locale` | `"en"` or `"it"`: the language of the app and the emails |
  | `currency` | ISO code, e.g. `"EUR"` |
  | `logoUrl` | The logo: `/logo.png` is WeGrocery's, or the absolute URL of yours (square works best) |
  | `headerShowName` | `false` when the logo already contains the name |
  | `supportEmail`, `techEmail` | Who members and admins write to |
  | `archiveCcEmail` | Copy of every supplier order email, or `null` |
  | `privacyUrl`, `membershipUrl` | Absolute links to the privacy notice and to the membership page, or `null` |
  | `minBalance` | Default credit limit (e.g. `-50`), or `null`; admins can change it in Impostazioni |
  | `bankTransfer` | `{ "holder": "...", "iban": "..." }` shown on the top-up page, or `null` |
  | `theme` | Hex colours: `primary`, `primaryLight`, `accent`, `accentLight`, `background`, `frame` |

  The text colour on buttons is computed for readability. A field the app
  does not know (a typo), a colour that is hard to read or a value of the
  wrong type shows up in *Configuration status*. A brand that is not valid
  JSON stops the build, with the reason in the build log.
- `NEXT_PUBLIC_TIME_ZONE`: an IANA time zone, e.g. `Europe/Lisbon`, if the
  group is not on `Europe/Rome` time.
- `APP_BASE_URL`: the app's address for the links inside emails, e.g.
  `https://gas.riverside.example`, when you use your own domain (Vercel →
  Settings → Domains). Without it emails link to the `vercel.app` address.

## 5. Members

Admin → Soci: add each member with name, email and role (and, if they use
two addresses, the second one as alias), then *Invite*: they receive a
sign-in link.

## 6. Check

- Admin → Impostazioni → *Configuration status*: nothing required is
  *Missing*.
- `https://<your app>/api/health` answers `{"ok":true,...}` with the version.

## Optional integrations

All of them can be added at any time: set the variables, redeploy, and check
*Configuration status*.

### Online payments (Stripe)

Members top up their balance (or pay each order, depending on the payment
mode chosen in Impostazioni) by card.

The simplest way needs no variables: an admin opens Admin → Impostazioni →
*Collegamento a Stripe* and pastes a restricted key of the group's own Stripe
account (Checkout Sessions write, PaymentIntents read, Refunds write, Webhook
Endpoints write). The app checks it, creates the webhook endpoint itself and
stores both secrets encrypted with a key derived from `AUTH_SECRET` (rotating
`AUTH_SECRET` means connecting again). It needs `APP_BASE_URL` (or Vercel's
production URL) so Stripe knows where to post.

Alternatively, whoever hosts the app sets the variables below; they take
priority, and the in-app card then only says Stripe is configured by the host.

1. Stripe → Developers → API keys: put the secret key in
   `STRIPE_SECRET_KEY`. Live keys (`sk_live_…`) work only on the production
   deployment, test keys (`sk_test_…`) everywhere else.
2. Stripe → Developers → Webhooks → Add endpoint:
   `https://<your app>/api/stripe/webhook`, with the events listed in
   *Configuration status* (`REQUIRED_STRIPE_EVENTS` in
   `lib/payments/config.ts`).
3. Put the endpoint's signing secret in `STRIPE_WEBHOOK_SECRET`.

### Sign in with Google

An extra to the email link. Google Cloud Console → APIs & Services →
Credentials → OAuth client of type *Web application*, with redirect URI
`https://<your app>/api/auth/callback/google`. Set `AUTH_GOOGLE_ID` and
`AUTH_GOOGLE_SECRET`.

### Error reporting (Sentry)

`SENTRY_DSN` of a Sentry project: server errors are reported without member
data.

### Anonymous stats for an operator console

If you run several groups with the WeGrocery Console (`console/` in this
repository), set `INSTANCE_STATS_SECRET` (`openssl rand -hex 32`) on each
installation and give the same value to the console: it then reads counts
only (members, cycles, orders, version, configuration states), never names,
addresses or amounts. Without the variable the endpoint answers 404.

### Membership card check (WallyFor)

Specific to groups that manage their membership on WallyFor: with
`WALLYFOR_API_KEY` and `WALLYFOR_MERCHANT_ID` an active card is required to
sign in, and card holders join by themselves at their first sign-in.

## Staging and preview deployments

Only `main` (production) and `staging` (a preview) are deployed: `git.deploymentEnabled`
in `vercel.json` skips every other branch, because each kept deployment counts
toward the Hobby plan's Function Storage. Add a branch there to preview it. Outside production every
email is redirected to `EMAIL_REDIRECT_TO` (set it on the Preview
environment, never on Production): without it, emails are not sent there.
If previews share the production database, they see real data: the Neon
integration can give each preview its own database branch instead.

## Updating

New versions are published on
[github.com/federicodecillia/wegrocery](https://github.com/federicodecillia/wegrocery)
with notes in the CHANGELOG. Before updating, read
[upgrading.md](upgrading.md): it lists, per version, the migrations, new
variables and Stripe events.

The button copies the code into a new repository with a history of its own,
so the first update needs one extra step to link it to WeGrocery's. From a
clone of your repository:

```bash
git remote add upstream https://github.com/federicodecillia/wegrocery.git
git fetch upstream
git merge -s ours --allow-unrelated-histories --no-edit upstream/main
git read-tree -u --reset upstream/main
git commit -m "Update WeGrocery"
git push
```

This replaces the code with the new version (the group's identity lives in
environment variables, not in the code) and links the two histories. Every
later update is just:

```bash
git pull upstream main
git push
```

The push triggers a production build, which applies the new migrations
first (`MIGRATE_ON_BUILD`). Take a backup before (Neon → Branches → create a
branch from production) if the release notes ask for one.

If Vercel marks the deploy of a push as **Blocked** (on the Hobby plan, when
the commit's author is not a member of the Vercel team), create a Deploy Hook
(Vercel → your project → Settings → Git → Deploy Hooks, branch `main`) and
save its URL as the `VERCEL_DEPLOY_HOOK` secret of your GitHub repository
(Settings → Secrets and variables → Actions): the `Vercel Deploy Hook`
workflow then starts the deploy after every push to `main`.

Prefer updating from GitHub's web interface? Fork the repository instead of
using the button, then import the fork in Vercel (Add New → Project), add
Neon from the project's Storage tab and set the variables of step 2 by hand:
*Sync fork* on GitHub then brings in each new version.

## Developing

To run WeGrocery on your computer or contribute, see
[SETUP.md](../SETUP.md).
