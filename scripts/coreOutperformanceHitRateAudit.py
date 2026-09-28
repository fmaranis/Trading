"""Read-only consistency diagnostic of consumed evidence; never constructs a portfolio."""
from pathlib import Path
import hashlib, json, math, statistics, sys, datetime, calendar

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'validation-runs/diagnostics/'
BENCH = PREFIX + 'core-outperformance-hit-rate-benchmark-input-2026-09-28.json'
OP = PREFIX + 'core-outperformance-profitability-v1-input.json'
ETF = PREFIX + 'core-outperformance-packaged-quality-ucits-v1-input.json'
CAP = PREFIX + 'core-outperformance-profitability-capped-policy-historical-cross-diagnostic-2026-09-27.json'
RAW = PREFIX + 'core-outperformance-profitability-simfin-bridge-v1-posthoc-result.json'
SNAP = 'validation-runs/preregistration/fundamental-quality-future-forward-v1-snapshot.json'
SNAP_SHA = '06ad777b20970fe8c957d9febe8ccadcbcc75ecbf08cc870cd600236488ab2f2'
TOL = 1e-10 # percentage points: arithmetic ties only

def require(ok, message):
    if not ok: raise ValueError(message)

def read(path): return json.loads((ROOT / path).read_text())
def sha(path): return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
def compound(values): return (math.prod(1 + x / 100 for x in values) - 1) * 100

def wilson(k, n):
    if not n: return None
    z = 1.959963984540054; p = k/n; den = 1+z*z/n
    mid = (p+z*z/(2*n))/den
    half = z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den
    return {'lowerPct': max(0,mid-half)*100, 'upperPct': min(1,mid+half)*100,
            'meaning': 'IID reference only; serial dependence and selection not corrected'}

def ordinal(key):
    require(len(key)==6 and key.isdigit() and 1<=int(key[4:])<=12, 'INVALID_MONTH')
    return int(key[:4])*12 + int(key[4:])-1

def check_series(series, expected):
    require(len(series)==expected, 'MONTH_COVERAGE')
    keys = sorted(series)
    require(all(ordinal(b)-ordinal(a)==1 for a,b in zip(keys, keys[1:])), 'MONTH_GAP')
    require(all(type(v) in (int,float) and math.isfinite(v) and v>-100 for v in series.values()), 'INVALID_RETURN')
    return keys

def price_map(packet):
    require(packet['provenance']=='REAL' and packet['currency']=='USD' and packet['property']=='AdjustedClose','NOT_REAL_USD_ADJUSTED')
    result = {}
    for r in packet['rows']:
        day=datetime.date.fromisoformat(r['date'])
        require(day<=datetime.date(2025,12,31), 'OUT_OF_SCOPE_PRICE')
        require(calendar.monthrange(day.year,day.month)[1]-day.day<=4,'STALE_MONTH_ENDPOINT')
        k = r['date'][:7].replace('-',''); ordinal(k)
        require(r['symbol'] in ('SPY','URTH'), 'WRONG_SYMBOL')
        require(math.isfinite(r['adjustedClose']) and r['adjustedClose']>0, 'INVALID_PRICE')
        require(k not in result.setdefault(r['symbol'],{}), 'DUPLICATE_PRICE_MONTH')
        result[r['symbol']][k] = r
    return result

def benchmark_months(prices, keys):
    out = {}
    for key in keys:
        o=ordinal(key)-1; prev=f'{o//12:04d}{o%12+1:02d}'
        require(prev in prices and key in prices,'MISSING_BENCHMARK_MONTH')
        out[key]=(prices[key]['adjustedClose']/prices[prev]['adjustedClose']-1)*100
    return out

def windows(series, step):
    keys=check_series(series,len(series))
    require(len(keys)>=12,'INSUFFICIENT_MONTHS')
    return [{'startMonth':keys[i], 'endMonth':keys[i+11], 'returnPct':compound([series[k] for k in keys[i:i+12]])}
            for i in range(0,len(keys)-11,step)]

