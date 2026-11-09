# WP0: Neon ownership, isolation and Vercel transfer options

Status: planning and Phase 0 read-only inventory approved on 2026-11-09; inventory is in progress. The maintainer is open to both options. No resource transfer, database migration, organization creation, billing change, credential change or production operation is authorized by this document. This supplements WP0 part B and withdraws its old assumption that every database should move into one normal Neon organization.

## Goal and boundaries

Move hosting to the intended Pro team while preserving data, authentication, delivery reliability, backup/recovery and a clear separation between customer instances, the operator Console and fake-data environments. Prefer Free where it meets measured capacity and recovery requirements. Do not trade reliability for a Free label.

GitHub repository transfers have been verified separately: the public upstream and private example repository are under `flylabs-ai`. The maintainer confirmed organization 2FA, ownership and the Vercel/Claude/Codex apps' all-repository access. GitHub post-transfer security/workflow checks and Vercel Git reconnection are not implied complete. Keep the `main`/`staging` merge/push freeze until the existing reconnection gate is cleared. This plan can be reviewed in a draft PR; it must not be merged during that freeze.

## Proposed isolation model, independent of transfer method

| Boundary | Data classification | Required separation |
|---|---|---|
| Customer instances | Personal/financial data; production copies in staging are equally sensitive | One Neon project and app credentials per instance; no shared database or schema with the Console/demo |
| Operator Console | Operator contacts, registry and sealed per-instance stats secrets | Its own project, database, app role and recovery procedure; never store customer database passwords there |
| Demo, example and CI | Fake data only | Independent projects/credentials; no access to customer data, dumps or production secrets |
| Restore testing | Potentially contains a full production dump | Treat as sensitive; isolated disposable restore target with scoped access, never a fake-data sandbox |
| Other products | Outside this change | Do not move or merge unrelated projects or organizations |

Separate projects give database/compute/credential boundaries. Separate organizations can additionally separate membership, administration and provisioning access, but do not protect against a shared owner or overly broad provider token. Verify the actual plan's permission capabilities; do not assume fine-grained roles exist on Free. Organization count is not a proxy for security or multiplied free allowances.

Production customer database placement stays unchanged in this WP0 amendment. If the maintainer chooses distinct customer, control-plane and sandbox organizations, define their membership and scoped keys explicitly; any additional move is a separate approved operation. Restore targets follow the customer-data security boundary even when ephemeral.

## Option comparison

| | A: Quick, preserve Vercel-managed Neon | B: Robust, independently managed Neon targets |
|---|---|---|
| Operation | Use a supported resource/project transfer workflow between Vercel teams | Copy one database into a new independently managed Neon project and cut over deliberately |
| Data path | Intended to preserve the existing resource; verify actual provider behavior | New database and endpoint; validate the restored data and database protections |
| Isolation | Separate Console/example projects; may remain in one Vercel-managed organization | Enables separate control-plane and fake-data organizations with independent access |
| Coupling | Billing/lifecycle remain tied to Vercel integration | Database ownership and recovery decoupled from Vercel |
| Work and changes | Fewer data changes, but transfer/reconnection and billing still need verification | More steps: dump/restore, roles, configuration, write freeze and recovery |
| Cost evidence | Verify the exact Marketplace plan, installation/resource quotas and target eligibility | Verify direct Neon quotas and measured usage for each project/account |
| Main limitation | Resource transfer is documented as irreversible; no assumed transfer-back rollback | Late writes and incorrect secrets/roles can break consistency; no naive endpoint switch-back |

These are alternatives to evaluate, not claims that either is risk-free. A staged choice is allowed: for example trial A on the fake-data example, while reserving the Console's stronger organizational separation for a separately approved B migration. No forced consolidation.

## Provider constraints verified on 2026-11-09

