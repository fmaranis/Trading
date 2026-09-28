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
