# Operating two environments: production + demo

wegrocery runs as **two Vercel deployments from this single repository and the
same `main` branch**. They share 100% of the code and differ only in environment
variables.

| | Production | Demo |
|---|---|---|
| URL | `gas.portamoneta.org` | `wegrocery-demo.vercel.app` |
| Vercel project | `porta-moneta` (client: Porta Moneta) | `wegrocery-demo` |
| Database | production Neon (real members) | separate demo Neon (fake data) |
| `DEMO_MODE` | unset | `true` |
| Auth | Google OAuth + member whitelist | one-click Socio/Admin demo login |
| Outbound email | Resend | disabled |
| Data | real, persistent | reseeded nightly |

## One codebase, env-driven differences

Demo behaviour is **not** a branch or a fork. It lives behind the `DEMO_MODE`
flag:

- `auth.ts` registers the `demo-login` Credentials provider only when `DEMO_MODE=true`.
- `components/demo-banner.tsx` renders the banner only when the flag is on.
- `lib/email/resend.ts` short-circuits `sendMail` in demo so no mail is sent.

With the flag unset (production) none of that code path is reachable.

Both Vercel projects are connected to this repo with **Production Branch `main`**
and **Root Directory at repo root** (empty / not set). A merge to `main` rebuilds
both deployments automatically, each with its own env. Features stay in sync by
construction: it is the same commit.

**When adding a feature, ask how it behaves under `DEMO_MODE`.** If it introduces
an external side-effect (email, payments, third-party calls), add a demo guard
like the one in `sendMail`.

## Database migrations

Schema changes must be applied to **both** databases:

```bash
# production (reads .env.local)
npm run db:push

# demo (reads .env.demo.local)
node --env-file=.env.demo.local node_modules/drizzle-kit/bin.cjs push
```

If you add a table or a non-null column, update `scripts/seed-demo.ts`
too, otherwise the nightly reset (`.github/workflows/demo-reset.yml`) will fail.

## Changelogs: shared product, separate demo

- **Product changelog** — `CHANGELOG.md` + `CHANGELOG.it.md`. Real app
  features (orders, ledger, analytics). Applies to both environments. This is
  what members and repo visitors read.
- **Demo-only changes** — `DEMO_MODE`, seed, nightly reset, demo login, banner —
  go in the "Demo environment changelog" section below, **not** in the product
  changelog.

Rule of thumb: if a line describes an **app capability**, it belongs in the
product changelog. If it describes the **showcase infrastructure**, it belongs
in the demo changelog.

### Demo environment changelog

- **2026-06-10** — Initial demo mode: `DEMO_MODE` flag, one-click Socio/Admin
  login, persistent banner, outbound email disabled, idempotent seed
  (`npm run db:seed:demo`), nightly reset workflow, separate Neon database and
  Vercel project.

## Public vs private links

- **`gas.portamoneta.org` is private.** Login is whitelisted and the data is
  real. Share it only with cooperative members. Never use it for screenshots,
  demos, or public links.
- **`wegrocery-demo.vercel.app` is the public showcase.** Use it in the
  README, in any demo, and for all screenshots/GIFs (the `docs/demo.gif`
  walkthrough was recorded here).
