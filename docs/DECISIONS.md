# Trading — Permanent Architecture & Product Decisions

This document records durable decisions that should survive chat changes. Operational status and the next task live in `PROJECT_STATE.md`.

## D1. Repository is the memory source of truth

**Decision:** `fmaranis/Trading/main` is canonical. Chat memory is supplementary only.

**Reason:** work happens across desktop/mobile and multiple chats; relying on conversation continuity loses implementation state.

**Rule:** after meaningful project work, update `PROJECT_STATE.md`. New chats should read it first.

## D2. No GitHub Actions dependency

**Decision:** do not add or rely on GitHub Actions for validation or operation.

**Reason:** project validation is intentionally local/manual and the owner does not want a paid Actions dependency.

**Allowed:** deterministic npm scripts, local AI Studio execution, local/server tests, Git history for rollback.

## D3. Research/decision support, not autonomous trade execution

**Decision:** the application may analyse, rank, backtest, alert and propose execution plans, but it must not pretend to place broker trades unless a future explicit broker integration is implemented and verified.

**Rule:** distinguish theoretical allocation from broker-executable orders.

## D4. REAL data never silently becomes synthetic

**Decision:** `REAL` requests must either return validated real data or fail explicitly.

**Reason:** synthetic fallback would contaminate backtests and decision evidence without the user knowing.

**Rule:** provenance and dataset fingerprints remain first-class outputs.

## D5. Yahoo Finance primary, EODHD secondary

**Decision:** Yahoo Finance is currently the primary daily historical market-data source. EODHD is secondary for cross-validation and fund data.

**Reason:** Yahoo provides broad practical coverage without an API key; EODHD adds independent evidence and fund/NAV capabilities.

**Constraints:**

- Yahoo is unofficial/non-contractual and must be labelled accordingly.
- EODHD failures/quota limits are non-blocking for the primary Yahoo path.
- EODHD credentials remain server-side.
- Do not call daily historical data “real time”.

## D6. Cross-provider discrepancies are evidence, not hidden corrections

**Decision:** compare providers explicitly rather than silently replacing one price with another.

**Current policy:** EODHD cross-check route uses a 1% tolerance for `MATCH` vs `PRICE_DIVERGENCE`.

**Reason:** differences can arise from adjustment conventions, timing/listing mapping or genuine data issues and should remain auditable.

## D7. Cache secondary-provider checks

**Decision:** EODHD cross-check results are cached for 24 h for unchanged ticker/date/close inputs; fund-history data currently uses a shorter cache.

**Reason:** avoid unnecessary API usage and quota exhaustion while preserving sufficiently fresh daily-data validation.

**Rule:** validation should report cache hits and upstream calls so cache behaviour is observable.

## D8. Causal backtests are mandatory for decision claims

**Decision:** any historical decision/selection validation must use only information available at the historical decision date.

**Execution convention:** information through `Close(t-1)`; execution at `Open(t)` where the engine models NEXT_OPEN.

**Rule:** future-data mutation tests should remain part of causal test coverage.

## D9. Current-catalog causal reselection is not survivorship-bias-free

**Decision:** causal universe backtesting across the currently queryable catalog may be used as research evidence but must retain a residual-bias warning.

**Reason:** delisted/no-longer-queryable historical instruments are not represented.

**Future improvement:** point-in-time universe/listing metadata if stronger institutional-grade historical universe claims are required.

## D10. Scanner diversification by exposure category

**Decision:** shortlist selection currently permits at most one selected asset per category and tries to retain a defensive exposure when available.

**Reason:** prevent multiple near-equivalent high-scoring listings from dominating the shortlist.

**Known limitation:** this is not yet equivalent to full ISIN/exposure deduplication or correlation-aware selection.

## D11. Confidence is evidence quality, not probability of profit

**Decision:** decision-engine confidence communicates quality/recency/sufficiency of evidence, not expected win rate or probability of positive return.

**Current cap:** 85 while provider breadth and universe validation remain limited.

