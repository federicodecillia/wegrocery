import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from urllib.parse import quote

spec = importlib.util.spec_from_file_location("credentials", Path(__file__).with_name("recovery-credentials.py"))
credentials = importlib.util.module_from_spec(spec)
spec.loader.exec_module(credentials)

HOST = "ep-synthetic-123.c-5.eu-central-1.aws.neon.tech"

class CredentialSetupTests(unittest.TestCase):
    def test_validates_exact_identity_and_escapes_password_file(self):
        password = "synthetic:pass\\word"
        uri = f"postgresql://neondb_owner:{quote(password, safe='')}@{HOST}/neondb?sslmode=require&channel_binding=require"
        parsed = credentials.parse_source(uri, HOST, "neondb", "neondb_owner")
        with tempfile.TemporaryDirectory() as directory:
            os.chmod(directory, 0o700)
            folder = credentials.save_source(Path(directory), HOST, "neondb", "neondb_owner", parsed)
            self.assertEqual(folder.stat().st_mode & 0o777, 0o700)
            self.assertEqual((folder / "passwords.conf").stat().st_mode & 0o777, 0o600)
            self.assertIn("synthetic\\:pass\\\\word", (folder / "passwords.conf").read_text())
            service = (folder / "services.conf").read_text()
            self.assertIn("sslrootcert=system", service)
            self.assertIn("sslmode=verify-full", service)
            self.assertNotIn(password, service)

    def test_rejects_wrong_source_transport_role_and_injected_options_without_echo(self):
        good = f"postgresql://neondb_owner:synthetic-secret@{HOST}/neondb?sslmode=require"
        for uri in [good.replace(HOST, "ep-other.c-5.eu-central-1.aws.neon.tech"),
                    good.replace(HOST, HOST.replace(".c-5", "-pooler.c-5")),
                    good.replace("neondb_owner", "other_role"),
                    good.replace("/neondb", "/otherdb"),
                    good + "&options=unsafe", good + "&sslmode=disable",
                    good.replace("sslmode=require", "sslmode=disable"), "psql '" + good + "'",
                    good.replace("synthetic-secret", "bad%0Apassword")]:
            with self.subTest(uri="invalid synthetic input"):
                with self.assertRaisesRegex(ValueError, "^Invalid source connection$"):
                    credentials.parse_source(uri, HOST, "neondb", "neondb_owner")

    def test_never_writes_into_a_shared_parent(self):
        with tempfile.TemporaryDirectory() as directory:
            os.chmod(directory, 0o755)
            with self.assertRaises(ValueError):
                credentials.save_source(Path(directory), HOST, "neondb", "neondb_owner", "synthetic")
            self.assertEqual(list(Path(directory).iterdir()), [])

if __name__ == "__main__":
    unittest.main()
