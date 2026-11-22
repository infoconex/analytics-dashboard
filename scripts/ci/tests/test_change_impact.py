"""Deterministic dependency map coverage, including unsafe changes."""
import importlib.util
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


impact = load("change_impact", "change-impact.py")
gate = load("verify_gate", "verify-gate.py")
security_gate = load("security_gate", "verify-codeql-gate.py")


class ChangeImpactTests(unittest.TestCase):
    def test_documentation_only_skips_expensive_suites(self):
        self.assertEqual(impact.classify(["docs/guide.md", "README.md"]), set())

    def test_frontend_requires_ui_tests_and_security(self):
        self.assertEqual(
            impact.classify(["web/src/App.tsx"]),
            {"frontend", "browser", "integration", "javascript"},
        )

    def test_backend_api_requires_real_browser_and_dotnet(self):
        self.assertEqual(
            impact.classify(["src/AnalyticsDashboard.Api/Program.cs"]),
            {"backend", "browser", "integration", "csharp"},
        )

    def test_infrastructure_triggers_real_providers(self):
        self.assertEqual(
            impact.classify(["src/AnalyticsDashboard.Infrastructure/Adapter.cs"]),
            {"backend", "browser", "integration", "providers", "csharp"},
        )

    def test_integration_routing_for_runtime_but_not_docs_or_browser_specs(self):
        for path in ("web/src/EmbeddedDashboard.tsx", "web/sample-host.html",
                     "web/vite.config.ts", "src/AnalyticsDashboard.Api/Program.cs"):
            with self.subTest(path=path):
                self.assertIn("integration", impact.classify([path]))
        self.assertNotIn("integration", impact.classify(["web/e2e/embed.spec.ts"]))
        self.assertNotIn("integration", impact.classify(["docs/notes.md"]))
        self.assertEqual(impact.classify(["compose.ux16-owner.yml"]), set(impact.SUITES))

    def test_backend_tests_preserve_provider_coverage(self):
        self.assertIn("providers", impact.classify(["tests/AnalyticsDashboard.Tests/A.cs"]))

    def test_browser_test_only_does_not_run_dotnet_unit_suite(self):
        self.assertEqual(
            impact.classify(["web/e2e/embed.spec.ts"]), {"browser", "javascript"},
        )

    def test_lockfile_adds_lab_validation(self):
        self.assertIn("lab", impact.classify(["web/package-lock.json"]))

    def test_ci_scripts_and_unknown_paths_fail_safe(self):
        for path in (".github/workflows/verify.yml", "scripts/ci/change-impact.py",
                     "unexpected/build.sh", "Directory.Build.props",
                     "compose.ux16-owner.yml"):
            with self.subTest(path=path):
                self.assertEqual(impact.classify([path]), set(impact.SUITES))

    def test_missing_diff_fails_safe(self):
        self.assertEqual(impact.classify([]), set(impact.SUITES))

    def test_mixed_paths_union(self):
        selected = impact.classify(["docs/guide.md", "web/src/App.tsx",
                                    "src/AnalyticsDashboard.Infrastructure/Sql.cs"])
        self.assertEqual(
            selected, {"frontend", "backend", "browser", "integration", "providers",
                       "javascript", "csharp"},
        )

    def test_gate_rejects_missing_or_failed_required_jobs(self):
        expected = dict.fromkeys(gate.SUITES, "false")
        actual = dict.fromkeys(gate.SUITES, "skipped")
        expected["browser"] = "true"
        self.assertTrue(gate.evaluate("success", expected, actual))
        actual["browser"] = "success"
        self.assertFalse(gate.evaluate("success", expected, actual))
        self.assertTrue(gate.evaluate("failure", expected, actual))
        expected["backend"] = ""
        self.assertTrue(gate.evaluate("success", expected, actual))

    def test_security_gate_is_stable_for_docs_and_language_changes(self):
        self.assertFalse(security_gate.evaluate("success", "false", "false", "skipped"))
        self.assertFalse(security_gate.evaluate("success", "false", "true", "success"))
        self.assertTrue(security_gate.evaluate("success", "true", "false", "skipped"))
        self.assertTrue(security_gate.evaluate("success", "true", "false", "failure"))
        self.assertTrue(security_gate.evaluate("failure", "false", "false", "skipped"))


if __name__ == "__main__":
    unittest.main()
