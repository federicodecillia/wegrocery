<!-- Development PRs target `staging`. Releases use ?template=release.md. -->

## What changes

<!-- What a member or an admin will see, in plain words. Link the issue: Closes #123 -->

## How it was tested

<!-- Tests added or run, what you checked by hand. Screenshots for UI changes (phone and desktop). -->

## Checklist

- [ ] Targets `staging`, one focused change
- [ ] `npx tsc --noEmit && npm run lint && npm test` pass locally
- [ ] No secrets, connection strings or real people's data in code, tests, screenshots or this description
- [ ] Nothing specific to one group in the code (env, database settings or brand JSON instead)
- [ ] Money: ledger rows are never updated or deleted; a new money rule has an invariant check
- [ ] Migration, if any: new `drizzle/NNNN_*.sql`, idempotent, listed in `lib/migrations.ts`
- [ ] New environment variable, if any: `.env.example`, `lib/config-status.ts`, `docs/upgrading.md`
- [ ] User-visible change: entry in `CHANGELOG.md` (and `CHANGELOG.it.md`, or say below that it needs translating)
- [ ] UI strings in `lib/i18n/`, colours from brand tokens
