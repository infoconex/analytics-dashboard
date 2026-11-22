#!/usr/bin/env python3
"""Verify GitHub Actions suite results against the change impact plan."""
from __future__ import annotations

import os
import sys
from pathlib import Path

SUITES = ("backend", "frontend", "lab", "browser", "providers", "integration")


def evaluate(impact_result: str, expected: dict[str, str],
             actual: dict[str, str]) -> list[str]:
    failures: list[str] = []
    if impact_result != "success":
        failures.append(f"Change impact job: expected success, got {impact_result!r}")
    for suite in SUITES:
        wants = expected.get(suite, "")
        got = actual.get(suite, "")
        if wants not in ("true", "false"):
            failures.append(f"{suite}: missing/invalid impact decision {wants!r}")
        elif wants == "true" and got != "success":
            failures.append(f"{suite}: required, job result {got!r}")
        elif wants == "false" and got not in ("success", "skipped"):
            failures.append(f"{suite}: optional but job result {got!r}")
    return failures


def main() -> int:
    expected = {key: os.environ.get(f"{key.upper()}_EXPECTED", "") for key in SUITES}
    actual = {key: os.environ.get(f"{key.upper()}_RESULT", "") for key in SUITES}
    impact = os.environ.get("IMPACT_RESULT", "")
    errors = evaluate(impact, expected, actual)
    for suite in SUITES:
        print(f"{suite}: expected={expected[suite]!r} job={actual[suite]!r}")
    if errors:
        print("Verification gate failed:\n" + "\n".join(errors), file=sys.stderr)
    else:
        print("All required test suites passed; intentional skips verified.")
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with Path(path).open("a", encoding="utf-8") as summary:
            summary.write("### Required verification gate\n\n")
            summary.write("| Suite | Required | Result |\n| --- | --- | --- |\n")
            for suite in SUITES:
                summary.write(f"| {suite} | {expected[suite]} | {actual[suite]} |\n")
            summary.write(f"\n**{'FAILED' if errors else 'PASSED'}**\n")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