def summary(excess, labels, independent, blocks=None):
    n=len(excess); require(n>0 and len(labels)==n,'EMPTY_OR_MISALIGNED')
    wins=[x for x in excess if x>TOL]; losses=[x for x in excess if x < -TOL]
    run=longest=0; previous_block=None
    for i,x in enumerate(excess):
        block=blocks[i] if blocks else 0
        if block!=previous_block: run=0
        run=run+1 if x<=TOL else 0; longest=max(longest,run);previous_block=block
    return {'n':n,'wins':len(wins),'ties':n-len(wins)-len(losses),'losses':len(losses),
            'hitRatePct':100*len(wins)/n,'meetsObserved80Pct':len(wins)/n>=.8,
            'meanExcessPp':statistics.mean(excess),'medianExcessPp':statistics.median(excess),
            'meanWinExcessPp':statistics.mean(wins) if wins else None,
            'meanLossExcessPp':statistics.mean(losses) if losses else None,
            'worstExcessPp':min(excess),'worstPeriod':labels[excess.index(min(excess))],
            'longestNonWinningRunWithinBlock':longest,'wilson95IidReference':wilson(len(wins),n) if independent else None,
            'overlapping':not independent}

def compare_rows(rows, names, independent=True):
    require(len({r['period'] for r in rows})==len(rows),'DUPLICATE_PERIOD')
    labels=[r['period'] for r in rows]; blocks=[r.get('block',0) for r in rows]
    out={}
    for name in names:
        require(all(name in r for r in rows),'BENCHMARK_COVERAGE')
        require(all(type(r[k]) in (int,float) and math.isfinite(r[k]) and r[k]>-100 for r in rows for k in ['candidate',name]),'INVALID_RETURN')
        out[name]=summary([r['candidate']-r[name] for r in rows],labels,independent,blocks)
    if 'SPY' in names and 'URTH' in names:
        out['BOTH_SPY_URTH']=summary([min(r['candidate']-r['SPY'],r['candidate']-r['URTH']) for r in rows],labels,independent,blocks)
        out['BOTH_SPY_URTH']['excessMeaning']='Candidate minus better benchmark in each period; not a tradable hindsight portfolio'
    out['positiveAbsoluteReturnCount']=sum(r['candidate']>TOL for r in rows)
    return out

def metrics(values, periods_per_year):
    total=compound(values)
    return {'n':len(values),'totalReturnPct':total,'cagrPct':((1+total/100)**(periods_per_year/len(values))-1)*100}

