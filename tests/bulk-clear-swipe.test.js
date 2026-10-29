/* Beta 0.6.9: node tests/bulk-clear-swipe.test.js — niente rete né credenziali vere. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {TextEncoder}=require('node:util');
const cloudCode=fs.readFileSync('cloud-sync.js','utf8');
const appCode=fs.readFileSync('app.js','utf8');
const item1={id:'a',comune:'Redondesco',via:'San Fermo',civico:'28',lat:45,lon:10,accuracy:6,createdAt:'2026-10-29T15:00:00Z'};
const item2={...item1,id:'b',civico:'32'};
const base=[item1,item2];
const copy=x=>JSON.parse(JSON.stringify(x));
async function cloudCase({local=base,remote=base,online=true,authenticated=true,patchStatus=200,expectedCount=2}={}){
  let onDevice=copy(local),onServer=copy(remote),patches=0;
  const memory=new Map();
  if(authenticated){
    memory.set('sc-cloud-session-v1',JSON.stringify({uid:'u1',email:'test@example.invalid',refreshToken:'placeholder'}));
    memory.set('sc-cloud-owner-v1',JSON.stringify('u1'));
    memory.set('sc-cloud-base-salvacivici-mappa-recapito-u1',JSON.stringify({records:local}));
  }
  const localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
  const controls=new Map();
  const getElementById=id=>{
    if(!controls.has(id))controls.set(id,{value:'',textContent:'',hidden:false,classList:{toggle(){}},addEventListener(){}});
    return controls.get(id);
  };
  const document={getElementById,querySelector:()=>({addEventListener(){}}),addEventListener(){},visibilityState:'hidden'};
  const navigator={onLine:false};
  const window={SCCloudMerge:{same:(a,b)=>JSON.stringify(a)===JSON.stringify(b)},SC:{isRecord:x=>!!x?.id},addEventListener(){}};
  const fetch=async(url,options={})=>{
    if(url.includes('securetoken.googleapis'))return{ok:true,json:async()=>({id_token:'test',refresh_token:'placeholder',user_id:'u1',expires_in:3600})};
    if(options.method==='PATCH'){
      patches++;
      if(patchStatus!==200)return{ok:false,status:patchStatus,json:async()=>({error:{message:'FAILED_PRECONDITION'}})};
      onServer=JSON.parse(JSON.parse(options.body).fields.payload.stringValue);
      return{ok:true,json:async()=>({updateTime:'2026-10-29T18:00:00Z'})};
    }
    return{ok:true,status:200,json:async()=>({fields:{payload:{stringValue:JSON.stringify(onServer)}},updateTime:'2026-10-29T17:00:00Z'})};
  };
  const build=new Function('window','document','navigator','localStorage','fetch','TextEncoder','setInterval','setTimeout',cloudCode+'\nreturn window.SCCloud;');
  const api=build(window,document,navigator,localStorage,fetch,TextEncoder,()=>{},()=>{});
  api.init({getRecords:async()=>copy(onDevice),applySnapshot:async records=>{onDevice=copy(records)},confirmAction:async()=>true,toast(){}});
  navigator.onLine=online;
  const outcome=await api.clearAll({expectedCount});
  return{outcome,onDevice,onServer,patches};
}
function swipeCase({from='capture',dx=-115,dy=3,interactive=false,x=225}={}){
  const begin=appCode.indexOf('  function setupHorizontalTabSwipe(){');
  const end=appCode.indexOf('  setupHorizontalTabSwipe();',begin);
  assert.ok(begin>0&&end>begin,'swipe implementation exists');
  const fn=new Function('document','window','$','showPage',appCode.slice(begin,end+'  setupHorizontalTabSwipe();'.length));
  let active=from;
  const events={};
  const main={addEventListener:(type,callback)=>events[type]=callback};
  const document={querySelector:q=>q==='main'?main:null,documentElement:{clientWidth:400}};
  const $=id=>({hidden:id!=='page-'+active});
  fn(document,{innerWidth:400},$,name=>active=name);
  const target={closest:()=>interactive?{}:null};
  const touch=(clientX,clientY)=>({clientX,clientY});
  events.touchstart({touches:[touch(x,220)],target});
  events.touchmove({touches:[touch(x+dx,220+dy)],cancelable:true,preventDefault(){}});
  events.touchend({changedTouches:[touch(x+dx,220+dy)]});
  return active;
}
(async()=>{
  const success=await cloudCase();
  assert.equal(success.outcome.ok,true);
  assert.equal(success.patches,1);
  assert.equal(success.onDevice.length,0);
  assert.equal(success.onServer.length,0);
  for(const args of [{online:false},{authenticated:false},{remote:[item1]},{expectedCount:1},{patchStatus:412}]){
    const result=await cloudCase(args);
    assert.equal(result.outcome.ok,false,JSON.stringify(args));
    assert.equal(result.onDevice.length,2,JSON.stringify(args));
  }
  assert.equal(swipeCase(),'records');
  assert.equal(swipeCase({from:'records'}),'data');
  assert.equal(swipeCase({from:'data',dx:115}),'records');
  assert.equal(swipeCase({dx:4,dy:120}),'capture');
  assert.equal(swipeCase({interactive:true}),'capture');
  assert.equal(swipeCase({x:10,dx:140}),'capture');
  assert.equal(swipeCase({dx:-45}),'capture');
  assert.equal(swipeCase({dx:-120,dy:112}),'capture');
  console.log('Beta 0.6.9: 6 test eliminazione cloud, 8 test swipe superati.');
})().catch(error=>{console.error(error);process.exitCode=1});
