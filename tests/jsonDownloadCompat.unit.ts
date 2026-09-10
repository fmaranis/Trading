import { readFileSync } from 'node:fs';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL ${name}`);
  passed++;
  console.log(`✓ ${name}`);
}

const main = readFileSync('src/main.tsx', 'utf8');
const compat = readFileSync('src/utils/jsonDownloadCompat.ts', 'utf8');
const validation = readFileSync('src/components/ResearchValidationCenter.tsx', 'utf8');
const css = readFileSync('src/index.css', 'utf8');

check('main installs JSON download compatibility before rendering', main.includes('installJsonDownloadCompatibility();') && main.indexOf('installJsonDownloadCompatibility();') < main.indexOf('createRoot('));
check('compatibility is scoped to application/json blobs', compat.includes("application/json"));
check('JSON object URL revocation is delayed', compat.includes('setTimeout') && compat.includes('JSON_BLOB_REVOKE_DELAY_MS'));
check('non-JSON object URLs keep immediate native revocation', compat.includes('if (!jsonBlobUrls.has(url))'));
check('touch bridge targets only Descargar JSON', compat.includes("includes('descargar json')") && compat.includes("event.pointerType === 'touch'"));
check('touch bridge has duplicate activation guard', compat.includes('TOUCH_RETRIGGER_GUARD_MS') && compat.includes('lastForcedActivation'));
check('mobile controls use manipulation touch action', css.includes('touch-action: manipulation'));
check('coarse pointer controls have 44px minimum target', css.includes('@media (pointer: coarse)') && css.includes('min-height: 44px'));
check('mobile form controls avoid small-font zoom', css.includes('font-size: 16px'));
check('phone layout hides duplicated desktop tab navigation', css.includes('#main-header nav') && css.includes('@media (max-width: 767px)'));
check('phone layout hides duplicate quick desktop actions', css.includes('#btn-quick-backtest') && css.includes('#btn-switch-bot') && css.includes('#btn-reset-portfolio'));
check('mobile validation actions expand to easy tap width', css.includes('#research-validation-center button') && css.includes('width: 100%'));
check('ResearchValidationCenter still exports full JSON result payload', validation.includes("JSON.stringify(payload, null, 2)") && validation.includes('jobId: job.id') && validation.includes('result: job.result'));

console.log(`JSON/mobile touch compatibility: ${passed}/13 invariants passed.`);
