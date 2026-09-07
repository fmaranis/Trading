# OPEN_MARKET_DISCOVERY_V1 — integration state

Status date: 2026-09-07.

## Infrastructure validation consumed

Local job `open-market-discovery-v1-validation` completed technically and returned `status: PASS`.

Observed result:
- query families: 12;
- query failures: 0;
- raw Yahoo candidates: 27;
- EUR candidates accepted by discovery: 3;
- merged universe: 65;
- scanner accepted: 62 / 65;
- discovered candidates scanned: 3 / 3;
- discovered candidates accepted with REAL provenance: 3 / 3;
- `PortfolioCandidateGate`: all three discovered candidates were REJECTED because they did not beat cash at that observation date;
- `CORE_ELIGIBILITY_V2` stayed `SHADOW_AUDIT_NOT_PRODUCTION_GATE`.

This PASS validates the current/live infrastructure only. It is not evidence of investment performance.

## Current/live integration

`AssetUniverseScanner` is now the single integration point. When all of the following are true:
1. the caller passes the canonical `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` object;
2. `endDate` is within seven calendar days of today;
3. `currentOpenDiscovery !== false`;

the scanner fetches `/api/alerts/asset-discovery/open-universe`, promotes only current EUR ETFs with at least 252 inspected bars, merges them into the existing universe, then runs the normal REAL market-data scan.

No new user-facing section or parallel decision engine is created. Existing current/live consumers such as Decisión de hoy and backend alerts already use this scanner and canonical universe.

Temporary discovery failure is additive/fail-open: the scanner records the discovery error and continues with the validated curated universe instead of disabling decisions.

## Economic authority

Discovery only expands candidates. It cannot bypass:
- `PortfolioCandidateGate`;
- existing consensus/timing checks;
- current opportunity alert gating.

`CORE_ELIGIBILITY_V2` remains shadow-only and is not promoted as a production gate by this integration.

## Historical boundary

Historical replay remains unchanged and contains no call to `/asset-discovery` or `/open-universe`. Current Yahoo query results are not used to reconstruct a past market universe.

Full point-in-time historical open-market reconstruction remains unresolved until an instrument master with historical listings and delistings is available.

## Pending local gate

Current local job:
`open-market-live-scanner-integration`

It runs discovery/core/architecture guards, the new scanner-integration guard, the existing replay guard, TypeScript, and a REAL smoke in which the canonical base universe is passed unchanged to `AssetUniverseScanner`. The smoke must demonstrate that the scanner itself performs the live expansion and that discovered candidates still reach `PortfolioCandidateGate` normally.
