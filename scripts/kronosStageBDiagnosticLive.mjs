import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=process.cwd();
const TARGET=path.resolve(ROOT,'.research-python','kronos-v1');
const PIP_BOOTSTRAP=path.resolve(ROOT,'.research-python','kronos-pip-bootstrap');
const RUNNER=path.resolve(ROOT,'backend','scripts','kronos_stage_b_diagnostic.py');

function run(command,args,options={}){
  return spawnSync(command,args,{cwd:ROOT,encoding:'utf8',stdio:options.inherit?'inherit':'pipe',timeout:options.timeout??600000,env:options.env??process.env});
}
function findPython(){
  for(const p of [process.env.KRONOS_PYTHON_BIN,'python3','python'].filter(Boolean)){
    if(run(p,['--version'],{timeout:10000}).status===0)return p;
  }
  throw new Error('KRONOS_STAGE_B_PYTHON_NOT_FOUND');
}
function env(){
  return {...process.env,PYTHONPATH:[TARGET,PIP_BOOTSTRAP,process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),PYTHONNOUSERSITE:'1'};
}
// Preflight durable replay-results before installing or running Kronos CPU.
const durable=run('node',['scripts/kronosStageBDurableStore.mjs','bootstrap'],{inherit:true,timeout:120000});
if(durable.error)throw durable.error;
if(durable.status!==0)throw new Error('KRONOS_STAGE_B_DURABLE_CHECKPOINT_PREFLIGHT_FAILED');
const python=findPython();
const probe=run(python,['-c',"import torch,numpy,pandas,huggingface_hub; assert torch.__version__.split('+')[0]=='2.8.0'"],{timeout:30000,env:env()});
if(probe.status!==0)throw new Error('KRONOS_STAGE_B_RUNTIME_NOT_READY_RUN_STAGE_A');
// No artificial two-hour timeout: the CPU forecast can take many hours.
// The Python runner persists progress after every four-path minibatch.
const result=run(python,[RUNNER],{inherit:true,timeout:0,env:env()});
if(result.error)throw result.error;
if(result.status!==0)process.exitCode=result.status??1;
