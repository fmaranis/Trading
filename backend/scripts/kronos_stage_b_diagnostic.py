from __future__ import annotations
import hashlib,json,math,os,sys,time,urllib.request
from pathlib import Path
from statistics import median
import numpy as np, pandas as pd, torch
from huggingface_hub import snapshot_download

ROOT=Path.cwd()
MARKER="KRONOS_STAGE_B_DIAGNOSTIC_V1_RESULT"
SOURCE_COMMIT="67b630e67f6a18c9e9be918d9b4337c960db1e9a"
MODEL_REPO="NeoQuasar/Kronos-small"; MODEL_REV="901c26c1332695a2a8f243eb2f37243a37bea320"
TOK_REPO="NeoQuasar/Kronos-Tokenizer-base"; TOK_REV="0e0117387f39004a9016484a186a908917e22426"
CACHE=ROOT/".runtime/kronos-stage-b-v1/yahoo"; PROGRESS=ROOT/".runtime/kronos-stage-b-v1/progress.json"
RESULT=ROOT/"validation-runs/diagnostics/kronos-stage-b-diagnostic-v1-result.json"
ASSETS=[
("EUNL","EUNL.DE",False),("SXR8","SXR8.DE",False),("EQQQ","EQQQ.DE",False),("EXSA","EXSA.DE",False),
("IS3N","IS3N.DE",False),("ZPRV","ZPRV.DE",False),("EXH1","EXH1.DE",False),("IBCI","IBCI.DE",True),("4GLD","4GLD.DE",True)]
CORE="EUNL"; CONTEXT=512; HORIZON=60; PATHS=20; CHUNK=3; SEED=20261007
FROM="2015-01-01"; TO="2025-12-31"

def qend_dates():
    out=[]
    for y in range(2018,2026):
      for m in (3,6,9,12):
        if y==2025 and m>9: continue
        d=pd.Timestamp(year=y,month=m,day=1)+pd.offsets.MonthEnd(0)
        out.append(d.strftime("%Y-%m-%d"))
    return out

def fetch(symbol):
    CACHE.mkdir(parents=True,exist_ok=True); p=CACHE/(symbol.replace(".","_")+".json")
    if p.exists(): return json.loads(p.read_text())
    p1=int(pd.Timestamp(FROM,tz="UTC").timestamp()); p2=int((pd.Timestamp(TO,tz="UTC")+pd.Timedelta(days=1)).timestamp())
    url=f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?period1={p1}&period2={p2}&interval=1d&events=history&includeAdjustedClose=true"
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 Custodia/1.0"})
    with urllib.request.urlopen(req,timeout=45) as r: data=json.loads(r.read())
    p.write_text(json.dumps(data)); return data

def parse(symbol,payload):
    r=payload["chart"]["result"][0]; q=r["indicators"]["quote"][0]
    rows=[]
    for i,ts in enumerate(r["timestamp"]):
      vals=[q.get(k,[None]*len(r["timestamp"]))[i] for k in ("open","high","low","close","volume")]
      if any(v is None for v in vals): continue
      o,h,l,c,v=map(float,vals)
      if min(o,h,l,c)<=0 or v<0: continue
      rows.append({"date":pd.Timestamp(ts,unit="s",tz="UTC").tz_convert(None).normalize(),"open":o,"high":h,"low":l,"close":c,"volume":v,"amount":v*((o+h+l+c)/4)})
    return pd.DataFrame(rows).drop_duplicates("date").sort_values("date").set_index("date")

def ranks(a):
    return pd.Series(a).rank(method="average").to_numpy()
def spearman(a,b):
    if len(a)<3:return None
    ra,rb=ranks(a),ranks(b)
    if np.std(ra)==0 or np.std(rb)==0:return None
    return float(np.corrcoef(ra,rb)[0,1])
def trailing60(df,info,h):
    x=df.loc[:info,"close"].tail(61).to_numpy()
    if len(x)<61:return None
    drift=math.log(x[-1]/x[0])/60
    return (math.exp(drift*h)-1)*100
def slope(path):
    y=np.log(np.array(path,dtype=float))
    return float(np.polyfit(np.arange(len(y),dtype=float),y,1)[0])
def pct(a,b): return (b/a-1)*100

def load_models():
    src=ROOT/".runtime/kronos-source"/SOURCE_COMMIT
    if not src.exists(): raise RuntimeError("KRONOS_STAGE_B_SOURCE_MISSING_RUN_STAGE_A")
    sys.path.insert(0,str(src))
    from model import Kronos,KronosPredictor,KronosTokenizer
    cache=ROOT/".runtime/kronos-hf-cache"
    md=snapshot_download(repo_id=MODEL_REPO,revision=MODEL_REV,allow_patterns=["config.json","model.safetensors"],cache_dir=str(cache))
    td=snapshot_download(repo_id=TOK_REPO,revision=TOK_REV,allow_patterns=["config.json","model.safetensors"],cache_dir=str(cache))
    tok=KronosTokenizer.from_pretrained(td); model=Kronos.from_pretrained(md); tok.eval(); model.eval()
    return KronosPredictor(model,tok,device="cpu",max_context=512)

