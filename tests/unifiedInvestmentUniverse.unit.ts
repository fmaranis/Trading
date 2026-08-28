import { EUR_ASSET_UNIVERSE } from '../src/investment/decision';

let passed = 0;
function check(name: string, condition: boolean) { if (!condition) throw new Error(`FAIL ${name}`); passed++; console.log(`✓ ${name}`); }

const globalFund = EUR_ASSET_UNIVERSE.find(x => x.assetId === 'FUND_VANGUARD_GLOBAL');
const emergingFund = EUR_ASSET_UNIVERSE.find(x => x.assetId === 'FUND_VANGUARD_EMERGING');
const etfs = EUR_ASSET_UNIVERSE.filter(x => x.instrumentType !== 'MUTUAL_FUND');
const funds = EUR_ASSET_UNIVERSE.filter(x => x.instrumentType === 'MUTUAL_FUND');

check('601 unified universe contains an expanded mutual-fund discovery set', funds.length >= 8 && Boolean(globalFund) && Boolean(emergingFund));
check('602 global fund uses exact ISIN', globalFund?.isin === 'IE00B03HD191' && globalFund?.ticker === 'IE00B03HD191');
check('603 emerging fund uses exact ISIN', emergingFund?.isin === 'IE0031786696' && emergingFund?.ticker === 'IE0031786696');
check('604 funds load NAV through EODHD fund provider', funds.every(x => x.marketDataProvider === 'EODHD_FUND'));
check('605 global fund competes in GLOBAL_EQUITY category', globalFund?.category === 'GLOBAL_EQUITY');
check('606 emerging fund competes in EMERGING_EQUITY category', emergingFund?.category === 'EMERGING_EQUITY');
check('607 listed ETF universe remains present', etfs.length >= 30);
check('608 every instrument is EUR', EUR_ASSET_UNIVERSE.every(x => x.currency === 'EUR'));
check('609 mutual funds are not marked defensive by accident', funds.every(x => !x.defensive));
check('610 asset ids remain unique', new Set(EUR_ASSET_UNIVERSE.map(x => x.assetId)).size === EUR_ASSET_UNIVERSE.length);

console.log(`Unified investment universe: ${passed}/10 invariants passed. Catalogue=${EUR_ASSET_UNIVERSE.length}, funds=${funds.length}, listed=${etfs.length}.`);