def analyze():
    require(sha(SNAP)==SNAP_SHA,'SNAPSHOT_CHANGED')
    packet=read(BENCH);prices=price_map(packet);op=read(OP);etf=read(ETF);cap=read(CAP);raw=read(RAW)
    blocks=[]
    for key in ['confirmation','diagnostic']:
        data=op[key];candidate=data['candidateMonthlyPct'];keys=check_series(candidate,72)
        parent=data['usParentMonthlyPct'];require(sorted(parent)==keys,'PARENT_DATE_MISMATCH');check_series(parent,72)
        series={'candidate':candidate,'French_US_Market':parent,'SPY':benchmark_months(prices['SPY'],keys)}
        if key=='diagnostic': series['URTH']=benchmark_months(prices['URTH'],keys)
        else:
            series['French_Developed_Market']=data['developedGlobalMonthlyPct']
            require(sorted(series['French_Developed_Market'])==keys,'GLOBAL_DATE_MISMATCH')
        annual=[];rolling=[]
        for step,target in [(12,annual),(1,rolling)]:
            ws={k:windows(v,step) for k,v in series.items()}
            for i,c in enumerate(ws['candidate']):
                row={'period':c['startMonth']+'-'+c['endMonth'],'block':key}
                for k,v in ws.items():
                    require((v[i]['startMonth'],v[i]['endMonth'])==(c['startMonth'],c['endMonth']),'WINDOW_ALIGNMENT')
                    row[k]=v[i]['returnPct']
                target.append(row)
        blocks.append({'id':key,'coverage':{'expectedMonths':72,'candidateMonths':len(keys),'SPYMonths':len(series['SPY']),
                       'URTHMonths':len(series.get('URTH',{})),'URTHComplete':key=='diagnostic'},
                       'missingReason':None if key=='diagnostic' else 'URTH did not exist for full 2009-2014 block; no stitching or shorter success sample',
                       'annualRows':annual,'annual':compare_rows(annual,[s for s in series if s!='candidate']),
                       'rolling12mRows':rolling,'rolling12m':compare_rows(rolling,[s for s in series if s!='candidate'],False),
                       'terminal':{k:metrics(list(v.values()),12) for k,v in series.items()}})
    # Pool frequency only, never compound across the missing 2015 year.
    all_annual=sum([b['annualRows'] for b in blocks],[])
    all_rolling=sum([b['rolling12mRows'] for b in blocks],[])
    yrs=sorted(etf['vehicle']['annualNavTotalReturnPct'])
    require(yrs==[str(y) for y in range(2017,2026)],'ETF_YEAR_COVERAGE')
    require(sorted(etf['parent']['annualTotalReturnPct'])==yrs==sorted(etf['global']['annualTotalReturnPct']),'ETF_DATE_ALIGNMENT')
    erows=[]
    for year in yrs:
        row={'period':year,'candidate':etf['vehicle']['annualNavTotalReturnPct'][year],
             'SP500_UCITS_NAV':etf['parent']['annualTotalReturnPct'][year],
             'URTH_NAV':etf['global']['annualTotalReturnPct'][year]}
        for s in ['SPY','URTH']:
            a=prices[s][str(int(year)-1)+'12'];b=prices[s][year+'12']
            row[s]=(b['adjustedClose']/a['adjustedClose']-1)*100
        erows.append(row)
    simfin=[]
    for name,field in [('raw','rawReturnPct'),('cap5','cappedReturnPct')]:
        rows=[]
        for i,p in enumerate(cap['periods']):
            q=raw['periods'][i];require(q['anchor']==p['anchor'],'BRIDGE_DATE_ALIGNMENT')
            require(abs(q['candidateReturnPct']-p['rawReturnPct'])<1e-9,'BRIDGE_SOURCE_MISMATCH')
            rows.append({'period':q['executionDate']+'/'+q['nextExecutionDate'],'candidate':p[field],
                         'SPY':p['spyReturnPct'],'URTH':p['urthReturnPct'],
                         'postHocTerminalValue':q['ctxs'] is not None and q['ctxs']['terminalType']=='POSTHOC_CASH_MERGER_VALUE'})
        simfin.append({'id':name,'annualRows':rows,'annual':compare_rows(rows,['SPY','URTH']),
                       'caveat':'CONSUMED/POSTHOC_CTXS_ACCOUNTING; direct-stock implementation remains closed',
                       'terminal':{k:metrics([r[k] for r in rows],1) for k in ['candidate','SPY','URTH']}})
    snap=read(SNAP)
    nav_urth={**{'2016':7.8},**etf['global']['annualTotalReturnPct']}
    nav_rows=[{**r,'URTH_NAV':nav_urth[r['period'][:4]]} for r in blocks[1]['annualRows']]
    blocks[1]['officialUrthNavAnnualCrossCheck']=compare_rows(nav_rows,['URTH_NAV'])
    discrepancy=[{'year':r['period'],'adjustedCloseReturnPct':r['URTH'],'officialNavReturnPct':r['URTH_NAV'],
                  'differencePp':r['URTH']-r['URTH_NAV']} for r in erows]
    return {'schemaVersion':1,'study':'CORE_OUTPERFORMANCE_HIT_RATE_AUDIT_2026_09_28',
        'role':'NEW_FREQUENCY_DIAGNOSTIC_ON_CONSUMED_EVIDENCE_NOT_FRESH_BACKTEST',
        'productionDefault':'LEGACY','productionAuthority':False,'thresholdFromUserPct':80,
        'benchmarks':{'priceRows':len(packet['rows']),'source':packet['source'],'currency':'USD','provenance':'REAL',
                      'SPYRows':len(prices['SPY']),'URTHRows':len(prices['URTH']),
                      'officialUrthNavSource':'https://www.ishares.com/ch/professionals/en/products/239696/ishares-msci-world-etf?switchLocale=Y',
                      'officialUrthNav2016ReturnPct':7.8,'urthPriceVsNavReconciliation':discrepancy,
                      'qualityWarning':'Adjusted-close and official NAV total returns differ; cause not fully reconciled. No equivalence claim or promotion. Annual URTH win counts cross-checked against official NAV; rolling counts remain vendor-dependent.'},
        'academicOperatingProfitability':{'role':'GROSS_ACADEMIC_SIGNAL_NOT_INVESTABLE_IMPLEMENTATION','blocks':blocks,
            'pooledAnnual':compare_rows(all_annual,['SPY','French_US_Market']),
            'pooledRolling12m':compare_rows(all_rolling,['SPY','French_US_Market'],False)},
        'packagedQuality':{'coverage':{'yearsExpected':9,'yearsAvailable':len(erows)},'annualRows':erows,
            'annual':compare_rows(erows,['SPY','URTH','SP500_UCITS_NAV','URTH_NAV']),
            'terminal':{k:metrics([r[k] for r in erows],1) for k in ['candidate','SPY','URTH','SP500_UCITS_NAV','URTH_NAV']},
            'caveat':'Candidate official USD NAV rounded to 0.1pp; actual fund expenses embedded; SPY/URTH prices are traded adjusted close. No broker costs/Spanish taxes. Never relabel old UCITS parent as SPY.'},
        'consumedSimfinImplementation':simfin,
        'exactFundamentalQualityHistorical':{'status':'BLOCKED_MISSING_HISTORICAL_PIT_DESCRIPTOR_PANEL',
            'snapshotDate':snap['snapshotDate'],'prospectiveCounts':snap['counts'],'snapshotSha256':sha(SNAP),
            'usableCompleteHistoricalFormationPanelsInReviewedEvidence':0,
            'reason':['Current frozen descriptor rows have no historical filing/publication vintages or six raw EPS anchors per historical formation.',
                      'SimFin bridge selected OP rows do not contain a full historical ROE/DE/EPS-variability cross-section.',
                      'Accessible secondary source documented report coverage 2019-06..2024-04 cannot supply six June trailing-EPS anchors for those consumed 2020..2024 formations.',
                      'Publish Date alone does not certify absence of later restatements; raw as-filed/vintage provenance must be audited.',
                      'Historical corporate-action accounting remains unresolved for exact strategy; no terminal value patch.',
                      'No valid historical replay by backcasting 2026 constituents, descriptors or weights.'],
            'futureOutcomes':'UNOPENED','startCaptured':False},
        'limitations':['All candidate outcomes used here were already consumed; no independent confirmation.',
                       '80% observed does not establish future probability or risk-adjusted alpha.',
                       'Overlapping 12-month windows are dependent; do not add to annual N.',
                       'Non-overlapping years can still be dependent; Wilson intervals are iid reference only.',
                       'No new variant, dates, weights, ETF or production integration selected.'],
        'inputHashes':{p:sha(p) for p in [BENCH,OP,ETF,CAP,RAW,SNAP]}}

if __name__=='__main__':
    result=analyze();text=json.dumps(result,indent=2,ensure_ascii=False,allow_nan=False)+'\n'
    if len(sys.argv)>1: Path(sys.argv[1]).write_text(text)
    else: print(text,end='')