def build_cases(series):
    core=series["EUNL.DE"]; core_dates=list(core.index); cases=[]
    for ai,cal in enumerate(qend_dates()):
      c=pd.Timestamp(cal); info=max([d for d in core_dates if d<=c],default=None)
      if info is None: continue
      rows=[]
      for aid,ticker,_ in ASSETS:
        df=series[ticker]
        pair=[d for d in core_dates if d<=info and d in df.index]
        fut=[d for d in core_dates if d>info and d in df.index][:HORIZON]
        if len(pair)<CONTEXT or len(fut)<HORIZON: continue
        rows.append({"assetId":aid,"ticker":ticker,"informationDate":info,"contextDates":pair[-CONTEXT:],"futureDates":fut})
      if len(rows)>=6: cases.append({"anchor":f"{info.year}Q{(info.month-1)//3+1}","informationDate":info,"rows":rows,"index":ai})
    return cases

def summarize_paths(last_close,paths,h):
    rets=[pct(last_close,p[h-1]) for p in paths]
    slopes=[slope(p[:h]) for p in paths]
    qs=np.quantile(rets,[.1,.5,.9])
    return {"medianReturnPct":float(np.median(rets)),"pReturnPositive":float(np.mean(np.array(rets)>0)),
            "pSlopePositive":float(np.mean(np.array(slopes)>0)),"returnP10Pct":float(qs[0]),"returnP50Pct":float(qs[1]),"returnP90Pct":float(qs[2])}

def run_anchor(pred,series,anchor):
    torch.manual_seed(SEED+anchor["index"]); np.random.seed(SEED+anchor["index"])
    rows=anchor["rows"]; forecasts={}
    for start in range(0,len(rows),CHUNK):
      chunk=rows[start:start+CHUNK]; dfs=[]; xs=[]; ys=[]; labels=[]
      for r in chunk:
        base=series[r["ticker"]].loc[r["contextDates"],["open","high","low","close","volume","amount"]]
        x=pd.Series(r["contextDates"]); y=pd.Series(r["futureDates"])
        for pi in range(PATHS):
          dfs.append(base); xs.append(x); ys.append(y); labels.append((r["assetId"],pi))
      outs=pred.predict_batch(dfs,xs,ys,HORIZON,T=1.0,top_k=0,top_p=.9,sample_count=1,verbose=False)
      for (aid,pi),out in zip(labels,outs):
        forecasts.setdefault(aid,[None]*PATHS)[pi]=[float(v) for v in out["close"].to_numpy()]
    result=[]
    core_row=next(r for r in rows if r["assetId"]==CORE)
    core_last=float(series[core_row["ticker"]].loc[core_row["informationDate"],"close"])
    core_actual={h:pct(core_last,float(series[core_row["ticker"]].loc[core_row["futureDates"][h-1],"close"])) for h in (20,60)}
    core_sum={h:summarize_paths(core_last,forecasts[CORE],h) for h in (20,60)}
    for r in rows:
      if r["assetId"]==CORE: continue
      df=series[r["ticker"]]; last=float(df.loc[r["informationDate"],"close"])
      rec={"anchor":anchor["anchor"],"informationDate":str(r["informationDate"].date()),"assetId":r["assetId"],"ticker":r["ticker"],"horizons":{}}
      for h in (20,60):
        actual=pct(last,float(df.loc[r["futureDates"][h-1],"close"])); sm=summarize_paths(last,forecasts[r["assetId"]],h)
        rec["horizons"][str(h)]={**sm,"actualReturnPct":actual,"actualCoreReturnPct":core_actual[h],"actualRelativeReturnPct":actual-core_actual[h],
          "predRelativeReturnPct":sm["medianReturnPct"]-core_sum[h]["medianReturnPct"],"momentumRelativeReturnPct":trailing60(df,r["informationDate"],h)-trailing60(series[core_row["ticker"]],r["informationDate"],h)}
      result.append(rec)
    return result

