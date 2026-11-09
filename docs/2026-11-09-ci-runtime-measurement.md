# CI runtime measurement, 2026-11-09

Status: measurement completed; optimization implementation is not approved. This report changes documentation only. No workflow reruns, database branches, runtime code, queries, assertions, retries, timeouts, permissions or concurrency settings were changed to collect these observations.

## Scope and method

Read existing GitHub Actions metadata and integration job logs for the five completed successful CI runs below. They are all attempt 1, from the same day and repository workflow. Compare the workflow/configuration, test sources and fixtures between their heads. Differences are documentation, changelog and the root package version (including only the version fields in the lockfile), not dependency versions, integration code or workflow behavior. Logs confirm identical executed file names and per-file test counts.

These are matched historical observations, not a randomized benchmark or five repeats at one exact commit. Infrastructure load, cache availability and concurrent runs are uncontrolled. Do not interpret differences as the effect of a code change.

Elapsed CI means workflow creation to the last completed job in `ci.yml`, not the run metadata's later update timestamp. It includes initial scheduling and job overhead, but excludes separate workflows such as Console CI, Deploy Health and Vercel builds. Runner time is the sum of the two jobs' start-to-completion durations, not billed minutes. Branch creation-to-cleanup is a job-timestamp proxy, not provider-measured lifetime.

Only technical durations, file names, counts and outcomes are retained here. No environment values, connection strings, query results, member data or raw logs are included.

## Run measurements

| Run | CI elapsed | Integration job | Main suite | Install in integration job | Both jobs, runner seconds |
|---|---:|---:|---:|---:|---:|
| [42615890049](https://github.com/federicodecillia/wegrocery/actions/runs/42615890049) | 10m41s | 10m37s | 561.48s | 17s | 702s |
| [42618829200](https://github.com/federicodecillia/wegrocery/actions/runs/42618829200) | 10m53s | 10m50s | 575.35s | 15s | 705s |
| [42619194534](https://github.com/federicodecillia/wegrocery/actions/runs/42619194534) | 8m18s | 7m58s | 418.06s | 15s | 527s |
| [42620578960](https://github.com/federicodecillia/wegrocery/actions/runs/42620578960) | 7m57s | 7m54s | 404.86s | 32s | 568s |
| [42622558616](https://github.com/federicodecillia/wegrocery/actions/runs/42622558616) | 10m10s | 10m6s | 513.34s | 44s | 685s |

- Median CI elapsed: **610s (10m10s)**; observed range **477-653s**. The slowest is about 37% longer than the fastest, without an optimization.
- Median integration job: **606s**; median main suite: **513.34s**, about 85% of the median integration duration. This ratio compares medians, not a pooled attribution model.
- Disposable-branch creation-start to cleanup-end window: **436-620s**, median **554s**, from job timestamps. Actual provider creation/deletion instants and cost were not measured.
- Initial scheduling delay: **3-20s**, median **3s**. It is not the dominant cost in this sample.
- Integration dependency installation: **15-44s**, median **17s**. Three logs show exact npm cache hits; the two other logs did not yield the same exact-hit marker, so they are not classified as confirmed cold-cache runs.
- Fresh-database creation, restricted-role creation, complete migration, first-day tests and final money invariants: **23-32s** across these runs. Those checks are preserved, not proposed for removal.
- The normal check job finishes far earlier than integration in every run. Speeding lint or unit tests alone would not shorten this CI's critical path materially.

## Coverage and unsuccessful runs

Every successful run reports:

- main pass: **45 files passed, 1 skipped; 208 tests passed, 7 skipped**;
- dedicated fresh-install pass: **1 file passed, 7 tests passed**;
- final fresh-install money-invariant step: successful;
- branch cleanup step: successful.

The seven skips are existing, intentional first-day tests in `test/int/fresh-install.integration.test.ts`. They require `INT_TEST_FRESH=1` and an empty database; the workflow runs all seven later with the restricted-role flag. They must not be mistaken for lost coverage or silently increased.

The intervening run [42618608147](https://github.com/federicodecillia/wegrocery/actions/runs/42618608147) was cancelled when its PR was updated. It is excluded from successful-runtime statistics and not counted as a pass. Its integration cleanup step succeeded. This is one observed cancellation, not proof that every cancellation/failure path is covered. No deliberate failure was introduced for this measurement.

## Slowest files

Median file durations across the five successful runs:

| File | Tests | Median |
|---|---:|---:|
| `lib/auth/config.integration.test.ts` | 21 | 69.91s |
| `lib/payments/wallet-in-card.integration.test.ts` | 7 | 40.77s |
| `lib/members/merge-store.integration.test.ts` | 6 | 37.11s |
| `lib/payments/order-credit.integration.test.ts` | 7 | 36.69s |
| `lib/invariants.integration.test.ts` | 7 | 34.18s |
| `lib/payments/refund-store.integration.test.ts` | 10 | 23.62s |
| `test/int/stock.integration.test.ts` | 10 | 21.47s |
| `lib/cycle-close-store.integration.test.ts` | 10 | 17.16s |

The same files remain slow across runs, and several speed up or slow down together. This is consistent with shared database/runner/network variation; it does **not** identify which service is responsible. Existing logs do not isolate server execution, network latency, application work or per-query round trips. No causal claim about Neon latency is justified yet.

## Static findings, not measured savings

The invariant helpers in three files iterate over all 19 `INVARIANT_CHECKS` sequentially. Source shows 7 helper calls in the invariant file, 6 in wallet-in-card and 6 in merge-store: **361 invariant query executions per complete main-suite run**, assuming those straight-line call sites execute once. This count is from source, not request instrumentation; fixture/cleanup/business queries are additional.

The combined median durations of these three entire files are about **112s**, roughly 22% of the median suite duration. Only part of that is the repeated invariant reads. This is a candidate for investigation, not a savings estimate; a 20% end-to-end reduction from batching is not established.

`lib/auth/config.integration.test.ts` validates sign-in, replay protection, rate limits and admission. No explicit `sleep` or `setTimeout` was found in that file; this does not exclude timing behavior inside called libraries. Never shorten security windows or remove real auth/database checks based on this file's runtime.

`fileParallelism: false` is intentional: schema-changing files and singleton settings share one test database. Simply enabling parallel execution can change behavior. Changing batch/transaction boundaries can also change snapshots, error propagation and observation of intermediate states.

## Safety decision and next gate

**Keep the current delivery implementation unchanged.** Measurement alone does not demonstrate a safe optimization. Permission to measure is not permission to batch queries, alter fixtures or change workflow filtering.

A future proposal must identify the exact semantics it preserves, prove result equivalence including deliberate violations and query failure, preserve all test identities and the dedicated first-day checks, and validate isolation and cleanup on disposable fake-data infrastructure. The acceptance criterion is unchanged delivery guarantees first; time savings are secondary. If those guarantees cannot be demonstrated, do not make the change. This report does not claim a code change can be proven risk-free from timing data.

No request is made here for broader credentials, production access, new infrastructure or a live experiment. Further profiling/experiments that change code or provisioning need a separate reviewed scope and maintainer approval.

## Primary references

- [GitHub dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching) and [setup-node caching design](https://github.com/actions/setup-node/blob/main/docs/adrs/0000-caching-dependencies.md): lockfile hashing and cache boundaries; cache configuration should not be weakened to make a benchmark faster.
- [Neon serverless driver configuration](https://github.com/neondatabase/serverless/blob/main/CONFIG.md): transaction and isolation options; batching must not be treated as automatically semantically equivalent.

The measurements above come from this repository's run metadata/logs, not from those reference documents.
