"""Maintainer-run local credential entry. No network calls, subprocesses or .env reads."""
import getpass
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
from urllib.parse import parse_qsl, unquote, urlsplit
import warnings


def validate_identity(host, database, role):
    if (not re.fullmatch(r"ep-[a-z0-9-]+(?:\.c-[0-9]+)?\.eu-central-1\.aws\.neon\.tech", host)
            or "-pooler." in host
            or not all(re.fullmatch(r"[a-zA-Z_][a-zA-Z0-9_-]{0,62}", item) for item in (database, role))):
        raise ValueError("Invalid source identity")


def parse_source(uri, host, database, role):
    """Extract only the password after pinning identity; never persist the supplied URI."""
    validate_identity(host, database, role)
    try:
        if any(ord(char) < 32 or ord(char) == 127 for char in uri):
            raise ValueError()
        parsed = urlsplit(uri)
        parameters = parse_qsl(parsed.query, strict_parsing=True)
        allowed = {"sslmode": {"require", "verify-full"}, "channel_binding": {"require"}}
        if (parsed.scheme not in {"postgres", "postgresql"} or parsed.hostname != host
                or parsed.port not in {None, 5432} or unquote(parsed.username or "") != role
                or unquote(parsed.path) != f"/{database}" or parsed.fragment
                or len({key for key, _ in parameters}) != len(parameters)
                or not parameters or any(key not in allowed or value not in allowed[key] for key, value in parameters)
                or "sslmode" not in dict(parameters)):
            raise ValueError()
        password = unquote(parsed.password or "", errors="strict")
        if not password or any(ord(char) < 32 or ord(char) == 127 for char in password):
            raise ValueError()
        return password
    except (ValueError, UnicodeError):
        raise ValueError("Invalid source connection") from None


def save_source(parent, host, database, role, password):
    """Create a fresh private directory; never inspect or overwrite existing credentials."""
    validate_identity(host, database, role)
    info = parent.lstat()
    if (parent.is_symlink() or not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid()
            or stat.S_IMODE(info.st_mode) & 0o077
            or any((ancestor / ".git").exists() for ancestor in (parent, *parent.parents))):
        raise ValueError("Unsafe local directory")
    folder = Path(tempfile.mkdtemp(prefix="source-", dir=parent))
    os.chmod(folder, 0o700)
    service = (f"[recovery_source]\nhost={host}\nport=5432\ndbname={database}\nuser={role}\n"
               "sslmode=verify-full\nsslrootcert=system\nchannel_binding=require\nconnect_timeout=10\n")
    escaped = password.replace("\\", "\\\\").replace(":", "\\:")
    for name, content in (("services.conf", service),
                          ("passwords.conf", f"{host}:5432:{database}:{role}:{escaped}\n")):
        descriptor = os.open(folder / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
    return folder


def main():
    if len(sys.argv) != 4 or not sys.stdin.isatty() or not sys.stderr.isatty():
        raise ValueError("Interactive terminal required")
    host, database, role = sys.argv[1:]
    validate_identity(host, database, role)
    print("Configurazione locale soltanto: nessuna connessione o backup.")
    print("La password sarà salvata in un file libpq locale, leggibile solo dal tuo utente (0600).")
    print("Incolla SOLO l’URL PostgreSQL da Neon, senza psql e senza virgolette. L’inserimento è nascosto.")
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        uri = getpass.getpass("URL sorgente (nascosto): ")
    password = parse_source(uri, host, database, role)
    uri = None
    parent = Path.home() / "Library" / "Application Support" / "WeGroceryRecovery"
    parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    folder = save_source(parent, host, database, role, password)
    password = None
    print(f"Configurazione salvata in: {folder}")
    print("Nessuna connessione al database eseguita. Torna in chat e scrivi: salvato.")


if __name__ == "__main__":
    try:
        main()
    except (Exception, KeyboardInterrupt):
        print("Configurazione interrotta. Nessun valore o errore sensibile viene mostrato. Non incollare segreti in chat.", file=sys.stderr)
        sys.exit(1)