**Rule:** UI/report wording must preserve this distinction.

## D12. Risk-profile methods

Current default decision mapping:

- LOW → Inverse Volatility;
- MEDIUM → Risk Parity ERC;
- HIGH → Relative Momentum.

Regime logic may increase cash defensively. Changes to this mapping require explicit tests and an update to this document.

## D13. Broker constraints must alter the executable plan

**Decision:** theoretical fractional allocations must not be shown as directly executable at a whole-share broker.

**Current MyInvestor model:**

- ETF fractions: not supported in the model;
- commission: 0.12%;
- minimum: 1 EUR/order;
- maximum: 25 EUR/order;
- exact instrument availability must be verified by ticker/ISIN before a manual pilot.

**Important:** `executable` meaning “at least one order fits” is insufficient to call a portfolio valid for its requested risk profile.

## D14. Diversification quality is separate from affordability

**Decision:** broker execution must distinguish:

1. whether any whole-share order is affordable;
2. whether the resulting portfolio retains enough diversification, concentration control and cost efficiency for the requested profile.

**Reason:** a 100 EUR MEDIUM theoretical portfolio collapsing to one bond ETF is affordable but no longer represents the intended diversified MEDIUM strategy.

## D15. Small-capital experiments must expose structural limitations

**Decision:** when capital is too low to reproduce a strategy, the app should calculate/report the limitation rather than fake precision with fractional shares.

**Preferred future behaviour:** estimate minimum capital for a suitably diversified whole-share implementation under the selected broker rules.

## D16. Deterministic local validation is the release gate

**Decision:** technical readiness is based on deterministic tests/build plus explicit live-data checks where required.

**Rule:** keep separate concepts for:

- technical/research readiness;
- manual-pilot readiness;
- broker/instrument verification.

A green research suite must not automatically imply that real-money execution is ready.

## D17. Unified fund + ETF evidence is allowed, but provenance must remain explicit

**Decision:** the project may combine supported ETF and fund evidence in a unified investment universe / portfolio-decision layer.

**Reason:** the current repository includes fund portfolio, unified universe and portfolio decision modules.

**Rule:** never blur different providers, price/NAV conventions or data freshness; provenance and wording must state what evidence backs each asset type.

## D18. Opportunity-threshold research stays causal and diagnostic

**Decision:** opportunity alert thresholds may be researched and walk-forward tested, but threshold tuning must remain chronological/causal and should not be marketed as guaranteed alpha.

**Reason:** current repository contains alert outcome, threshold research and walk-forward validation modules.

## D19. Do not overclaim provider or broker verification

**Decision:** code support for a provider/broker rule is not the same as successful live verification of every asset.

Examples:

- one-symbol EODHD smoke test does not validate the whole shortlist;
- MyInvestor public fee/fraction rules do not prove a particular ticker/ISIN is available;
- a successful Yahoo fetch does not prove a second-provider match.

## D20. Backtest costs must be separated from broker-executable costs

**Decision:** a percentage-only commission model may be retained for strategy research, but it must not be interpreted as broker-executable evidence when the broker has a fixed minimum commission per order.

**Current implementation:** `brokerBacktestFeasibility.ts` computes a mathematical lower bound equal to `number of executed orders × broker minimum commission`, compares that lower bound with the modeled backtest commission, and reports the minimum capital required to keep that lower-bound commission drag under an explicit target.

**Reason:** with small capital and high turnover, a model such as 0.05% per trade can materially understate the real economics of a broker charging at least 1 EUR per order.

**Rule:** strategy performance and broker execution feasibility must be reported as separate evidence. A profitable research backtest is not sufficient for manual-pilot readiness if the broker minimum-fee lower bound invalidates the economics.

## Change protocol

When a durable decision changes:

1. modify the relevant section rather than silently contradicting it elsewhere;
2. record the reason;
3. update `PROJECT_STATE.md` if it affects current status or next steps;
4. add/update deterministic tests where the decision changes executable behaviour.
