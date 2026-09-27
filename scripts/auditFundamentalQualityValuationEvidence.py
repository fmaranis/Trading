"""Audit stored R1 evidence without fetching data or changing frozen research.

Run from repository root: python scripts/auditFundamentalQualityValuationEvidence.py
This is an evidence audit, NOT an implementation of the sealed PIT experiment.
No R2 return calculations are performed.
"""
import hashlib
import json
import math
import statistics
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "validation-runs"


def read(path):
    return json.loads(path.read_text())


def finite_positive(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0


def quantile(values, p):
    ordered = sorted(values)
    h = (len(ordered) - 1) * p
    lo, hi = math.floor(h), math.ceil(h)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (h - lo)


def main():
    summary_path = BASE / "diagnostics/fundamental-quality-valuation-external-2021-result.json"
    summary = read(summary_path)
    chunks = sorted((BASE / "diagnostics").glob("fundamental-quality-valuation-external-2021-chunk-*.json"))
    rows = [row for path in chunks for row in read(path)["rows"]]
    counts = Counter(row["ticker"] for row in rows)
    assert all(count == 1 for count in counts.values()), "Duplicate outcome tickers"
    valid = [row for row in rows if all(finite_positive(row.get(key)) for key in ("adjustedClose20210503", "adjustedClose20220503"))]
    missing = sorted(set(counts) - {row["ticker"] for row in valid})
    assert missing == sorted(summary["coverage"]["missingOutcomeTickers"])
    assert len(valid) == summary["coverage"]["highQualityWithOutcome"]
    returns = [100 * (row["adjustedClose20220503"] / row["adjustedClose20210503"] - 1) for row in valid]
    groups = summary["groups"]
    n = sum(group["n"] for group in groups.values())
    assert n == len(valid)
    pooled_reported_mean = sum(group["n"] * group["meanReturnPct"] for group in groups.values()) / n
    pooled_mean = statistics.mean(returns)
    assert math.isclose(pooled_mean, pooled_reported_mean, abs_tol=1e-10)
    arithmetic_checks = {}
    for benchmark in ("SPY", "URTH"):
        benchmark_return = summary["benchmarks"][benchmark + "ReturnPct"]
        suffix = "Spy" if benchmark == "SPY" else "Urth"
        for label, group in groups.items():
            for stat in ("mean", "median"):
                actual = group[stat + "ReturnPct"] - benchmark_return
                assert math.isclose(actual, group[stat + "ExcessVs" + suffix + "PctPoints"], abs_tol=1e-10)
        wins = sum(ret > benchmark_return for ret in returns)
        reported_wins = sum(round(group["n"] * group["beat" + suffix + "Pct"] / 100) for group in groups.values())
        assert wins == reported_wins
        arithmetic_checks[benchmark] = {"benchmarkReturnPctReportedNotIndependentlyVerified": benchmark_return, "pooledWinsRecomputed": wins, "pooledHitRatePct": 100 * wins / n}
    cheap, expensive = groups["cheapReasonable"], groups["expensive"]
    gate = {
        "cheapBeatsExpensiveMean": cheap["meanReturnPct"] > expensive["meanReturnPct"],
        "cheapMeanExcessVsSpyPositive": cheap["meanExcessVsSpyPctPoints"] > 0,
        "cheapMeanExcessVsUrthPositive": cheap["meanExcessVsUrthPctPoints"] > 0,
        "expensiveMeanExcessVsSpyNegative": expensive["meanExcessVsSpyPctPoints"] < 0,
        "expensiveMeanExcessVsUrthNegative": expensive["meanExcessVsUrthPctPoints"] < 0,
    }
    assert gate == {k: summary["gate"][k] for k in gate}
    seal_path = BASE / "preregistration/fundamental-quality-valuation-broad-pit-v1-seal.json"
    seal = read(seal_path)
    seal_checks = {}
    for name, expected in seal["expectedGitBlobSha"].items():
        data = (ROOT / name).read_text().replace("\r\n", "\n").encode()
        actual = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
        assert actual == expected, name
        seal_checks[name] = actual
    r2_chunks = sorted((BASE / "diagnostics").glob("fundamental-quality-valuation-external-r2-chunk-*.json"))
    r2_metadata = [{"path": str(path.relative_to(ROOT)), "rowCount": len(read(path)["rows"]), "declaredRowsCovered": read(path)["rowsCovered"]} for path in r2_chunks]
    source_files = [summary_path, *chunks, seal_path, *r2_chunks]
    result = {
        "version": "FUNDAMENTAL_QUALITY_VALUATION_EVIDENCE_AUDIT_2026_09_27",
        "scope": "STORED_EXTERNAL_R1_EVIDENCE_ONLY_NOT_SEALED_PIT_RUN",
        "status": "STRICT_PIT_VALIDATION_INCOMPLETE_EVIDENCE_AND_RUNTIME_PREREQUISITES",
        "productionDefault": "LEGACY", "productionAuthority": False,
        "sampleState": "R1_CONSUMED; R2_ALREADY_PARTIALLY_OPENED_IN_REPOSITORY",
        "sealedFilesIntact": seal_checks,
        "sourceSha256": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in source_files},
        "coverage": {
            "reportedHistoricalMembersNotReconstructed": summary["coverage"]["historicalMembers"],
            "reportedProfitableEvaluableNotReconstructed": summary["coverage"]["profitableEvaluable"],
            "reportedHighQualityNotReconstructed": summary["coverage"]["highQuality"],
            "storedUniqueOutcomeTickers": len(counts), "validPositiveEndpointPairs": n,
            "missingOutcomeTickers": missing, "duplicateTickers": [],
            "endpointCoverageOfClaimedHighQualityPct": 100 * n / len(rows),
            "rowLevelFundamentalsStoredInChunks": False,
            "filingDatesStoredInChunks": False,
            "rowLevelQualityScoresStoredInChunks": False,
            "rowLevelEarningsYieldStoredInChunks": False,
            "rowLevelBranchMembershipStoredInChunks": False,
        },
        "reportedGroupsNotIndependentlyReconstructed": groups,
        "summaryArithmeticChecks": arithmetic_checks,
        "reportedGateRecomputed": {**gate, "fullPass": all(gate.values())},
        "pooledStoredEndpointDiagnostics": {
            "interpretation": "Recomputed from stored prices; membership, date authenticity and corporate-action correctness not independently certified",
            "n": n, "meanReturnPct": pooled_mean,
            "medianReturnPct": statistics.median(returns),
            "sampleStdDevPctPoints": statistics.stdev(returns),
            "p10ReturnPct": quantile(returns, .1), "p25ReturnPct": quantile(returns, .25),
            "worstReturnPct": min(returns), "bestReturnPct": max(returns),
            "negativeReturnCount": sum(ret < 0 for ret in returns),
            "negativeReturnPct": 100 * sum(ret < 0 for ret in returns) / n,
            "maxDrawdown": None, "maxDrawdownReason": "Only endpoint prices stored; no daily path",
        },
        "negativeControls": {
            "qualityAlone": {"status": "NOT_IDENTIFIABLE", "reason": "No lower-quality comparison panel preserved"},
            "valueAlone": {"status": "NOT_IDENTIFIABLE", "reason": "No full-universe earnings yields/outcomes preserved"},
            "qualityTimesValuation": {"status": "NOT_IDENTIFIABLE_AS_INCREMENTAL_INTERACTION", "reason": "Within-high-quality spread is not a difference-in-differences interaction; lower-quality valuation cells absent"},
            "branchDispersion": {"status": "UNAVAILABLE", "reason": "Cannot map returns to frozen branches without saved inputs/labels"},
        },
        "r2ExistingOutcomeEvidence": {"chunks": r2_metadata, "storedRows": sum(x["rowCount"] for x in r2_metadata), "additionalR2OutcomesFetched": False, "r2ReturnsComputedByAudit": False},
        "strictPitLimitations": [
            "FY2020 label alone does not prove publication by 2021-05-03 or exclude later restatements.",
            "External diluted EPS/raw close valuation is not the sealed SEC net-income/(raw-close*causal-shares) formula.",
            "Historical constituent rows and source snapshot are not included in external evidence files.",
            "Stored prices lack per-observation source date/corporate-action lineage; delisted/renamed identities require verification.",
            "The sealed runner enriches valuation and outcomes only for HIGH_QUALITY, so by itself it cannot supply requested lower-quality/value-alone controls.",
            "No weights, thresholds, dates, provider substitutions or sealed code changed by this audit.",
        ],
    }
    output = BASE / "diagnostics/fundamental-quality-valuation-evidence-audit-2026-09-27.json"
    output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"output": str(output.relative_to(ROOT)), "coverage": result["coverage"], "pooled": result["pooledStoredEndpointDiagnostics"], "gate": result["reportedGateRecomputed"]}, indent=2))


if __name__ == "__main__":
    main()
