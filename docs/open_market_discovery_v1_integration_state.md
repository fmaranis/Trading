# OPEN_MARKET_DISCOVERY_V1 — integration state

Status date: 2026-09-08.

## Final state

**CURRENT_LIVE_INTEGRATION_PASS / CORE_ELIGIBILITY_V2_SHADOW / HISTORICAL_REPLAY_UNCHANGED**.

No new user-facing section or parallel engine was created. The existing `AssetUniverseScanner` is the single integration point, so Decisión de hoy and backend alerts inherit current/live discovery through their existing path.

## Infrastructure validation consumed

The first local infrastructure job `open-market-discovery-v1-validation` returned `PASS` and demonstrated the complete current/live chain:

`Yahoo structural query sweep -> EUR candidates -> AssetUniverseScanner -> CORE_ELIGIBILITY_V2 shadow -> PortfolioCandidateGate`.

Observed first smoke:
- query families: 12;
- query failures: 0;
- raw Yahoo candidates: 27;
- EUR candidates accepted by discovery: 3;
- discovered candidates accepted with REAL provenance: 3 / 3;
- all discovered candidates were rejected by `PortfolioCandidateGate` at that observation date because they did not beat cash;
- `CORE_ELIGIBILITY_V2` stayed shadow-only.

This PASS validates infrastructure only, not investment performance.

## Current/live integration PASS

Final local job `open-market-live-scanner-integration` completed on 2026-09-08 with:

- result status: `PASS`;
- base canonical universe: 64 assets;
- automatically promoted current EUR ETFs: 2;
- total scanned after additive merge: 66;
- scanner accepted: 62;
- scanner rejected: 4;
- `OPEN_*` candidates: 2;
- `OPEN_*` accepted with REAL provenance: 2 / 2;
- discovery error: `null`;
- open candidates eligible after economic gate: 0 / 2;
- `XAD5.MI`: `REJECTED / DOES_NOT_BEAT_CASH`;
- `SGLE.MI`: `REJECTED / DOES_NOT_BEAT_CASH`;
- `CORE_ELIGIBILITY_V2`: shadow-only;
- new UI section created: false;
- historical replay modified: false.

The integration therefore demonstrates both sides of the intended contract: discovery can add REAL current candidates, and those candidates still cannot bypass the existing economic gate.

## Additive merge invariant

During integration validation a bug was found in the first merge implementation: deduplicating the *base* catalogue by ISIN could remove intentional listing aliases such as `IS3N/EIMI` and `DBX0AN/XEON` while adding new instruments.

The invariant is now explicit and guarded:
- the validated base catalogue is preserved exactly and in order;
- discovery may only add candidates;
- new candidates are deduplicated against the base and against each other by ticker/ISIN;
- discovery must never shrink or silently replace the existing universe.

## Runtime routing invariant

Server-side discovery calls use a dedicated internal URL chain:

`OPEN_MARKET_DISCOVERY_INTERNAL_BASE_URL -> ALERT_INTERNAL_BASE_URL -> http://127.0.0.1:3000`.

`APP_URL` is intentionally excluded from this technical internal request because preview/deployment front-door URLs may return the SPA HTML instead of the JSON route. Response `Content-Type` is also checked before parsing.

## Current/live activation conditions

`AssetUniverseScanner` attempts automatic discovery only when:
1. the caller passes the canonical `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` object;
2. `endDate` is within seven calendar days of today;
3. `currentOpenDiscovery !== false`.

V1 automatic promotion remains deliberately restricted to current EUR ETFs with at least 252 inspected bars. Manual explicit search remains broader.

Temporary discovery failure is additive/fail-open: the scanner records the discovery error and continues with the previously validated curated universe.

## Economic authority

Discovery only expands candidates. It cannot bypass:
- `PortfolioCandidateGate`;
- cash hurdle;
- strategy consensus;
- structural-downtrend rejection;
- `EntryTimingEngine`;
- current opportunity alert gating.

`CORE_ELIGIBILITY_V2` remains `SHADOW_AUDIT_NOT_PRODUCTION_GATE`.

## Historical boundary

Historical replay remains unchanged and contains no call to `/asset-discovery` or `/open-universe`. Current Yahoo search results are not used to invent a past market universe.

Pre-listing look-ahead can be blocked using REAL bars available by each decision date, but full survivorship bias is not solved until a point-in-time instrument master with historical listings and delistings is available. Therefore the project must not claim a complete historical open-market reconstruction yet.

## Next phase

OPEN_MARKET_DISCOVERY_V1 is closed as a current/live integration PASS. The next active research phase is **opportunity/ranking**, using the same `PortfolioCandidateGate` and the same current `CORE_ARCHITECTURE_V1` replay. Existing ranking policies `LEGACY`, `QUALITY_V1` and `SLOPE_V1` are compared causally without changing gates, sizing, replay mechanics or production behavior.
