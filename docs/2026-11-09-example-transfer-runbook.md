# Example instance: recovery-first Vercel resource transfer runbook

Status: prepared for review on 2026-11-09, not executed. The maintainer authorized preparation of this runbook. Creating copies/branches/snapshots, installing integrations, disconnecting resources, transferring ownership, changing secrets/configuration and deploying require the separately identified approvals below. This is the example-only implementation detail of [the WP0 options plan](./2026-11-09-neon-vercel-isolation-plan.md), not approval to move the Console or a customer instance.

## Scope and current evidence

- One existing fake-data example app, its one Neon database resource and their current linkage. Record exact IDs in the private inventory immediately before execution; reject a different project, branch, resource or environment.
- Maintainer screenshots show two distinct installed Neon resources labeled Free. The example resource's consumer menu shows the example app on All Environments. Its resource Settings page exposes Transfer Database, disabled with a requirement to disconnect connected projects first. This proves the UI entry point exists, not destination eligibility or successful transfer.
- Neon metadata says the example database runs PostgreSQL 18 in Frankfurt, with one main branch and six hours of instant history; no snapshots were listed at the observation time. Matching local pg_dump 18.6 is available. Recheck versions/tool compatibility before running a dump.
- No separate recoverable example export or tested restore has been verified. The customer's nightly backup is not evidence of example recovery.
- Current target team has no Neon installation in the metadata collected. Do not press Install simply to satisfy the transfer prerequisite: inspect the exact setup, resource and billing requirements first.
- Example and Console resource names are distinct, but an integration-scoped plan can affect more than one resource. Never change a whole installation's plan, disconnect all resources or transfer the entire installation as a shortcut.

## Approval and action boundaries

| Gate | Exact scope | Does not authorize |
|---|---|---|
| R0: preparation | This document and private inventory | Any resource or data change |
| R1: recovery rehearsal | Approved encrypted backup of the example main database; one bounded isolated PostgreSQL 18 restore target; read-only validation and test-only probes on that target if specified | Resource disconnection, source writes, source restore, transfer, paid provisioning or deployment |
| R2: configuration readiness | Approved secure credential executor, destination installation arrangement and exact recovery route | Reading secrets in chat/tool output, rotating credentials, unlinking source, unreviewed paid terms |
| T1: example cutover | Exact selected database resource plus exact example Vercel project, approved source/target teams, maintenance window and secure reconnection | Console/customer resources, whole-installation transfer, schema upgrade or deployment of new application code |
| C1: cleanup | Separately approved named temporary resources/files after validation and retention decision | Deleting originals or snapshots automatically |

Each gate needs the maintainer's explicit approval of its concrete scope. Generic permission to prepare a plan is not permission to execute R1 or T1. Existing main/staging freeze remains in force until the post-transfer reconnection gate is explicitly cleared. No merge or push to those branches is needed for this rehearsal.

## Required recovery mechanism before disconnection

Preferred: a portable PostgreSQL archive encrypted outside the Neon/Vercel resource being moved, with a successful restore into an independently controlled isolated target. A copy in the same managed project alone does not establish recovery from lost organization/integration access. A Vercel deployment rollback cannot reverse database ownership.

Credential constraint: agents do not read `.env*`, connection strings or secrets. No call to a connection-string-returning tool is part of this runbook. Full export/restore is therefore blocked until the maintainer approves and provides an execution channel that consumes credentials without returning their values to the agent.

Supported executor choices to review, not provision now:

- A local maintainer-controlled runner using a pre-existing secure secret store/reference or non-echo interactive entry on the maintainer's terminal; never via chat, command arguments, shell history or a committed file. The agent can prepare/review code, while the maintainer enters or supplies secrets and runs the credential-bearing step.
- A separately reviewed protected backup workflow with credentials set by the maintainer in a protected environment, trusted source only, no raw dumps/artifacts in public Actions and only bounded technical outcome logs. This does not exist for the example yet; creating it is separate code/access work, not an assumed prerequisite already met.

Do not select an alternative credential source when an access check fails. Do not pull Vercel env files, expose existing integration-managed values, reuse customer/CI keys or broaden tokens. Stop and ask the maintainer.

