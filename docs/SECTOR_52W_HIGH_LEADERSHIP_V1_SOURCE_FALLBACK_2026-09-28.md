# SECTOR_52W_HIGH_LEADERSHIP_V1 — source fallback freeze

Date: 2026-09-28

Yahoo Chart remains the primary source frozen by the design. Direct Yahoo and Stooq HTTP access are blocked in the current chat runtime before candidate outcomes were opened.

A secondary source is therefore frozen **before economic calculation**:

- provider: Wolfram FinancialData;
- role: `REAL_SECONDARY`;
- required fields: daily raw Open, raw Close and AdjustedClose;
- adjusted open: `rawOpen * AdjustedClose / rawClose`;
- adjusted close: provider AdjustedClose;
- currency required: USD;
- no missing-session intersection, survivor renormalization or synthetic fill.

This fallback may produce an economic PASS/FAIL claim only if an issuer-official reconciliation is documented. At minimum, the Select Sector ETF series must be checked against State Street official NAV/market-value performance over fixed periods independent of candidate selection. A material unexplained discrepancy blocks economic claims as `INCONCLUSIVE_DATA_RECONCILIATION`.

The fallback is not chosen because of candidate performance. No candidate return was calculated before this freeze. Production remains `LEGACY`.


## Frozen reconciliation tolerance

Before computing the candidate's historical return, the fallback acceptance threshold is fixed as follows:

- for each of XLB, XLE, XLF, XLI, XLK, XLP, XLU, XLV and XLY;
- compare Wolfram AdjustedClose 10-year annualized total return ending on the issuer performance as-of date with State Street official **NAV** and **Market Value** 10-year annualized returns;
- absolute difference must be <= **0.20 percentage points/year** versus both reported figures for every fund;
- any failure => `INCONCLUSIVE_DATA_RECONCILIATION`;
- no averaging away a failed ticker and no substitution after candidate outcomes.

The 0.20 pp/year tolerance was frozen before the candidate's diagnostic return was calculated.
