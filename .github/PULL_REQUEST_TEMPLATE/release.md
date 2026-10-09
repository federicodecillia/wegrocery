<!-- Release PR: staging -> main. Open it with ?template=release.md -->

Promotes staging to production: <!-- the PRs included, one line each -->

## Upgrade notes
<!-- Copy these into the CHANGELOG entry: they are for anyone running their own instance. -->
- Migration: <!-- file name, or "none" -->
- New environment variables: <!-- name and whether optional, or "none" -->
- Stripe webhook events to add: <!-- or "none"; the full list is REQUIRED_STRIPE_EVENTS -->

## Before the merge
- [ ] CI green on staging, integration tests included
- [ ] Staging checked by hand (what was tried: )
- [ ] Demo: migration applied and the app opened (it runs with every optional integration off)
- [ ] Production backup from the last night is green
- [ ] Migration applied to production **before** the merge (Drizzle inserts name every column)
- [ ] Stripe events added to the live endpoint, if any
- [ ] Not a Saturday or a Sunday

## The merge
- [ ] Merge commit (not squash), then fast-forward `staging` to `main`

## After the deploy
- [ ] `/api/health` answers `ok: true` with the new version, on production and on the demo
- [ ] Smoke test: login page, Home, Order
- [ ] Runtime logs (and Sentry, if on): no new errors
- [ ] GitHub release published by the `GitHub Release` workflow (tag `vX.Y.Z`, notes from the CHANGELOG)

## Rollback
<!-- How to go back: "Promote the previous deployment in Vercel" when there is no migration;
     otherwise say whether the migration is safe to leave in place (additive) or how to undo it. -->
