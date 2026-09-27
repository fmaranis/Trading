import fs from 'node:fs';

const inputPath=process.argv[2] ?? 'validation-runs/diagnostics/core-outperformance-profitability-exus-generalization-v1-input.json';
const input=JSON.parse(fs.readFileSync(inputPath,'utf8'));
function values(obj,start,end){return Object.entries(obj).filter(([d])=>d>=start.replace('-','')&&d<=end.replace('-','')).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>Number(v));}
function stats(xs){const rs=xs.map(v=>v/100);let w=1,p=1,dd=0;const m=rs.reduce((a,b)=>a+b,0)/rs.length;const sd=Math.sqrt(rs.reduce((s,x)=>s+(x-m)**2,0)/(rs.length-1));for(const r of rs){w*=1+r;p=Math.max(p,w);dd=Math.min(dd,w/p-1);}return{months:xs.length,totalReturnPct:(w-1)*100,cagrPct:(Math.pow(w,12/xs.length)-1)*100,annualizedVolPct:sd*Math.sqrt(12)*100,maxMonthlyPathDrawdownPct:dd*100};}
const defs=[['2009_2014','2009-01','2014-12'],['2016_2021','2016-01','2021-12']];
const windows=defs.map(([id,start,end])=>{const c=stats(values(input.candidate.monthlyPct,start,end));const b=stats(values(input.benchmark.monthlyPct,start,end));if(c.months!==72||b.months!==72)throw new Error('EXUS_COVERAGE_MISMATCH:'+id);return{id,start,end,candidate:c,benchmark:b,excessCagrPctPoints:c.cagrPct-b.cagrPct,passed:c.cagrPct>b.cagrPct};});
const out={schemaVersion:1,study:input.study,status:windows.every(w=>w.passed)?'PASS_GEOGRAPHIC_GENERALIZATION':'FAIL_GEOGRAPHIC_GENERALIZATION',windows,productionDefault:'LEGACY',productionAuthority:false};
console.log(JSON.stringify(out,null,2));