1. [Neon Vercel-managed integration](https://neon.com/docs/guides/vercel-managed-integration): ordinary Neon organization transfer does not support managed organizations. Its guide describes linked Neon movement with a Vercel team transfer. Confirm applicability to the actual installation; do not assume every generic integration moves automatically.
2. [Vercel project transfer](https://vercel.com/docs/projects/transferring-projects): project transfer and integration transfer are distinct; inspect the actual dependencies and reconnection requirements.
3. [Vercel resource transfer](https://vercel.com/docs/integrations/install-an-integration/product-integration#transfer-a-resource-to-another-team): a single-resource flow requires the matching integration at the destination and disconnection of its project connections; it is documented as irreversible.
4. [Vercel whole-installation transfer](https://vercel.com/docs/integrations/install-an-integration/transferring-an-integration): different prerequisites include no existing target installation and no connected source projects. Disconnecting removes integration-managed variables from project configuration. Do not mix these prerequisites or move the whole installation as a shortcut.

If one installation contains both Console and example, moving it can affect both. The trial must not disconnect, move or alter the Console as an incidental side effect. If the provider cannot isolate the example operation, stop and revise the method. Do not uninstall anything, accept paid terms or disconnect resources merely to explore the UI.

## Free-plan feasibility assessment

The [direct Neon pricing page](https://neon.com/pricing), checked on 2026-11-09, lists 100 projects, 100 CU-hours per project/month, 1 GB per project, 10 branches per project, 5 GB monthly network transfer per project, and 20 GB aggregate storage. These are not verified Marketplace entitlements. Vercel Pro does not imply Neon is paid or free.

Free may suspend compute when monthly compute/network allowances are exhausted; capacity is therefore an availability gate, not only a billing question. Its short restore history must be evaluated alongside tested off-site backups, not substituted for them.

Before choosing:

- Inventory the exact plan and billing owner for every relevant project/installation. Record resource IDs, region, PostgreSQL version, connection topology and linked consumers; no secrets.
- Review per-project month-to-date and available full-month usage: all branches' compute, storage, network and maximum concurrent branch count. Include nightly reset, CI, backup, restore and planned cron activity. Do not query customer tables for this assessment.
- Dashboard organization totals and small database size alone cannot prove capacity. Record observation period, quota resets, missing history and seasonality; do not extrapolate one partial day into a guarantee.
- Propose review thresholds with headroom, e.g. investigate projected 70% utilization; thresholds and any alert implementation require approval. Never disable scale-to-zero, backups or checks to fit a budget.
- Do not create organizations to bypass quotas. Confirm how aggregate limits apply to the actual accounts. Any paid upgrade, spend limit or extra organization is a maintainer decision.

## Phase 0: read-only inventory and decision gate

Maintainer and agent, after explicit approval of this phase:

1. Confirm source/target Vercel teams, rights, GitHub App access and each current Git repository connection. Keep production frozen until reconnection is verified.
2. Inventory resource IDs and installation membership in both Vercel teams, target support/plan and whether a trial resource can move alone. Inspect metadata only; no disconnect, install, provisioning or transfer confirmation.
3. Record environment variable names, targets and integration ownership, domains, deploy hooks by name, protection, cron, region and build/deploy rules privately. Never retrieve or print sensitive values. The maintainer preserves secrets in the existing secure channel/password manager.
4. Verify backup/export and tested recovery availability for Console as well as customer apps. Existing customer backup does not prove Console recovery.
5. Resolve the known Deploy Health 302/Console contract problem with a separate reviewed fix or an explicitly approved equivalent validation path before using it as a migration success gate. Do not label failed runs green.
6. Compare A/B with observed entitlements, supported recovery and isolation needs. Present the exact trial, prerequisites, downtime and reversal limitations for approval. No transfer starts in Phase 0.

Deliverable: private inventory and an option decision table with known/unknown facts; no customer details in the public PR. If access is missing, stop and ask the maintainer, not for secrets or alternative credentials.

## Phase A: conditional Vercel-managed trial

Only after the maintainer approves the exact resource and method:

1. Trial the fake-data example only, at the same app version. No database schema upgrade, credential rotation, business change or CI optimization in the same window.
2. Obtain a recoverable export and verify recovery in an approved temporary target before any irreversible action. Confirm dump compatibility and the provider's resource/dependency scope. A Vercel deployment rollback alone cannot reverse database ownership or a missing integration connection.
3. Before disconnection, record the exact resource/project mapping, secure credential recovery arrangements and how the maintainer will restore removed configuration. Do not rely solely on an existing deployment keeping its built-in variables.
4. Maintainer performs only the chosen supported flow; any new plan, terms, payment, extra resource or wider scope stops for review. Verify resource identity, organization, database endpoint continuity, roles and allowed environments afterward without displaying credentials.
5. Reconnect only the intended project to the resource, verify `flylabs-ai` Git source, deploy from that source, and validate health, sign-in and email in the appropriate safe environment. No real card payment.
6. Observe agreed checks and a backup/recovery cycle. Do not delete the source installation or old configuration as cleanup. Review results before proposing the Console or any customer transfer.

Recovery must be concrete before step 3: if transfer-back is not supported, describe an approved restore/reconnection route and downtime. Do not promise zero downtime or lossless rollback without proof.

## Phase B: conditional independent-database migration

Each database needs its own approved runbook. No customer production database is migrated by this plan.

1. Create the approved isolated target only after capacity and access decisions. Match region, PostgreSQL major version, extensions and collation; do not combine a version upgrade. Assign separate runtime and migration roles with verified least privilege.
2. Use a compatible, supported [Neon dump/restore procedure](https://neon.com/docs/import/migrate-from-postgres) over direct, unpooled connections. Preserve schema, data, sequences and migration ledgers; review ownership/grants separately. Do not apply app migrations as a substitute for copying data.
3. Encrypt dumps and control their access, location and retention outside the public repository. Never put connection strings in command arguments/logs or chat. The maintainer handles secrets. An agent must not inspect Console contacts or customer rows; sensitive validation is performed by the maintainer or approved protected automation.
4. For Console, pause intake, operator actions, cron/provisioning and any other writer during the final copy. Preserve `CONSOLE_ENCRYPTION_KEY` and session/auth keys securely: copying sealed registry values without their original key does not preserve usable access. No bulk secret rotation during migration.
5. Compare source/target schemas, counts, constraints, indexes, triggers, sequences and migration ledger before cutover. Validate append-only/money invariants for an app database and registry/decryption behavior for Console without exposing data. Validate runtime permissions. Row counts alone are insufficient.
6. The maintainer updates only the selected project's database configuration and environment targets; resolve integration variable ownership before redeploy. Rebuild from the approved Git source. Confirm health, sign-in, email safety, Console read-only probe behavior and protected operational actions on approved test targets.
7. Keep the old source retained and unavailable to new writes until validation finishes. No dual-write or automatic traffic flipping. If the target has accepted writes, stop for reconciliation before any switch back; it is not a safe rollback to silently discard those writes. Resume writers once there is one authoritative database and the acceptance gate passes.
8. Verify an independent backup and restore for the target before declaring completion. Decommissioning, deletion of dumps/sources and retention changes require a separate maintainer approval.

## Sequence and completion gates

- First decision: metadata-only inventory. Next decision: approve exact example trial. Next: review the results and choose a Console-specific boundary/method. Demo and customer hosting follow only afterward, as WP0 already requires; the real customer goes last with explicit operation approval and a fresh backup.
- Complete GitHub post-transfer ruleset/secret-name/workflow checks and reconnection separately; existence of the three apps is not proof that every protection or deployment connection survived.
- New organization/key/secret configuration, resource transfers, provisioning, production deploys and destructive cleanup remain Maintainer steps. No automatic action is authorized here.
- Planning validation: official source links checked, no contradiction with the managed-organization transfer limitation, per-resource scope and recovery made explicit, public docs free of customer data, `git diff --check`. No runtime test is needed for this planning-only PR.
- Execution validation must compare expected version/data/roles and real outcomes, not just HTTP 200. Record blocked checks honestly. No change to ledger behavior, invariant coverage or CI delivery guarantees.

## Phase 0 evidence so far

Read-only Vercel metadata confirms the current Hobby and intended Pro teams and Git links for all four application projects under the new organization. The source team has one Neon Marketplace installation; the target query returned no Neon installation. The catalog exposes an installation-scoped Free plan, not proof of the selected resource-level assignment.

The Neon connection is now available. Organization metadata confirms Free for the two relevant organizations and the separate unrelated organization. Five project records confirm the existing customer/demo/restore versus managed Console/example placement. Console and example use PostgreSQL 18; the other three projects use PostgreSQL 17, all in Frankfurt. Any copy must preserve the respective major version. No database query was executed.

Current-month compute and transfer counters and branch metadata were collected privately; they are partial-month observations, not a forecast. Project storage counters returned zeros and are not used as evidence of zero storage. Branch logical sizes are distinct from billed physical storage and cannot simply be summed. Free's detailed consumption-history API requires a paid plan and was not invoked as a reason to upgrade.

The managed projects expose six hours of instant restore history and no listed snapshots. This does not prove absence of off-site backups, but it does not establish a tested recovery either. Backup/restore verification remains a transfer gate.

Some project build/environment metadata, per-resource consumer connections, selected Marketplace assignment and supported transfer scope are not exposed by the available read tools. An empty integration-configuration project array is not proof that its resources have no consumers. The detailed inventory is private. No transfer decision is ready until those remaining associations and recovery are verified; no resource, plan, credential or configuration was changed.

## Example-only runbook prepared

Maintainer screenshots now confirm separate installed resources labeled Free, the example app as the displayed consumer on All Environments, and a single-resource Transfer Database entry disabled pending disconnection. This narrows the example trial scope but does not prove destination eligibility or recovery. See [the recovery-first example runbook](./2026-11-09-example-transfer-runbook.md). Its preparation is approved; backup/restore execution, a secure credential executor, disconnection, transfer and deployment remain unapproved.

## Approval requested

Phase 0 read-only inventory is approved and in progress. A/B remain open until that inventory establishes cost, supported transfer scope and recovery. The suggested staged approach is to evaluate the least-change example trial before selecting any Console data migration. Strong organization-level Console isolation remains available; production customer databases stay where they are.