def metrics(all_rows,h):
    hs=str(h); groups={}
    for r in all_rows: groups.setdefault(r["anchor"],[]).append(r)
    kr=[]; mom=[]; dirs=[]; briers=[]; temporal={}
    for g in groups.values():
      a=[x["horizons"][hs]["actualRelativeReturnPct"] for x in g]
      k=[x["horizons"][hs]["predRelativeReturnPct"] for x in g]
      m=[x["horizons"][hs]["momentumRelativeReturnPct"] for x in g]
      if len(g)>=6: kr.append(spearman(k,a)); mom.append(spearman(m,a))
    for r in all_rows:
      x=r["horizons"][hs]; dirs.append((x["predRelativeReturnPct"]>0)==(x["actualRelativeReturnPct"]>0))
      y=1.0 if x["actualReturnPct"]>0 else 0.0; briers.append((x["pReturnPositive"]-y)**2)
      temporal.setdefault(r["assetId"],[[],[]]); temporal[r["assetId"]][0].append(x["predRelativeReturnPct"]); temporal[r["assetId"]][1].append(x["actualRelativeReturnPct"])
    tic={k:spearman(v[0],v[1]) for k,v in temporal.items()}
    return {"horizonSessions":h,"evaluated":len(all_rows),"meanCrossSectionalRankIc":float(np.nanmean([x for x in kr if x is not None])),
      "momentumMeanCrossSectionalRankIc":float(np.nanmean([x for x in mom if x is not None])),
      "relativeDirectionalAccuracyPct":float(np.mean(dirs)*100),"absoluteDirectionBrier":float(np.mean(briers)),
      "positiveTemporalIcAssets":sum(1 for v in tic.values() if v is not None and v>0),"temporalIcByAsset":tic}

def main():
    torch.set_num_threads(max(1,min(4,os.cpu_count() or 1)))
    series={t:parse(t,fetch(t)) for _,t,_ in ASSETS}; anchors=build_cases(series)
    pred=load_models(); progress={"version":"KRONOS_STAGE_B_DIAGNOSTIC_V1","completed":{}}
    if PROGRESS.exists():
      try: progress=json.loads(PROGRESS.read_text())
      except: pass
    all_rows=[]
    for i,a in enumerate(anchors,1):
      key=a["anchor"]
      if key in progress.get("completed",{}):
        rows=progress["completed"][key]
      else:
        print(f"[Kronos B] anchor {i}/{len(anchors)} {key}",flush=True)
        rows=run_anchor(pred,series,a); progress.setdefault("completed",{})[key]=rows
        PROGRESS.parent.mkdir(parents=True,exist_ok=True); PROGRESS.write_text(json.dumps(progress))
      all_rows.extend(rows)
    ms=[metrics(all_rows,h) for h in (20,60)]
    mean_rank=float(np.mean([m["meanCrossSectionalRankIc"] for m in ms])); mean_mom=float(np.mean([m["momentumMeanCrossSectionalRankIc"] for m in ms]))
    mean_dir=float(np.mean([m["relativeDirectionalAccuracyPct"] for m in ms])); mean_brier=float(np.mean([m["absoluteDirectionBrier"] for m in ms]))
    positive=min(m["positiveTemporalIcAssets"] for m in ms)
    coverage=len(all_rows)/(31*8)*100
    gates={"coverage":coverage>=85,"meanRankIc":mean_rank>=.05,"relativeDirectionalAccuracy":mean_dir>=52,"absoluteDirectionBrier":mean_brier<=.25,"positiveTemporalIcAssets":positive>=5}
    timesfm=None
    tf=ROOT/"validation-runs/diagnostics/timesfm-stage-b-predictive-benchmark-v1-result.json"
    if tf.exists():
      try:
        d=json.loads(tf.read_text()); timesfm=d.get("primarySummary")
      except: pass
    status="DESCRIPTIVE_SIGNAL_PRESENT" if all(gates.values()) else "DESCRIPTIVE_WEAK_OR_NO_SIGNAL"
    out={"schemaVersion":1,"study":"KRONOS_STAGE_B_DIAGNOSTIC_V1","status":status,"role":"HISTORICAL_DESCRIPTIVE_SIGNAL_DIAGNOSTIC_NO_PROMOTION",
      "coverage":{"expectedCases":248,"usableCases":len(all_rows),"coveragePct":coverage,"anchors":len(anchors)},
      "metrics":ms,"primarySummary":{"meanRankIc20_60":mean_rank,"momentumMeanRankIc20_60":mean_mom,"rankIcLiftVsMomentum20_60":mean_rank-mean_mom,
      "pooledRelativeDirectionalAccuracyPct20_60":mean_dir,"absoluteDirectionBrier20_60":mean_brier,"positiveTemporalIcAssetsMinimum20_60":positive,"gateChecks":gates},
      "timesfmExistingComparison":timesfm,"events":all_rows,"pretrainingCutoffKnown":False,"historicalPromotionAllowed":False,
      "productionDefault":"LEGACY","productionAuthority":False,"nextAction":"START_PROSPECTIVE_SHADOW" if status=="DESCRIPTIVE_SIGNAL_PRESENT" else "REVIEW_BEFORE_PROSPECTIVE_NO_RETUNING"}
    RESULT.parent.mkdir(parents=True,exist_ok=True); RESULT.write_text(json.dumps(out,indent=2))
    print(MARKER); print(json.dumps(out,indent=2))

if __name__=="__main__":
  try: main()
  except Exception as e:
    print(MARKER); print(json.dumps({"study":"KRONOS_STAGE_B_DIAGNOSTIC_V1","status":"BLOCKED_OR_TECHNICAL_FAILED","error":str(e),"productionDefault":"LEGACY","productionAuthority":False},indent=2)); raise
