#!/usr/bin/env python3
"""Always-present security check for dynamically selected CodeQL languages."""
import os
import sys


def evaluate(impact_result: str, csharp: str, javascript: str,
             analyze_result: str) -> list[str]:
    failures = []
    if impact_result != "success":
        failures.append(f"Security impact failed: {impact_result!r}")
    if csharp not in ("true", "false") or javascript not in ("true", "false"):
        failures.append("Invalid CodeQL language selection")
    elif csharp == "true" or javascript == "true":
        if analyze_result != "success":
            failures.append(f"Selected language analysis failed: {analyze_result!r}")
    elif analyze_result not in ("skipped", "success"):
        failures.append(f"Unexpected analysis job state: {analyze_result!r}")
    return failures


if __name__ == "__main__":
    fields = (os.environ.get("IMPACT_RESULT", ""),
              os.environ.get("CSHARP_EXPECTED", ""),
              os.environ.get("JAVASCRIPT_EXPECTED", ""),
              os.environ.get("ANALYZE_RESULT", ""))
    errors = evaluate(*fields)
    if errors:
        print("\n".join(errors), file=sys.stderr)
    else:
        print("Selected CodeQL languages completed successfully; skips are intentional.")
    raise SystemExit(1 if errors else 0)
