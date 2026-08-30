import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

const singleAsset = readFileSync('src/components/SingleAssetResearchPanel.tsx', 'utf8');
const researchLab = readFileSync('src/components/InvestmentResearchLab.tsx', 'utf8');
const decisionCenter = readFileSync('src/components/InteractiveInvestmentDecisionCenter.tsx', 'utf8');

test('961 ticker/ISIN draft is isolated from the heavy chart state', () => {
  assert.match(singleAsset, /const \[draftSymbol, setDraftSymbol\] = useState\(currentSymbol\)/);
  assert.match(singleAsset, /setDraftSymbol\(e\.target\.value\.toUpperCase\(\)\)/);
});

test('962 research screen does not auto-run NVDA when opened without an explicit asset', () => {
  assert.doesNotMatch(singleAsset, /analyzeSymbol\(['"]NVDA['"]\)/);
});

test('963 individual research only auto-runs when requestedSymbol is explicit', () => {
  assert.match(singleAsset, /const clean = requestedSymbol\?\.trim\(\)\.toUpperCase\(\);/);
  assert.match(singleAsset, /if \(clean\) void analyzeSymbol\(clean\)/);
});

test('964 external holdout scan is user-triggered rather than a mount effect', () => {
  assert.match(researchLab, /const loadExternalScan = async \(\) =>/);
  assert.match(researchLab, /Cargar validación externa/);
  assert.doesNotMatch(researchLab, /useEffect\(\(\) => \{[\s\r\n]*[^}]*AssetUniverseScanner\.scan\(EUR_VALIDATION_HOLDOUT_UNIVERSE/);
});

test('965 live decision scan uses the bounded three-year window', () => {
  assert.match(decisionCenter, /function liveDecisionHistoryStart\(\)/);
  assert.match(decisionCenter, /setUTCFullYear\(d\.getUTCFullYear\(\) - 3\)/);
  assert.match(decisionCenter, /EUR_PORTFOLIO_DISCOVERY_UNIVERSE,[\s\S]{0,120}liveDecisionHistoryStart\(\)/);
  assert.doesNotMatch(decisionCenter, /sevenYearsAgo/);
});

test('966 long-history robustness modules remain separate from this live-window change', () => {
  assert.match(researchLab, /HistoricalDecisionReplayPanel/);
  assert.doesNotMatch(decisionCenter, /HistoricalDecisionReplayEngine|DynamicHistoricalReplayEngine/);
});

test('967 mobile research keeps a real manual text input without datalist interception', () => {
  assert.match(singleAsset, /id="research-symbol-input"/);
  assert.match(singleAsset, /type="text"/);
  assert.match(singleAsset, /inputMode="text"/);
  assert.match(singleAsset, /symbolInputRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(singleAsset, /<datalist|list="research-symbol-suggestions"/);
});

test('968 catalog suggestions are unified in an interactive dropdown without dual input boxes', () => {
  assert.match(singleAsset, /filteredSuggestions/);
  assert.match(singleAsset, /selectSymbol/);
  assert.match(singleAsset, /filteredSuggestions\.map\(item =>/);
  assert.doesNotMatch(singleAsset, /<select value="" onChange=\{e => selectCatalogSymbol/);
});

console.log(`UI responsiveness contracts: ${passed}/8 invariants passed.`);
