# Local recovery runner: bounded encrypted export

Status: preparation approved on 2026-11-09; no database operation authorized or executed. Part of the [example recovery runbook](./2026-11-09-example-transfer-runbook.md). This tool prepares one component of R1, not a completed recovery mechanism.

## Implemented boundary

`scripts/recovery-backup.mjs` defaults to offline manifest validation. It does not launch a subprocess or contact a database in that mode. The separate `--execute-backup` option exports one explicitly named fake-data database through PostgreSQL 18 `pg_dump`, streaming its custom archive directly into `age` encryption. This flag is a technical safeguard, not a substitute for the maintainer's approval of the exact operation.

There are no restore, provisioning, disconnection, transfer, deployment or cleanup-of-databases commands. No production backup workflow or application behavior changes. The restore executor and count-only invariant validation remain to be implemented and reviewed after the isolated target has been specified. Do not disconnect a resource merely because this exporter exists.

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
