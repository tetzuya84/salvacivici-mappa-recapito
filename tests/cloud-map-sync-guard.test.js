/* Beta 0.6.62 — integration: automatic Firebase pulls never replace civic coordinates. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const stored={
 'sc-cloud-session-v1':JSON.stringify({uid:'userA',email:'user@example.invalid',refreshToken:'mockRefresh'}),
 'sc-cloud-owner-v1':JSON.stringify('userA')
};
const original={id:'civic1',comune:'Redondesco',via:'Piazza Castello',civico:'32',
 lat:45.166137,lon:10.512673,createdAt:'2026-11-05T15:00:00Z',
 positionSource:'manual',positionVerifiedAt:'2026-11-05T15:00:00Z'};
let local=[original],remote=[{...original,lat:45.166199}],apply=0,patches=0;
const elements=new Map(),listeners={};
function el(id){
 if(!elements.has(id))elements.set(id,{id,hidden:false,value:'',textContent:'',
  classList:{toggle(){}},addEventListener(k,f){this[k]=f}});
 return elements.get(id);
}
const document={visibilityState:'visible',getElementById:el,addEventListener(){},
 querySelector(){return{addEventListener(){}}}};
const navigator={onLine:true};
const window={addEventListener(){},SC:{isRecord:r=>!!r?.id,isSameCivic:(a,b)=>a.comune===b.comune&&a.via===b.via&&a.civico===b.civico}};
const localStorage={getItem:k=>stored[k]||null,setItem(k,v){stored[k]=v},removeItem(k){delete stored[k]}};
async function fetch(url,opts={}){
 if(url.includes('/v1/token?'))return{ok:true,status:200,json:async()=>({
  id_token:'mockBearer',refresh_token:'mockRefresh',user_id:'userA',expires_in:'3600'
 })};
 if(url.includes('/snapshots/main')){
  if(opts.method==='PATCH'){patches++;return{ok:true,json:async()=>({updateTime:'new'})};}
  return{ok:true,status:200,json:async()=>({updateTime:'2026-11-05T15:00:00Z',fields:{
   payload:{stringValue:JSON.stringify([])},
   mapPayload:{stringValue:JSON.stringify(remote)}
  }})};
 }
 throw Error('Unexpected network request: '+url);
}
const scope={window,document,navigator,localStorage,fetch,
 Date,JSON,Map,Set,Number,Promise,TextEncoder,setInterval(){},setTimeout,clearTimeout};
vm.runInNewContext(fs.readFileSync('cloud-merge.js','utf8'),scope);
window.SCCloudMerge=scope.window.SCCloudMerge;
vm.runInNewContext(fs.readFileSync('cloud-sync.js','utf8'),scope);
const cloud=window.SCCloud;
cloud.init({getRecords:async()=>[],getMapRecords:async()=>[...local],
 applySnapshot:async()=>{throw Error('Archive must not be altered')},
 applyMapSnapshot:async records=>{apply++;local=records},
 confirmAction:async()=>true,toast(){}});
const pause=()=>new Promise(r=>setTimeout(r,25));
(async()=>{
 await pause();
 assert.equal(apply,0,'Automatic startup must never overwrite a conflicting pin');
 assert.equal(local[0].lat,original.lat);
 const blocked=await cloud.refreshForMap();
 assert.equal(blocked.reason,'map-conflict');
 assert.equal(apply,0);
 assert.equal(patches,0);
 const explicitBlocked=await cloud.syncFromArchive();
 assert.equal(explicitBlocked.ok,false,'No baseline -> explicit overwrite blocked');
 assert.equal(apply,0);
 assert.equal(patches,0);
 // First acknowledge common baseline through identical remote and local record.
 remote=[original];
 const same=await cloud.refreshForMap();
 assert.equal(same.ok,true);
 assert.ok(stored['sc-cloud-map-base-salvacivici-mappa-recapito-userA']);
 // Remote changes after common baseline: background read stops, no silent overwrite.
 remote=[{...original,lat:45.166211}];
 const conflict=await cloud.refreshForMap();
 assert.equal(conflict.reason,'map-conflict');
 assert.equal(apply,0);
 // Explicit user-requested sync may use the baseline to reconcile a remote-only edit.
 const manual=await cloud.syncFromArchive();
 assert.equal(manual.ok,true);
 assert.equal(apply,1);
 assert.equal(local[0].lat,remote[0].lat);
 assert.equal(patches,0,'No unnecessary remote rewrite');
 console.log('PASS Beta 0.6.62: startup/map auto pulls guard verified points; explicit baseline reconciliation; no writes on conflicts.');
})().catch(e=>{console.error(e);process.exitCode=1});
