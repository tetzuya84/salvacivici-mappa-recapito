/* Beta 0.6.59 — matrice stradale Valhalla e ottimo a fine libera. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('giro-optimizer.js','utf8');
const window={};vm.runInNewContext(source,{window,Number,Math,Array,Set,Map,Float64Array,Int16Array,Promise});
const {optimizeRoad,helpers}=window.SCGiroOptimizer;
function wrap(m){return {sources_to_targets:{durations:m,distances:m.map(row=>row.map(v=>v/10))}};}
function brute(m){
 const n=m.length-1;let best=Infinity,route=null;
 function dfs(path,left,prev,sum){
  if(!left.length){if(sum<best){best=sum;route=path;}return;}
  for(const j of left){
   const next=sum+m[prev][j+1];if(next>=best)continue;
   dfs([...path,j],left.filter(k=>k!==j),j+1,next);
  }
 }
 dfs([],Array.from({length:n},(_,i)=>i),0,0);
 return {best,route};
}
(async()=>{
 const asymmetric=[
  [0,7,20,1,10],
  [7,0,1,10,8],
  [20,40,0,10,1],
  [2,1,20,0,10],
  [3,10,10,10,0]
 ];
 const exact=helpers.chooseOrder(asymmetric,4);
 assert.equal(exact.exact,true);
 assert.equal(helpers.cost(exact.path,asymmetric),brute(asymmetric).best);
 assert.equal(exact.path.length,4);
 const single=await optimizeRoad({origin:{lat:45.15,lon:10.5},stops:[{id:'a',lat:45.16,lon:10.51}]});
 assert.equal(single.single,true);
 const points=Array.from({length:4},(_,i)=>({id:'stop'+i,lat:45.15+i*.001,lon:10.5+i*.001}));
 let call=0;
 const fetcher=async(url,options)=>{
  call++;assert.equal(url,'https://valhalla1.openstreetmap.de/sources_to_targets');
  assert.equal(options.method,'POST');
  assert.equal(options.headers['Content-Type'],'application/json');
  assert.equal(options.headers['X-Client-Id'],'salvacivici-mappa-recapito');
  const data=JSON.parse(options.body);
  assert.deepEqual(Object.keys(data).sort(),['costing','sources','targets','units','verbose']);
  assert.equal(data.sources.length,5);assert.equal(data.targets.length,5);
  assert.equal(data.costing,'auto');assert.equal(data.verbose,false);
  assert.ok(!options.body.includes('stop0')&&!options.body.includes('comune')&&!options.body.includes('civico'));
  return {ok:true,json:async()=>wrap(asymmetric)};
 };
 const r=await optimizeRoad({origin:{lat:45.18,lon:10.48},stops:points,fetcher});
 assert.equal(call,1,'Una sola chiamata stradale');
 assert.equal(r.seconds,brute(asymmetric).best);
 assert.equal(r.exact,true);assert.equal(r.stops.length,points.length);
 assert.equal(new Set(r.stops.map(x=>x.id)).size,4);
 assert.equal(r.beforeSeconds,helpers.cost([0,1,2,3],asymmetric));
 assert.ok(r.beforeSeconds>=r.seconds);
 assert.equal(JSON.stringify(points[0]),JSON.stringify({id:'stop0',lat:45.15,lon:10.5}));
 // n >12: nessuna fermata perduta, ordine almeno buono quanto quello iniziale.
 const n=16,m=Array.from({length:n+1},(_,i)=>Array.from({length:n+1},(_,j)=>
  i===j?0:Math.abs((i*13)%17-(j*13)%17)+1+(j<i?3:0)));
 const approx=helpers.chooseOrder(m,n);
 assert.equal(approx.exact,false);
 assert.equal(new Set(approx.path).size,n);
 assert.equal(approx.path.length,n);
 assert.ok(helpers.cost(approx.path,m)<=helpers.cost(Array.from({length:n},(_,i)=>i),m));
 // Non falsificare collegamenti impossibili, rifiutare errori e rate limit.
 await assert.rejects(()=>optimizeRoad({origin:{lat:45.1,lon:10.4},stops:points,
  fetcher:async()=>({ok:false,status:429})}),/occupato/);
 await assert.rejects(()=>optimizeRoad({origin:{lat:45.1,lon:10.4},stops:points,
  fetcher:async()=>({ok:true,json:async()=>wrap(asymmetric.map(row=>row.map(v=>v===40?null:v)))})}),/raggiungibile/);
 await assert.rejects(()=>optimizeRoad({origin:{lat:200,lon:10},stops:points,fetcher}),/non valide/);
 await assert.rejects(()=>optimizeRoad({origin:{lat:45.1,lon:10.4},stops:points,
  fetcher:async()=>{throw Error('network')}}),/invariato/i);
 // Formato verbose classico, riga unitaria.
 const classic=helpers.readMatrix({sources_to_targets:[[{
  time:0,distance:0},{time:80,distance:1.3}],[
  {time:73,distance:1.2},{time:0,distance:0}]]},2);
 assert.equal(classic.time[0][1],80);
 assert.equal(classic.distance[1][0],1.2);
 console.log('PASS Beta 0.6.59: Valhalla matrice, privacy, ottimo open-ended, 16 fermate, errori.');
})().catch(e=>{console.error(e);process.exitCode=1});
