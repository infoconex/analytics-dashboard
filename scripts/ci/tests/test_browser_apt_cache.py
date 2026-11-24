"""Guard the hosted browser cache wrapper's syntax and admission boundary."""
import os
from pathlib import Path
import subprocess
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "verify-browser-with-apt-cache.sh"


class BrowserAptCacheTests(unittest.TestCase):
    def test_shell_syntax(self):
        subprocess.run(["bash", "-n", str(SCRIPT)], check=True)

    def test_refuses_non_hosted_invocation_before_privileged_operations(self):
        env = dict(os.environ, CI="true", GITHUB_ACTIONS="false", RUNNER_OS="Linux")
        result = subprocess.run(["bash", str(SCRIPT), "1", "4"],
                                env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn("hosted Linux CI only", result.stderr)
