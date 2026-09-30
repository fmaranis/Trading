import assert from 'node:assert/strict';
import {
  createYahooSession,
  fetchYahooCalendarRange
} from '../scripts/peadYahooCalendarSourceAuditR2.mjs';

function headers(setCookies=[]){
  return {
    getSetCookie:()=>setCookies,
    get:name=>name.toLowerCase()==='set-cookie'?(setCookies[0]??null):null
  };
}
function response(status,body,setCookies=[]){
  return {
    ok:status>=200&&status<300,
    status,
    headers:headers(setCookies),
    text:async()=>body
  };
}
function pagePayload(offset,count){
  const rows=[];
  for(let i=0;i<count;i++){
    const n=offset+i;
    rows.push([
      'T'+String(n).padStart(4,'0'),
      '2024-02-'+String(1+(n%20)).padStart(2,'0')+'T08:00:00-05:00',
      'BMO',
      1,
      1.2,
      20
    ]);
  }
  return JSON.stringify({
    finance:{result:[{documents:[{
      columns:[
        {label:'Symbol',type:'STRING'},
        {label:'Event Start Date',type:'DATE'},
        {label:'Event Start Date',type:'STRING'},
        {label:'EPS Estimate',type:'NUMBER'},
        {label:'Reported EPS',type:'NUMBER'},
        {label:'Surprise (%)',type:'NUMBER'}
      ],
      rows
    }]}],error:null}
  });
}

const authCalls=[];
const authFetch=async (url,options={})=>{
  authCalls.push({url:String(url),options});
  if(String(url)==='https://fc.yahoo.com')return response(404,'',['A3=abc; Path=/; Secure']);
  if(String(url).includes('/v1/test/getcrumb'))return response(200,'crumb-123',['A1=def; Path=/; Secure']);
  throw new Error('UNEXPECTED_AUTH_URL:'+url);
};
const session=await createYahooSession(authFetch);
assert.equal(session.crumb,'crumb-123');
assert.match(session.cookie,/A3=abc/);
assert.match(session.cookie,/A1=def/);
assert.equal(authCalls.length,2);
assert.match(String(authCalls[1].options.headers.Cookie),/A3=abc/);

const pageCalls=[];
const pageFetch=async (url,options={})=>{
  pageCalls.push({url:String(url),options});
  const body=JSON.parse(String(options.body));
  assert.equal(body.size,100);
  assert.equal(body.entityIdType,'sp_earnings');
  assert.equal(body.sortField,'startdatetime');
  assert.equal(body.sortType,'ASC');
  assert.equal(/ITOT|MOST_ACTIVE|symbols|tickers/i.test(JSON.stringify(body)),false);
  if(body.offset===0)return response(200,pagePayload(0,100));
  if(body.offset===100)return response(200,pagePayload(100,3));
  throw new Error('UNEXPECTED_OFFSET:'+body.offset);
};
const live=await fetchYahooCalendarRange(pageFetch,session);
assert.equal(live.rows.length,103);
assert.equal(live.pages.length,2);
assert.equal(live.pages[0].offset,0);
assert.equal(live.pages[0].rowCount,100);
assert.equal(live.pages[1].offset,100);
assert.equal(live.pages[1].rowCount,3);
assert.equal(live.terminalPageSeen,true);
assert.equal(pageCalls.length,2);
for(const call of pageCalls){
  assert.match(call.url,/crumb=crumb-123/);
  assert.equal(call.options.method,'POST');
  assert.match(call.options.headers.Cookie,/A3=abc/);
}

const errorFetch=async()=>response(401,'{"finance":{"error":{"code":"Unauthorized"}}}');
await assert.rejects(
  ()=>fetchYahooCalendarRange(errorFetch,{...session}),
  /PEAD_R2_YAHOO_HTTP_401/
);

console.log('PEAD_EARNINGS_SOURCE_AUDIT_R2_INTEGRATION_PASS');
