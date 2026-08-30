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
const marketDashboard = readFileSync('src/components/MarketUtilityDashboard.tsx', 'utf8');
const currentOpportunity = readFileSync('src/components/CurrentOpportunityAlertsPanel.tsx', 'utf8');

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

test('968 catalog suggestions are unified in the same interactive search box', () => {
  assert.match(singleAsset, /filteredSuggestions/);
  assert.match(singleAsset, /selectSymbol/);
  assert.match(singleAsset, /filteredSuggestions\.map\(item =>/);
  assert.match(singleAsset, /buscador y listado/);
});

test('969 research uses one search/analyzer surface instead of parallel catalog and radar search boxes', () => {
  assert.equal((researchLab.match(/<SingleAssetResearchPanel/g) ?? []).length, 1);
  assert.doesNotMatch(researchLab, /Explorar catálogo ampliado/);
  assert.doesNotMatch(researchLab, /Filtrar ticker, nombre o categoría/);
  assert.match(researchLab, /Buscador único/);
  assert.match(researchLab, /No se crean buscadores paralelos para la misma tarea/);
});

test('970 ranking candidates route back into the same analyzer instead of opening another module', () => {
  assert.match(researchLab, /const openAsset = \(symbol: string\) =>/);
  assert.match(researchLab, /setSelectedSymbol\(symbol\.toUpperCase\(\)\)/);
  assert.match(researchLab, /onClick=\{\(\) => openAsset\(c\.asset\.ticker\)\}/);
  assert.match(researchLab, /Ranking y oportunidades del mismo estudio/);
});

test('971 portfolio surface starts from one action-first decision', () => {
  assert.match(currentOpportunity, /Decisión de hoy/);
  assert.match(currentOpportunity, /HOY: INVERTIR/);
  assert.match(currentOpportunity, /HOY: NO MOVER DINERO/);
  assert.match(currentOpportunity, /fundedAlerts/);
  assert.match(currentOpportunity, /structuralSales/);
  assert.doesNotMatch(currentOpportunity, /Dónde pondría dinero hoy/);
});

test('972 unfunded opportunities are secondary rather than competing recommendations', () => {
  assert.match(currentOpportunity, /Otras oportunidades válidas que hoy no reciben dinero/);
  assert.match(currentOpportunity, /no le asigna capital hoy por prioridad relativa, riesgo o concentración/);
});

test('973 duplicate execution plan is demoted inside explanation details', () => {
  assert.match(marketDashboard, /<CurrentOpportunityAlertsPanel[\s\S]*<details[\s\S]*PortfolioExecutionPlanPanel/);
  assert.match(marketDashboard, /Son explicaciones de la decisión superior, no recomendaciones independientes/);
});

test('974 data confidence is labelled as data quality and never presented as profit probability', () => {
  assert.doesNotMatch(decisionCenter, />Evidencia \{result\.confidence\}/);
  assert.match(decisionCenter, /Calidad de datos \{result\.confidence\}/);
  assert.match(decisionCenter, /No es probabilidad de beneficio ni convicción de una compra/);
  assert.match(decisionCenter, /<MarketUtilityDashboard[\s\S]*Datos y controles técnicos de la decisión/);
});

console.log(`UI responsiveness contracts: ${passed}/14 invariants passed.`);
