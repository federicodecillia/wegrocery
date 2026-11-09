# CI runtime optimization implementation plan

Status: measurement only approved on 2026-11-09 and completed using existing run records; see [the measurement report](./2026-11-09-ci-runtime-measurement.md). No optimization implementation is approved. Delivery quality, security and stability take precedence over elapsed time. Separate from release 1.45.1 and WP0 transfers.

**Goal:** reduce pull-request wall-clock time without losing assertions, isolation, failure visibility or money checks.

**Architecture:** measure first, reduce redundant HTTP round trips in test helpers, then consider independent Neon databases for parallel jobs. Keep application code, production jobs and monetary rules unchanged.

**Tech stack:** GitHub Actions, Vitest, Neon HTTP driver, Drizzle, existing disposable test databases.

## Baseline and diagnosis

Source: [CI run 42615890049](https://github.com/federicodecillia/wegrocery/actions/runs/42615890049), integration job 129155530869, PR #401.

| Item | Duration |
|---|---|
| Integration job | 10m37s |
| Integration suite, 208 tests in 45 files | 561.48s |
| Dependency installation | 17s |
| Disposable Neon branch creation | 9s |
| Empty-install migration/tests/invariants | about 32s |
| Auth test file | 74.65s |
| Wallet-in-card test file | 44.10s |
| Member merge test file | 41.57s |
| Order-credit test file | 40.75s |
| Invariants test file | 37.36s |

The dominant cost is database-backed tests. This is a single observation, not a stable performance estimate. `vitest.int.config.ts` intentionally sets `fileParallelism: false`: files share schema and singleton settings. Turning it on without isolation can produce false failures or false passes.

Measure end-to-end elapsed time from workflow creation to its last required check, including queue time. Also measure total runner seconds and Neon branch lifetime: reducing latency by spending more resources is a trade-off, not a free improvement.

## Non-negotiable acceptance conditions

- Same test identities, assertions and deliberate violation cases as the baseline; no newly skipped tests, weakened checks, retries hiding failures or extended timeouts to disguise regressions.
- Money invariants, ledger append-only protection, rollback tests, fresh installation and restricted app role checks remain required and fail closed.
- Use disposable fake-data CI databases only. Never query production or staging member data. Never log secrets, connection strings or fixture contents.
- Keep secret-bearing jobs on trusted events. Do not introduce `pull_request_target`, broader tokens or public artifacts with database data.
- Preserve failed-test exit status and cleanup failures; delete only the disposable branches created by the current run. Cancellation must not silently leak branches.
- No changes to nightly production backup, restore or invariant execution.
- Root and Console checks stay separate: root TypeScript/ESLint/Vitest intentionally exclude `console/`.

## Task 1: establish a repeatable baseline

Files to inspect: `.github/workflows/ci.yml`, the Console CI workflow, `vitest.int.config.ts`, `test/int/setup.ts`, `test/int/fixtures.ts` and the slow test files above.

1. Collect the last five comparable successful runs at the same test inventory, separating cold/warm dependencies, queue time and Neon provisioning from tests. Record failed or cancelled runs separately rather than discarding them.
2. Record per-file and per-test timings with Vitest's existing report output. If a machine-readable report is needed, retain only names, counts, durations and outcomes. Never upload raw query errors, environment or test data.
3. Count invariant helper calls and database requests in the slow files by reading source or counting requests without recording payloads. Determine whether auth latency comes from database operations or intentional rate-limit/timing tests. Never shorten security windows just to improve a benchmark.
4. Record baseline test identifiers and counts for later set comparison. Establish median and slowest observed end-to-end time, runner seconds and branch lifetime.

Validation: no code path or test behavior changes; baseline document contains only aggregate technical metrics.

## Task 2: Quick hypothesis, reduce test-helper round trips (not approved)

Files:
- Create `test/int/invariant-checks.ts` only if a shared helper makes the three callers simpler.
- Modify `lib/invariants.integration.test.ts`, `lib/payments/wallet-in-card.integration.test.ts`, `lib/members/merge-store.integration.test.ts`.
- Inspect `test/int/fixtures.ts` for independent setup operations; change it only when the measured contribution justifies it.

1. Establish the current result contract for all `INVARIANT_CHECKS`: named result sets, deterministic mapping, scoped fake-row ids and original failure visibility.
2. Prototype one HTTP batch of read-only invariant queries using the installed driver's supported batch/transaction API. Read its installed types/docs before choosing the API. Preserve each original query unchanged and map its result back to the same check name.
3. Compare old and proposed helpers against the same consistent fixtures and every deliberately broken fixture, at the same database state. Assert identical normalized results and that a failed query fails the test. Remove the temporary comparison helper after equivalence is proved.
4. Replace only redundant sequential reads. Keep business-operation concurrency tests, operation ordering and transaction boundaries intact. Do not parallelize dependent fixture writes or schema changes.
5. If fixture setup/cleanup is batched, keep `SET LOCAL wegrocery.ledger_maintenance` and dependent cleanup statements in their own existing transaction. Do not grant a persistent maintenance bypass or weaken the ledger trigger.
6. Re-run all root checks, the complete integration suite and fresh-install checks on disposable CI databases. Record results against the baseline.

Important: batching can alter snapshot/transaction semantics. Use it only for helper reads after writes have completed, not for observing intermediate states during a concurrency test. Do not replace the production invariant runner as part of this work.

No speed promise before measurement. Adopt only if correctness is identical and repeated measurements show lower end-to-end time without worse failures or resource usage.

## Task 3: Robust option, isolated integration shards (only if Quick is insufficient)

Files: `.github/workflows/ci.yml`, `vitest.int.config.ts` if needed, and a small pure partition helper with unit tests if built-in Vitest sharding cannot provide verified coverage.

1. Start with two shards, each with its own run-scoped disposable Neon branch and connection string, never one shared database. Verify the installed Vitest sharding interface before use.
2. Keep files serial inside each shard. Balance by measured file durations and prove every expected test file belongs to exactly one shard; reject missing, duplicate or empty shards.
3. Keep schema-mutating suites and global-setting assumptions isolated. Run full migrations before each shard. Preserve the test-only email/Stripe disabling setup.
4. Keep the empty-install/restricted-role/migration/invariant sequence intact as a separate required job with its own disposable database.
5. Add a stable required aggregate check with `if: always()` that succeeds only when every expected shard and fresh-install job succeeded. Skipped, cancelled or missing jobs must not count as success.
6. Preserve unconditional cleanup for each run-owned branch. Exercise forced test failure and cancellation on disposable runs to verify cleanup and failure propagation. Do not cancel unrelated runs.
7. Compare two-shard wall-clock time, total runner seconds and branch lifetime with Quick. Add a third shard only if measurement justifies its cost and Neon capacity.

Trade-offs: lower elapsed time at the cost of repeated installation/provisioning, more simultaneous Neon resources and more workflow maintenance. Rollback is a normal PR restoring the serial job; no data migration.

## Task 4: optional scope classification, separate approval

Not the first optimization. Consider only after measurement and branch-protection review.

- A strict documentation-only allowlist may avoid integration provisioning while still completing a stable required check. Unknown paths trigger the full suite.
- Changes to workflows, dependency files, SQL, tests/configuration, runtime code or Console defaults are not documentation-only. PR #401 would not qualify.
- Do not use a workflow-level `paths-ignore` that leaves required checks pending. Classify inside the workflow with least-privilege, fork-safe inputs.
- Unit-test the classifier for documentation, mixed paths, renames/deletions and unexpected files. Always run the complete integration/fresh-install suite on release promotions and runtime changes.
- An explicit approved skip is reported as such; missing secrets or an unexpected skipped integration job must never look like tested coverage.

## Verification and delivery gates

1. One focused implementation PR per optimization to `staging`; do not combine Quick, sharding and path filtering in one PR.
2. Required local checks: `npx tsc --noEmit`, `npm run lint`, `npm test`. Run Console checks if its code or workflow changes. Database tests run through the existing trusted CI with disposable fake-data branches.
3. Compare at least three matched before/after runs. Avoid repeated provisioning if logs already prove no benefit; include queue variability and cost in the conclusion.
4. Suggested target, not a promise: at least 20% lower median total CI elapsed time, no lost test identities, no new failures/skips and no material regression in the slowest observed run. If Quick helps but misses this target, report its measured value before proposing shards.
5. Validate failure behavior as well as success: deliberate invariant violation is detected, a failing shard fails the aggregate, and cleanup still runs. Never create violations on production or staging.
6. Summarize metrics and any trade-off in the PR; update `docs/status.md` and the private backlog. Technical changelog EN/IT when an implementation ships. No application UI copy or migration is expected.

## Decision requested

Task 1 measurement is approved and its retrospective report is complete. No mutation experiment, batching, fixture change, sharding or filtering is approved. The next possible task is a separately approved equivalence/safety investigation on disposable fake-data infrastructure. Do not infer approval to implement Quick from approval to measure. If equivalent guarantees cannot be demonstrated, keep the existing serial suite even if it stays slower. The current release and repository transfers do not depend on implementing CI optimization.
