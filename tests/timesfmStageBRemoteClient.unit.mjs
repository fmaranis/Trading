import assert from 'node:assert/strict';
import http from 'node:http';
import { callTimesFmStageB, TIMESFM_STAGE_B_STUDY } from '../scripts/timesfmStageBRemoteClient.mjs';

let submitted = null;
let submittedAuthorization = null;
let resultAuthorization = null;
const events = new Map();
let nextId = 0;
const server = http.createServer(async (req, res) => {
  const match = /^\/gradio_api\/call\/stage_b_predict(?:\/([^/]+))?$/.exec(req.url || '');
  if (!match) { res.statusCode = 404; res.end('not found'); return; }
  const eventId = match[1];
  if (req.method === 'POST' && !eventId) {
    let body = '';
    for await (const chunk of req) body += String(chunk);
    submitted = JSON.parse(body);
    submittedAuthorization = req.headers.authorization ?? null;
    const id = `evt-${++nextId}`;
    const requestPayload = submitted.data[0];
    events.set(id, {
      study: TIMESFM_STAGE_B_STUDY,
      status: 'PASS_STAGE_B_INFERENCE_BATCH',
      caseCount: requestPayload.cases.length,
      cases: requestPayload.cases.map(c => ({
        caseId: c.caseId,
        mvAssetPoint: {'1':101,'5':102,'20':104,'60':108},
        mvCorePoint: {'1':100.5,'5':101,'20':102,'60':104},
        mvAssetQuantiles: {'1':[99,100,100,100,101,102,102,103,104],'5':[99,100,101,101,102,103,104,105,106],'20':[98,100,101,102,104,106,108,110,112],'60':[95,98,100,103,108,112,116,120,125]},
        mvAssetPath60: Array.from({length:60}, (_,i)=>100+i*0.1),
        uvAssetPoint: {'1':100.8,'5':101.5,'20':103,'60':106}
      }))
    });
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({event_id:id}));
    return;
  }
  if (req.method === 'GET' && eventId) {
    const value = events.get(eventId);
    resultAuthorization = req.headers.authorization ?? null;
    if (!value) { res.statusCode=404; res.end('missing'); return; }
    res.setHeader('Content-Type','text/event-stream');
    res.end(`event: complete\ndata: ${JSON.stringify([value])}\n\n`);
    return;
  }
  res.statusCode=405; res.end('method not allowed');
});

await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const address=server.address();
assert.ok(address && typeof address === 'object');
const payload={
  study: TIMESFM_STAGE_B_STUDY,
  cases:[{
    caseId:'2018Q1|SXR8',
    assetContext:Array.from({length:512},(_,i)=>100+i*0.01),
    coreContext:Array.from({length:512},(_,i)=>100+i*0.005)
  }]
};
process.env.HF_TOKEN='hf_test_timesfm_stage_b';
const result=await callTimesFmStageB(payload,{baseUrl:`http://127.0.0.1:${address.port}`,timeoutMs:5000});
delete process.env.HF_TOKEN;
await new Promise(resolve => server.close(resolve));

assert.equal(result.status,'PASS_STAGE_B_INFERENCE_BATCH');
assert.equal(result.cases.length,1);
assert.equal(result.cases[0].caseId,'2018Q1|SXR8');
assert.deepEqual(submitted,{data:[payload]});
assert.equal(submittedAuthorization,'Bearer hf_test_timesfm_stage_b');
assert.equal(resultAuthorization,'Bearer hf_test_timesfm_stage_b');
assert.equal(JSON.stringify(submitted).includes('future'),false);
assert.equal(JSON.stringify(submitted).includes('outcome'),false);
console.log('timesfmStageBRemoteClient.unit: PASS');
