import assert from 'node:assert/strict';
import { validateTimesFmMultivariateRunnerStatus } from '../scripts/timesfmMultivariateContextV1RunnerReadiness.mjs';

const valid={
  study:'TIMESFM_MULTIVARIATE_CONTEXT_V1',
  status:'READY_TIMESFM_MULTIVARIATE_CONTEXT_V1',
  apiVersion:3,
  maxAnchorsPerCall:8,
  gpuDurationSeconds:45,
  targetCount:9,
  pastOnlyCovariateCount:23,
  contextLength:512,
  forecastHorizon:60,
  productionAuthority:false,
  productionDefault:'LEGACY'
};

const checks=validateTimesFmMultivariateRunnerStatus(valid);
assert.equal(Object.values(checks).every(Boolean),true);

for(const [key,value] of [
  ['apiVersion',2],
  ['maxAnchorsPerCall',31],
  ['gpuDurationSeconds',120],
  ['targetCount',8],
  ['pastOnlyCovariateCount',22],
  ['contextLength',256],
  ['forecastHorizon',20],
  ['productionAuthority',true],
  ['productionDefault','TIMESFM']
]){
  assert.throws(
    ()=>validateTimesFmMultivariateRunnerStatus({...valid,[key]:value}),
    /TIMESFM_MULTIVARIATE_RUNNER_VERSION_REQUIRED/
  );
}

console.log('timesfmMultivariateContextV1RunnerReadiness.unit: PASS');
