"""Hosted browser dependency policy, cleanup and bounded failure."""
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "verify-browser-with-apt-cache.sh"
INSTALLER = ROOT / "install-browser-linux-dependencies.sh"
HOSTED = dict(CI="true", GITHUB_ACTIONS="true", RUNNER_OS="Linux")
IS_HOSTED = all(os.environ.get(key) == value for key, value in HOSTED.items())


class BrowserAptCacheTests(unittest.TestCase):
    def test_shell_syntax(self):
        for script in (SCRIPT, INSTALLER):
            subprocess.run(["bash", "-n", str(script)], check=True)

    def test_refuses_non_hosted_invocation_before_privileged_operations(self):
        for script, args in ((SCRIPT, ["1", "6"]), (INSTALLER, [])):
            for key in HOSTED:
                with self.subTest(script=script.name, key=key):
                    env = dict(os.environ, **HOSTED)
                    env[key] = "false"
                    result = subprocess.run(["bash", str(script), *args],
                                            env=env, capture_output=True, text=True)
                    self.assertEqual(result.returncode, 2)
                    self.assertIn("hosted Linux CI only", result.stderr)

    def test_wrapper_config_and_cleanup_after_installer_failure(self):
        # Simulate sudo only for the wrapper; all filesystem changes stay
        # under this test's temporary directory, with no real APT activity.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            bin_dir = root / "bin"
            bin_dir.mkdir()
            sudo = bin_dir / "sudo"
            sudo.write_text("""#!/usr/bin/env bash
set -euo pipefail
case "$1" in
    mktemp)
        if [[ "$2" == -d ]]; then
            mktemp -d "$FIXTURE_ROOT/archive.XXXXXX"
        else
            mktemp "$FIXTURE_ROOT/config.XXXXXX"
        fi
        ;;
    tee) exec tee "$2" "$FIXTURE_ROOT/captured-config" ;;
    *) exec "$@" ;;
esac
""")
            sudo.chmod(0o755)
            pwsh = bin_dir / "pwsh"
            pwsh.write_text("""#!/usr/bin/env bash
set -euo pipefail
compgen -G "$FIXTURE_ROOT/config.*" >/dev/null
compgen -G "$FIXTURE_ROOT/archive.*" >/dev/null
exit 124
""")
            pwsh.chmod(0o755)
            output = root / "github-output"
            output.touch()
            env = dict(os.environ, **HOSTED)
            env.update(PATH=f"{bin_dir}:{os.environ['PATH']}",
                       FIXTURE_ROOT=tmp, RUNNER_TEMP=tmp, GITHUB_OUTPUT=str(output))
            result = subprocess.run(["bash", str(SCRIPT), "1", "6"],
                                    env=env, capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 124, result.stderr)
            config = (root / "captured-config").read_text()
            for setting in ('Acquire::http::Timeout "30";',
                            'Acquire::https::Timeout "30";',
                            'Acquire::Retries "1";',
                            'APT::Update::Error-Mode "any";',
                            'APT::Keep-Downloaded-Packages "true";'):
                self.assertIn(setting, config)
            self.assertIn('Dir::Cache::archives "', config)
            self.assertFalse(list(root.glob("archive.*")))
            self.assertFalse(list(root.glob("config.*")))
            self.assertEqual(output.read_text(), "")

            # The required gate must reject the failed browser job.
            gate_env = dict(os.environ, IMPACT_RESULT="success")
            gate_env.pop("GITHUB_STEP_SUMMARY", None)
            for suite in ("BACKEND", "FRONTEND", "LAB", "BROWSER", "PROVIDERS", "INTEGRATION"):
                gate_env[f"{suite}_EXPECTED"] = "true"
                gate_env[f"{suite}_RESULT"] = "success"
            gate_env["BROWSER_RESULT"] = "failure"
            gate = subprocess.run(["python3", str(ROOT / "verify-gate.py")],
                                  env=gate_env, capture_output=True, text=True)
            self.assertEqual(gate.returncode, 1)
            self.assertIn("browser: required, job result 'failure'", gate.stderr)

    @unittest.skipUnless(IS_HOSTED, "requires GitHub-hosted Linux systemd and passwordless sudo")
    def test_real_service_deadline_and_failure_propagation(self):
        # The production helper's actual systemd cgroup, with shortened
        # fixture limits, no packages or network and a root child that
        # ignores TERM. This exercises escalation, not just the parent.
        def run(runtime, grace, *command):
            return subprocess.run(
                ["bash", "-c", 'source "$1"; shift; run_bounded_installer "$@"',
                 "fixture", str(INSTALLER), str(runtime), str(grace), *command],
                capture_output=True, text=True, timeout=20,
            )

        self.assertEqual(run(10, 2, "/bin/true").returncode, 0)
        failure = run(10, 2, "/bin/sh", "-c", "exit 42")
        self.assertEqual(failure.returncode, 42, failure.stderr)
        self.assertIn("Linux dependency installation failed", failure.stderr)
        start = time.monotonic()
        stalled = run(1, 2, "/usr/bin/sudo", "-n", "/bin/bash", "-c",
                      'trap "" TERM; sleep 60')
        elapsed = time.monotonic() - start
        self.assertNotEqual(stalled.returncode, 0)
        self.assertLess(elapsed, 15)
        self.assertIn("timeout", (stalled.stdout + stalled.stderr).lower())
        self.assertIn("Linux dependency installation failed", stalled.stderr)
        print(f"Bounded installer fixture: failed in {elapsed:.2f}s (1s runtime, 2s grace)")