Optional Neon snapshot: a same-project supplement, not the independent backup. The [Neon backup guide](https://neon.com/docs/guides/backup-restore) describes manual snapshot quotas and snapshot billing; verify actual Free/Marketplace eligibility and any charge before approval. Never replace an existing snapshot to make room without separate consent. Never finalize a restore onto the source branch or move its computes during a rehearsal.

## R1: isolated backup and restore rehearsal

Before execution, record target, mode and validations privately:

| Item | Required value |
|---|---|
| Source | Exact example project ID, main branch ID and database name; fake-data classification confirmed |
| Source mode | Read/export only; no DDL, migrations, auth changes, ledger maintenance or cleanup |
| Backup | Custom-format archive, encrypted at rest outside the transferred resource; private storage with agreed retention |
| Target | One uniquely named, empty PostgreSQL 18 target in Frankfurt, without a connected app, cron, webhook, email or payment integration |
| Target mode | Restore only into that approved empty database; never overwrite source or an unrelated database |
| Budget | Confirm available project/branch/storage/compute quotas and any charges; no automatic upgrade |
| Validations | Complete schema/migration-ledger/constraint/sequence checks, scoped counts, exact money-invariant counts and runtime role checks |

Steps after R1 approval:

1. Recheck source/target identity, environment and PostgreSQL major version. Confirm all source data is disposable example data before permitting aggregate data validation. If that classification is uncertain, stop and let the maintainer validate privately.
2. Freeze example writers for the final recovery baseline: user edits, callbacks, cron and external writers. Record the last consistent point and how the freeze is enforced. Do not rely on inactivity alone; the snapshot/export may otherwise differ from later counts. Do not alter the Console, customer apps or their databases.
3. The protected executor obtains a transaction-consistent full database archive using PostgreSQL 18 tooling and a direct/unpooled connection, following the [Neon dump/restore reference](https://neon.com/docs/import/migrate-from-postgres). Keep credentials out of arguments/logs and fail on any dump or encryption error. Encrypt the archive before persisting it; no plaintext dump in the repository, public artifact storage or shared temp directory.
4. Record only archive checksum, encrypted artifact reference, source identity, consistency point, schema version and technical exit status in the private record. Do not publish object contents, role passwords, auth tokens or personally identifying rows. An archive checksum proves file identity, not correct database recovery.
5. Restore through the protected executor into the explicitly approved empty target. Preserve schema/data/functions/triggers/sequences and `_migrations`; verify ownership/grants separately. `pg_dump` does not transfer global roles by itself. Do not upgrade Postgres, run new app migrations, disable append-only protection, or set ledger-maintenance bypass on the source.
6. Compare schema objects, constraints/indexes, trigger definitions/enabled state, sequence positions and migration ledger between the consistent source baseline and target. Compare table counts privately only after fake-data classification is confirmed. Validate nullable/critical fields only as aggregate checks, with no row contents printed. Matching counts alone do not pass the gate.
7. Execute the existing `INVARIANT_CHECKS` SQL unchanged against the target, reporting check names and violation counts only. The existing CLI can print violating IDs, so do not use its unfiltered output as the safe logging contract. A count-only rehearsal runner must be prepared and reviewed before use; do not change the nightly production runner in this work.
8. Validate the target runtime role against the documented source privilege matrix, including the example's existing owner-role deviation; do not silently change that policy as part of transfer preparation. Any write-based probe must be separately enumerated, run only on the temporary target and roll back completely. Do not run the full integration suite against source or the restored copy as a substitute for validation: migration/concurrency tests can change schema/data.
9. Record every outcome as pass/fail/blocked. If any check fails, leave the source authoritative, retain the encrypted recovery artifact and stop. Do not retry by disabling a check or silently repairing production-like data.
10. Resume source example writes after the rehearsal if transfer will not follow immediately. A later cutover requires a fresh freeze and final baseline/export or explicit proof of no intervening writes. A stale recovery artifact does not pass T1.

R1 completion means recovery was demonstrated on the chosen isolated target, not that a transfer is approved. If the temporary target fails or consumes quota unexpectedly, stop; no automatic resizing, extra database or deletion of another resource.

## R2: reconnection and destination readiness

Complete this checklist before asking for T1 approval:

- Exact resource ID -> Neon project ID -> allowed Vercel consumer/environment mapping, verified from provider metadata/UI. Expected only the example app; more consumers require a revised plan.
- Source and destination team identity/Owner permissions, GitHub App access and expected `flylabs-ai` repository/commit, current domain and allowed deployment branches.
- Destination's single-resource-transfer prerequisites, exact Free plan eligibility and whether installing the integration would also create a database or add charges. If the UI requires whole-installation transfer or impacts Console, stop. Do not satisfy prerequisites by uninstalling another integration.
- Private list of environment variable names/targets, integration-owned names, root directory, build/migration-on-build behavior, region, protection, cron and hook names. No hook URLs, values or connection strings in the record.
- Secure preservation of the existing auth/encryption material and non-database configuration by the maintainer. Record success only, not values. Regenerating AUTH_SECRET can invalidate sessions and sealed app credentials; do not rotate it during this move.
- Explicit plan for integration-owned variables removed on disconnect: reconnect the intended resource to the intended environments, compare names/targets and check behavior. Preserve least-privilege/runtime and migration connection distinctions as currently configured; fixing the example's existing owner-role deviation is separate work.
- Reliable validation despite the known Deploy Health redirect issue: resolve the workflow separately or approve a concrete equivalent endpoint/check path. HTTP 302 or HTTP 200 with the wrong app/version is a failure, not success.
- Recovery after an irreversible resource transfer: a maintainer-approved alternative home for the exported database and secure app reconnection with downtime budget. Do not claim Transfer Back exists or that the old deployment alone is sufficient. This route must be achievable with the retained artifact, roles and keys.

If any required variable/credential cannot be recovered through the approved secure path, do not disconnect. Do not assume the already-built deployment's old variables are a sufficient recovery plan.

## T1: resource and application move, maintainer only

This phase is documentation until separately approved, after R1 and R2 pass.

1. Reconfirm no changes to scope/price/provider prerequisites, obtain the final backup baseline under an example-only writer freeze and agree the maintenance window.
2. Maintainer disconnects only the example app from only the example resource. Verify no Console or customer connection was altered. Stop on any broader impact.
3. Maintainer uses the supported single-resource Transfer Database flow to the approved Pro team and records the outcome. Vercel documents this resource flow as irreversible. Do not switch to Transfer Integration or create another database if it is blocked.
4. Maintainer transfers the exact example Vercel project through the separately reviewed project transfer flow, unless the actual provider-assisted flow already moved that same project. Do not duplicate, delete or transfer it twice. If the actual sequence differs from the approved procedure, stop before confirming it.
5. Reconnect the existing intended database resource and environment targets in the destination. Validate private resource IDs and configuration identity/continuity; do not infer continuity from names alone. Do not expose secrets or change schema.
6. Deploy the approved existing commit from GitHub, without an empty commit or unrelated application change. Keep writers frozen until health, correct brand/version, auth and recovery checks pass; then designate exactly one authoritative app/database path before enabling writers.
7. Validate the public health contract and database reachability, expected schema/migrations, permissions, sign-in and email safety. No real payment. Record runtime error aggregates without personal data or raw queries. Keep failed checks visible.
8. Review an actual backup/recovery cycle for the destination and resource usage/plan. Do not proceed to Console or customer hosting until the example trial has passed its agreed observation gate.

## Stop/recovery decisions

| Failure point | Required response |
|---|---|
| Before disconnect | Stop; source remains authoritative, no transfer |
| After disconnect but before transfer | Maintainer reconnects the same resource to the same source app/env targets using the preserved secure setup, redeploys if required and revalidates; no secret rotation |
| After resource transfer, no new writes | Freeze remains; use the preapproved reconnection/independent restore route. No assumed transfer-back or automatic overwrite |
| After new writes | Stop writers and reconcile before any restore/switch-back; never discard accepted writes silently |
| Unknown resource identity, price, secret continuity or extra consumer | Stop before the next confirmation; revise the plan with the maintainer |

Restoring a source branch in place, finalizing a snapshot onto its compute, deletion/decommissioning, integration removal and any paid action require their own approval. Temporary target/artifact retention is explicit; cleanup never runs automatically on unrelated resources.

## Completion evidence and current decision

For each executed phase, record target IDs, approved scope, mode, timestamps, checks and remaining limitations privately; publish only a non-sensitive status summary in `docs/status.md`. Updates to the vault carry `updated:`; no vault Git commit.

Preparation is complete when this runbook has been reviewed, the exact R1 executor and fake-data target/budget are specified, and its approval is obtained. Those executor/target approvals are still pending. No backup, restore or transfer has been executed by preparing the document.

Suggested next step: approve preparation of the bounded R1 credential-safe runner and target specification, then review the concrete execution request before any copy is made. A provider-only snapshot may supplement this, but must not be presented as an independent portable backup.
