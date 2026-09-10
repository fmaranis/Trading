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

check('main installs JSON download compatibility before rendering', main.includes('installJsonDownloadCompatibility();') && main.indexOf('installJsonDownloadCompatibility();') < main.indexOf('createRoot('));
check('compatibility is scoped to application/json blobs', compat.includes("application/json"));
check('JSON object URL revocation is delayed', compat.includes('setTimeout') && compat.includes('JSON_BLOB_REVOKE_DELAY_MS'));
check('non-JSON object URLs keep immediate native revocation', compat.includes('if (!jsonBlobUrls.has(url))'));
check('ResearchValidationCenter still exports full JSON result payload', validation.includes("JSON.stringify(payload, null, 2)") && validation.includes('jobId: job.id') && validation.includes('result: job.result'));

console.log(`JSON download compatibility: ${passed}/5 invariants passed.`);
