#!/usr/bin/env python3
"""Fail-closed, suite-level change impact mapping for GitHub Actions and local use."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

SUITES = ("backend", "frontend", "lab", "browser", "providers", "integration", "csharp", "javascript")
SHARED = {
    "AnalyticsDashboard.slnx", "Directory.Build.props", "global.json",
    ".editorconfig", ".gitignore", "compose.ux16-owner.yml",
}
DOCUMENTATION = {"README.md", "SECURITY.md"}


def classify(paths: list[str]) -> set[str]:
    """Select affected suites. Unrecognized paths and CI changes run everything."""
    selected: set[str] = set()
    if not paths:
        return set(SUITES)  # A missing diff is not proof that nothing changed.
    for raw in paths:
        path = raw.replace("\\", "/")
        while path.startswith("./"):
            path = path[2:]
        # Never normalize traversal or malformed paths into a safe documentation-only change.
        if (not path or path.startswith("/") or
                any(part in ("", ".", "..") for part in path.split("/"))):
            return set(SUITES)
        if path.startswith("docs/") or path in DOCUMENTATION:
            continue
        if path in SHARED or path.startswith((".github/", "scripts/")):
            return set(SUITES)
        if path.startswith("src/"):
            selected.update(("backend", "browser", "integration", "csharp"))
            if path.startswith("src/AnalyticsDashboard.Infrastructure/"):
                selected.add("providers")
        elif path.startswith("tests/"):
            selected.update(("backend", "browser", "providers", "csharp"))
        elif path.startswith("web/"):
            if path.startswith("web/e2e/"):
                selected.update(("browser", "javascript"))
            else:
                selected.update(("frontend", "browser", "integration", "javascript"))
                if path.startswith("web/scripts/") or path in (
                    "web/package.json", "web/package-lock.json"
                ):
                    selected.add("lab")
        elif path.startswith("lab/"):
            selected.update(("lab", "frontend", "browser", "javascript"))
        else:
            return set(SUITES)
    return selected


def changed_files(base: str, head: str) -> list[str]:
    if not base or not head:
        raise ValueError("PR requires base and head SHAs")
    # --no-renames includes both ends of a rename; a sensitive deleted path
    # cannot disappear from the impact classification.
    result = subprocess.run(
        ["git", "diff", "--no-renames", "--name-only", "-z",
         f"{base}...{head}"],
        check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    return [p.decode("utf-8") for p in result.stdout.split(b"\0") if p]


def run() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--event", default="pull_request")
    parser.add_argument("--base", default="")
    parser.add_argument("--head", default="")
    parser.add_argument("--github-output", default="")
    parser.add_argument("--summary", default="")
    parser.add_argument("--files", nargs="*", default=None,
                        help="Local dry-run classification; no GitHub API required")
    args = parser.parse_args()
    fallback = False
    if args.files is not None:
        paths = args.files
        selected = classify(paths)
    elif args.event != "pull_request":
        paths = ["(full verification: main, scheduled or manual run)"]
        selected = set(SUITES)
    else:
        try:
            paths = changed_files(args.base, args.head)
            selected = classify(paths)
        except (OSError, subprocess.SubprocessError, ValueError) as error:
            print(f"Change diff unavailable: {error}; running every suite", file=sys.stderr)
            paths = ["(diff unavailable: fail-safe full verification)"]
            selected = set(SUITES)
            fallback = True

    result = {name: str(name in selected).lower() for name in SUITES}
    languages = [language for suite, language in (
        ("csharp", "csharp"), ("javascript", "javascript-typescript")
    ) if suite in selected]
    # Avoid an invalid empty matrix; analyze is skipped if nothing was selected.
    matrix_json = json.dumps(languages or ["none"], separators=(",", ":"))
    for name, value in result.items():
        print(f"{name}={value}")
    print(f"Changed paths ({len(paths)}): {', '.join(paths[:25])}")

    if args.github_output:
        with Path(args.github_output).open("a", encoding="utf-8") as out:
            for name, value in result.items():
                out.write(f"{name}={value}\n")
            out.write(f"languages={matrix_json}\n")
    if args.summary:
        with Path(args.summary).open("a", encoding="utf-8") as summary:
            summary.write("### Change impact selection\n\n")
            summary.write("| Suite | Required |\n| --- | --- |\n")
            for name, value in result.items():
                summary.write(f"| {name} | {value} |\n")
            summary.write(f"\nPaths classified: {len(paths)}; fail-safe fallback: {fallback}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
