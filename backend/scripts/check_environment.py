#!/usr/bin/env python3
"""Audit installed runtime packages against backend/requirements.lock.txt."""
from __future__ import annotations
import importlib.metadata
import sys
from pathlib import Path


def parse_lock_file(lock_path: Path) -> dict[str, str]:
    if not lock_path.exists():
        raise FileNotFoundError(f"Lock file not found: {lock_path}")
    expected: dict[str, str] = {}
    with open(lock_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "==" in line:
                pkg, ver = line.split("==", 1)
                expected[pkg.strip().lower()] = ver.strip()
    return expected


def audit_environment(lock_path: Path | None = None) -> tuple[str, list[str]]:
    if lock_path is None:
        lock_path = Path(__file__).resolve().parent.parent / "requirements.lock.txt"
    if not lock_path.exists():
        return "UNKNOWN", [f"Lock file not found at {lock_path}"]
    mismatches: list[str] = []
    for pkg_name, exp_version in parse_lock_file(lock_path).items():
        try:
            installed_version = importlib.metadata.version(pkg_name)
            if installed_version != exp_version:
                mismatches.append(f"MISMATCH: {pkg_name} installed={installed_version}, expected={exp_version}")
        except importlib.metadata.PackageNotFoundError:
            mismatches.append(f"MISSING: {pkg_name} expected={exp_version} but not installed")
        except Exception as exc:
            mismatches.append(f"ERROR: Could not inspect {pkg_name}: {exc}")
    return ("MISMATCH", mismatches) if mismatches else ("MATCH", [])


def main() -> None:
    status, details = audit_environment()
    print(f"Environment Lock Audit Status: {status}")
    for item in details:
        print(f" - {item}")
    if status == "MATCH":
        print("All installed dependencies strictly match requirements.lock.txt.")
        sys.exit(0)
    sys.exit(1)


if __name__ == "__main__":
    main()
