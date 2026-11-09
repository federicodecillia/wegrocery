# Local recovery runner: bounded encrypted export

Status: preparation approved on 2026-11-09; no database operation authorized or executed. Part of the [example recovery runbook](./2026-11-09-example-transfer-runbook.md). This tool prepares one component of R1, not a completed recovery mechanism.

## Implemented boundary

`scripts/recovery-backup.mjs` defaults to offline manifest validation. It does not launch a subprocess or contact a database in that mode. The separate `--execute-backup` option exports one explicitly named fake-data database through PostgreSQL 18 `pg_dump`, streaming its custom archive directly into `age` encryption. This flag is a technical safeguard, not a substitute for the maintainer's approval of the exact operation.

The initial export component has no provisioning, disconnection, transfer, deployment or cleanup-of-databases commands. A separately guarded restore component was prepared subsequently, as documented below. No production backup workflow or application behavior changes. Restore and count-only validation preparation is now documented below; provider execution remains separately gated. Do not disconnect a resource merely because this exporter exists.

## Private manifest contract

The maintainer prepares a JSON manifest outside every Git checkout, with owner-only permissions. The runner reads only this non-secret manifest; libpq reads the existing private service/password files. The agent must never open their contents. Do not create a manifest until exact source identity, data classification, retention and execution approval are recorded privately.

| Key | Required value |
|---|---|
| `version` | `1` |
| `classification` | `fake-data`, confirmed privately, not inferred from its name |
| `sourceHost` | Exact approved direct Neon endpoint in Frankfurt, without `-pooler` |
| `database`, `user`, `service` | Exact approved names, identifiers only, never a URL or password |
| `serviceFile`, `passwordFile` | Absolute paths to existing owner-only regular libpq configuration files outside the repository; no `.env*` paths or file symlinks |
| `recipient` | Public native age recipient; maintainer retains and independently checks the corresponding private decryption identity |
| `outputDirectory` | Existing private directory outside the repository, owner-only; agree an independent encrypted storage destination and retention before execution |
| `pgDump`, `age` | Absolute paths to trusted installed binaries, not writable by group/others; no installation or download performed by the runner |

Unknown keys are rejected. The manifest must not contain credentials. No credentials in command arguments, chat, shell history or committed files. The runner does not set up services, retrieve secrets, generate private keys or modify Vercel configuration. A missing credential/access stops the work; do not select another credential source.

The CLI accepts one manifest path, optionally followed by `--execute-backup`; any other option fails. Supplying the path alone validates its structure offline and reports `planned`, `databaseContacted: false`. This does not check connectivity, credentials, installed-tool compatibility or recovery. CLI errors use a fixed message and never echo arguments, manifest values or underlying errors.

## Export safeguards and output

