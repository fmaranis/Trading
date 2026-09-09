# OPEN_MARKET_DISCOVERY_V1 — integration state

Original infrastructure status date: **2026-09-08**.

Current architecture amendment: **2026-09-09**.

## Current state

**CURRENT_LIVE_INTEGRATION_PASS / DYNAMIC_TOP64_EXPANSION_IMPLEMENTED_PENDING_LIVE_VALIDATION / CORE_ELIGIBILITY_V2_SHADOW / HISTORICAL_REPLAY_UNCHANGED**.

No new user-facing section or parallel engine exists. `AssetUniverseScanner` remains the single integration point, so Decisión de hoy and backend alerts inherit current/live discovery through their existing path.

The original 2026-09-08 PASS below remains historical infrastructure evidence. Since 2026-09-09 the current/live contract has been broadened to satisfy `CORE_DYNAMIC_MARKET_SELECTION_ARCHITECTURE`.

## 2026-09-09 amendment — dynamic market shortlist

Permanent product invariant:

- 64 means **dynamic shortlist target**, never 64 permanent instrument names;
- `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` is seed/bootstrap/fallback;
- rules select current candidates; identities may change every evaluation.

The current discovery sweep now includes structural query families for:

- ETF/ETC broad, sector and defensive exposures;
- EUR-listed equities across major European markets;
- technology, semiconductors, healthcare, energy and dividend equities;
- EUR listings of large US companies when Yahoo exposes them.

Automatic current/live promotion now accepts:

- `ETF`;
- `EQUITY`;

when currency is EUR, inspected history is >=252 bars and the snapshot explicitly remains `historicalPointInTimeSafe: false`.

`AssetUniverseScanner` ranks the REAL accepted current pool into up to **64** candidates using `MARKET_SHORTLIST_LEGACY_SCORE_V1`. The principal ranking remains the existing scanner score; Reliability/Opportunity only break ties, so this change does not silently promote `QUALITY_V1`.

The Top64 IDs are persisted in `dynamicMarketShortlist.shortlistAssetIds`. `PortfolioCandidateGate` then rejects any accepted pool member outside those IDs with `OUTSIDE_DYNAMIC_MARKET_SHORTLIST` before cash/consensus/timing. Diversification remains downstream in the gate/allocator.

Validation job:

`dynamic-market-top64-v1` / **Mercado dinámico · Top 64 current/live**.

Expected live marker:

`PASS_DYNAMIC_MARKET_TOP64_CURRENT_LIVE`.

Until that job runs, the new breadth/Top64 code is **implemented but not yet declared live PASS**.

Important coverage wording: Yahoo query search is broad current/live discovery but is not an exhaustive global instrument master. “Top64” therefore means the best ranked candidates in the current discovered EUR-compatible pool.

## Infrastructure validation consumed — 2026-09-08

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

This PASS validates the original infrastructure only, not investment performance and not the later Top64 breadth.

## Original current/live integration PASS — 2026-09-08

Final local job `open-market-live-scanner-integration` completed with:

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

Those numbers are historical observations from the old narrower sweep, not current configuration constants.

## Additive merge invariant

During integration validation a bug was found in the first merge implementation: deduplicating the *base* catalogue by ISIN could remove intentional listing aliases such as `IS3N/EIMI` and `DBX0AN/XEON` while adding new instruments.

The invariant remains:
- the validated seed catalogue is preserved exactly and in order;
- discovery may only add candidates;
- new candidates are deduplicated against the seed and against each other by ticker/ISIN;
- discovery must never shrink or silently replace the seed.

## Runtime routing invariant

Server-side discovery calls use:

`OPEN_MARKET_DISCOVERY_INTERNAL_BASE_URL -> ALERT_INTERNAL_BASE_URL -> http://127.0.0.1:3000`.

`APP_URL` is intentionally excluded from this technical internal request because preview/deployment front-door URLs may return SPA HTML instead of the JSON route. Response `Content-Type` is checked before parsing.

## Current/live activation conditions

`AssetUniverseScanner` attempts automatic discovery only when:
1. the caller passes the canonical `EUR_PORTFOLIO_DISCOVERY_UNIVERSE` object;
2. `endDate` is within seven calendar days of today;
3. `currentOpenDiscovery !== false`.

Temporary discovery failure is additive/fail-open: the scanner records the discovery error and continues with the validated seed/fallback.

In current/live canonical mode the scanner still produces the Top64 from whatever valid pool remains; a discovery outage therefore degrades breadth explicitly rather than disabling the decision engine or introducing synthetic data.

## Economic authority

Discovery/Top64 only produces candidates. It cannot bypass:
- `PortfolioCandidateGate`;
- cash hurdle;
- strategy consensus;
- structural-downtrend rejection;
- `EntryTimingEngine`;
- allocator/caps;
- current opportunity alert gating.

`CORE_ELIGIBILITY_V2` remains `SHADOW_AUDIT_NOT_PRODUCTION_GATE`.

Production allocation remains `LEGACY`.

## Historical boundary

Historical replay remains unchanged and contains no call to `/asset-discovery` or `/open-universe`. Current Yahoo search results are not used to invent a past market universe.

Pre-listing look-ahead can be blocked using REAL bars available by each decision date, but full survivorship bias is not solved until a point-in-time instrument master with historical listings and delistings is available. Therefore the project must not claim a complete historical open-market reconstruction yet.
