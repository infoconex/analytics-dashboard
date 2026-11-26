#!/usr/bin/env python3
"""Create a measured, lossless archive for one Playwright shard's evidence."""
import json
from pathlib import Path
import sys
import time
from zipfile import ZIP_DEFLATED, ZipFile


def main() -> int:
    if len(sys.argv) != 4:
        raise SystemExit("Usage: archive-browser-evidence.py REPORT_DIR ARCHIVE_ZIP METRICS_JSON")
    repository = Path.cwd().resolve()
    report_dir = Path(sys.argv[1]).resolve()
    archive_path = Path(sys.argv[2]).resolve()
    metrics_path = Path(sys.argv[3]).resolve()
    files = sorted(path for path in report_dir.rglob("*") if path.is_file()) if report_dir.exists() else []
    try:
        report_root = report_dir.relative_to(repository)
    except ValueError:
        report_root = Path(report_dir.name)
    archive_path.parent.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    with ZipFile(archive_path, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for path in files:
            archive.write(path, (report_root / path.relative_to(report_dir)).as_posix())
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    metrics = {
        "schemaVersion": 1,
        "phase": "report-archive",
        "elapsedMs": elapsed_ms,
        "fileCount": len(files),
        "sourceBytes": sum(path.stat().st_size for path in files),
        "archiveBytes": archive_path.stat().st_size,
        "archive": archive_path.name,
        "reportRoot": report_root.as_posix(),
    }
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metrics))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