- The child receives an allowlist environment, excluding ambient `DATABASE_URL`, `PGPASSWORD`, `PGOPTIONS` and unrelated application secrets. No shell is involved.
- Explicit libpq parameters pin host/database/user/port, clear `hostaddr`, require TLS hostname verification, bound connection time and set default read-only transactions. They override service-file settings as described in [PostgreSQL's service-file documentation](https://www.postgresql.org/docs/18/libpq-pgservice.html). Trusted service files and trusted local tools remain required; this is not an isolation boundary against a malicious local user.
- PostgreSQL 18 tooling is checked before export. Reconfirm the actual source version/identity through provider metadata before approval. The archive retains schema, data and ACL metadata; global roles are not included, as documented for [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html). Role recreation and grant verification remain separate recovery gates.
- The unencrypted archive exists only in process pipes. Only encrypted bytes are written, to a newly created owner-only partial file. Both subprocess exits and both streams must succeed without stderr output. Even warnings fail closed; diagnostics must be investigated privately, never by enabling raw logs.
- A 20-minute operation bound, 10-minute statement timeout, 5-second lock wait and 512 MiB encrypted-output cap stop unexpected work. Interrupts terminate the two child processes. Failure removes only this run's partial artifact. No database, existing backup or unrelated file is deleted.
- Publication uses an exclusive hard link after flushing the file. It cannot replace an existing completed archive. Success reports only the randomly generated artifact basename, ciphertext SHA-256 and byte count. A partial encrypted link may remain if unlinking fails after publication; inspect retention privately. A checksum proves artifact identity, not recoverability.

The source remains authoritative. A transaction-consistent dump is not proof that later source changes were captured. The runbook still requires an example-only writer freeze for the final cutover baseline, independent artifact custody, demonstrated decryption/restore and schema/sequence/privilege/invariant checks. No source overwrite or fallback is automated.

## Verification during preparation

Ten automated local tests cover offline default, input restrictions, private-file permissions, completed publication, separate dump/encryption failures, suppressed raw errors, inherited-credential isolation, pinned transport/identity options, warnings, PostgreSQL client mismatch and stalled-process termination. Fake executables exercise process/pipe failure handling without contacting a database. A separate local round trip with real `age` and an ephemeral test key verified encryption/decryption of a synthetic archive and absence of its plaintext in the stored artifact. No real credential file was opened by the agent. The full unit suite passed (124 files, 1,352 tests); TypeScript and targeted zero-warning ESLint checks passed. Integration tests were not run because this preparation must not contact a database.

These checks do not prove a PostgreSQL export or restore. R1 remains blocked on the exact approved source, secure maintainer-managed configuration and independently controlled empty PostgreSQL 18 target/budget, followed by a reviewed restore executor and validation plan. Console and customer databases remain outside this trial.

## Maintainer-only local credential entry

`scripts/recovery-credentials.py` is an optional Python 3 standard-library helper, run by the maintainer in their own interactive terminal. It accepts only an exact approved non-secret host, database and role as arguments. The PostgreSQL URL is pasted at a hidden prompt, never as an argument; redirected/non-terminal input and getpass fallback are refused. The agent does not run it with real credentials or inspect the files it creates.

It validates the exact direct endpoint/database/role, port and a limited TLS parameter set; unsupported options, other identities, pooled hosts and malformed input stop with a fixed error. Only the extracted password is stored in a libpq password file; the supplied URL is not persisted. Password colons/backslashes are escaped. Configuration uses verify-full TLS with system CA roots and required channel binding ([PostgreSQL 18 reference](https://www.postgresql.org/docs/18/libpq-connect.html#LIBPQ-CONNECT-SSLROOTCERT)). No `.env` is read, no subprocess/network operation is performed and no existing credential is retrieved or rotated.

Each run creates a new owner-only directory under the maintainer's `Library/Application Support/WeGroceryRecovery`, with `services.conf` and `passwords.conf` created exclusively with mode 0600. The password file contains a plaintext credential protected by OS permissions; this is not encrypted credential storage. The maintainer must accept that storage arrangement and keep the Mac/user account protected. Unsafe shared parent permissions, symlink parent and Git checkout locations are rejected. Never share, upload, print or commit these files. An interrupted write may retain private partial configuration for maintainer review; no existing credentials are overwritten or automatically deleted.

This step stores source configuration only. It does not create the backup manifest, generate the age identity, prove database connectivity, export data or restore anything. Encryption-key custody, independent artifact retention and the restore executor remain separate prerequisites. Tests use synthetic URLs/passwords only and verify identity rejection, safe escaping, private permissions, shared-parent refusal and non-terminal no-echo failure. The exporter hostname guard now accepts the provider's optional `c-N` shard label while retaining the exact Frankfurt suffix and direct-endpoint restrictions.

Follow-up validation: full unit suite passed (125 files, 1,355 tests), TypeScript and targeted zero-warning ESLint passed. No real credential was supplied to the helper by the agent.

## Isolated restore and read-only validation preparation

Subsequent preparation adds `scripts/recovery-restore.mjs`, `scripts/recovery-validation.ts` and `scripts/recovery-report.mts`. These are not execution approval. Restore defaults to offline planning; `--execute-restore` requires a private non-secret JSON configuration with exact distinct source/target hosts, database/user/service, private credential and age-identity file references, ciphertext path and SHA-256, plus trusted absolute `age`, `pgRestore` and `psql` paths.

The restore verifies private file permissions and PostgreSQL 18 client versions, checks the ciphertext digest and authenticates a full age decryption to discarded output before contacting the target. It then rechecks the digest, checks target database/user/server major and absence of non-system relations/functions, and streams a second decryption into `pg_restore --single-transaction --exit-on-error --no-owner`. It never uses `--clean`, restores into the source or creates provider resources. TLS pins the target host and requires system CA verification and channel binding. Timeout, interrupt, subprocess stderr, nonzero exits and stream errors fail closed with fixed output. An ambiguous failure is not proof of rollback: retain the target for inspection, never automatically retry, clear it or change source authority.

The manifest fields are exactly `sourceHost`, `targetHost`, `database`, `user`, `service`, `serviceFile`, `passwordFile`, `identityFile`, `archive`, `sha256`, `age`, `pgRestore`, `psql`. File references remain outside Git, owner-only; no credential values belong in the configuration. The local age identity is retained privately by the maintainer. Restoring trusts the source's schema/functions, so this tool is only for the explicitly approved trusted example archive.

The report CLI is run through the local tsx CLI with a backup-shaped private manifest, offline by default and explicitly enabled by `--execute-report`. It derives the adjacent `psql` client and executes one read-only transaction with bounded statement/lock timeouts and normalized UTC/date/search-path settings. It reports only technical identity, schema/privilege digests, per-table counts and sorted SHA-256 row digests, sequence state and unchanged `INVARIANT_CHECKS` wrapped in count queries. No individual row, member identifier, amount, credential or raw error is returned. Reports are private 0600 JSON files. Schema comparison includes columns, constraints, indexes, enabled triggers, functions, enum labels, ownership/RLS, table/column/schema grants, function owners/ACLs, views, RLS policies, extensions and sequence definitions. Column metadata excludes internal dropped-column slot identifiers while preserving visible column order and definitions. The full `_migrations` table is included in the row digest.

`--compare` accepts two private report paths and requires exact normalized agreement, the migration ledger and the complete zero-violation invariant set. This does not validate global role recreation automatically. Missing grants/roles, unexpected schemas, data drift or unsupported source objects stop the rehearsal for review; they are not repaired or bypassed.

For a rehearsal, capture a read-only source report before and after the transaction-consistent export, require those to match, and compare the isolated target report with that baseline. A source change causes a failed stability gate, not an automatic write freeze or retry. Keep source authoritative and do not use the example while the rehearsal runs. This alternative only demonstrates recovery of the captured archive; a later cutover still requires the runbook's enforced writer freeze and a fresh final baseline. No source configuration is changed to pause writers in this preparation.

Preparation evidence: private source configuration file permissions were checked without opening either credential file; the maintainer reported successful entry. The approved Neon target was observed idle with a suspension timestamp, at fixed 0.25 CU. Previous commit CI run `42654700953` passed. Local PostgreSQL 17 disposable clusters with synthetic data exercised every app migration, PostgreSQL 18 client dump/restore and the real aggregate SQL; source/target reports matched. This is SQL/portability evidence, not a Neon PostgreSQL 18 rehearsal. Targeted process tests cover empty-target refusal, identity equality, checksum mismatch, decryption authentication failure before any target write and stalled decryption. The real Neon rehearsal remains unexecuted pending credentials, key custody/retention and a single explicit operation approval.

Final preparation checks: 127 test files / 1,362 unit tests passed; TypeScript and targeted zero-warning ESLint passed. The disposable local SQL test also detected deliberate synthetic row, sequence and trigger drift. A real age decrypt/restore-pipe round trip and corrupted-ciphertext rejection were checked without any database connection. These local checks do not waive the real Neon rehearsal.
