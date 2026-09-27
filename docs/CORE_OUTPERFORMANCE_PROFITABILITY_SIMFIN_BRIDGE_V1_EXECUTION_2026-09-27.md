# SimFin profitability bridge V1 — execution

Date: 2026-09-27

Status: **INCONCLUSIVE_PRICE_OR_COVERAGE / NO ECONOMIC VERDICT / NO PRODUCTION AUTHORITY**

The bridge was preregistered before price outcomes and passed its frozen fundamentals coverage gates.

## What opened

- 2020 formation: selected-price coverage 100%.
- 2021 formation: selected-price coverage 100%.
- 2022 formation: price extraction stopped because selected ticker `CTXS` has no listed endpoint on 2023-07-03.

Citrix completed its take-private transaction on 2022-09-30. Its shares were converted into the right to receive USD 104 cash per share and ceased public trading.

## Frozen-rule consequence

V1 required:

- listed adjusted-open endpoint;
- 100% selected-position outcome coverage;
- no survivor renormalization;
- no post-hoc terminal-value rule.

Therefore:

`INCONCLUSIVE_PRICE_OR_COVERAGE`

No chained CAGR is computed.

## Methodological consequence

The missing CTXS endpoint exposes an infrastructure requirement: historical stock replay must model corporate actions / cash mergers / delistings explicitly **before** opening a sample.

The known USD 104 merger consideration cannot be added retrospectively to make V1 evaluable. This sample is now consumed for such a rule.

Strict SEC PIT stays unopened and blocked. Future-forward V1 remains unchanged. Production remains `LEGACY`.
