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

## Maintainer-only local credential entry

`scripts/recovery-credentials.py` is an optional Python 3 standard-library helper, run by the maintainer in their own interactive terminal. It accepts only an exact approved non-secret host, database and role as arguments. The PostgreSQL URL is pasted at a hidden prompt, never as an argument; redirected/non-terminal input and getpass fallback are refused. The agent does not run it with real credentials or inspect the files it creates.

It validates the exact direct endpoint/database/role, port and a limited TLS parameter set; unsupported options, other identities, pooled hosts and malformed input stop with a fixed error. Only the extracted password is stored in a libpq password file; the supplied URL is not persisted. Password colons/backslashes are escaped. Configuration uses verify-full TLS with system CA roots and required channel binding ([PostgreSQL 18 reference](https://www.postgresql.org/docs/18/libpq-connect.html#LIBPQ-CONNECT-SSLROOTCERT)). No `.env` is read, no subprocess/network operation is performed and no existing credential is retrieved or rotated.

Each run creates a new owner-only directory under the maintainer's `Library/Application Support/WeGroceryRecovery`, with `services.conf` and `passwords.conf` created exclusively with mode 0600. The password file contains a plaintext credential protected by OS permissions; this is not encrypted credential storage. The maintainer must accept that storage arrangement and keep the Mac/user account protected. Unsafe shared parent permissions, symlink parent and Git checkout locations are rejected. Never share, upload, print or commit these files. An interrupted write may retain private partial configuration for maintainer review; no existing credentials are overwritten or automatically deleted.

This step stores source configuration only. It does not create the backup manifest, generate the age identity, prove database connectivity, export data or restore anything. Encryption-key custody, independent artifact retention and the restore executor remain separate prerequisites. Tests use synthetic URLs/passwords only and verify identity rejection, safe escaping, private permissions, shared-parent refusal and non-terminal no-echo failure. The exporter hostname guard now accepts the provider's optional `c-N` shard label while retaining the exact Frankfurt suffix and direct-endpoint restrictions.

Follow-up validation: full unit suite passed (125 files, 1,355 tests), TypeScript and targeted zero-warning ESLint passed. No real credential was supplied to the helper by the agent.
