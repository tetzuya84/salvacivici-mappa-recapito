/* Beta 0.6.42 — test senza rete o GPS reale del pianificatore Giro. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('giro.js','utf8');
const elements=new Map(),listeners={},store={},drawn=[];
function node(id){
 if(!elements.has(id)){
  const n={id,hidden:id==='giro-panel'||id==='giro-next',value:'',disabled:false,checked:false,textContent:'',
   children:[],attrs:{},classList:{toggle(){}},events:{},
   addEventListener(k,fn){this.events[k]=fn},
   append(...els){this.children.push(...els)},
   replaceChildren(){this.children=[]},
   setAttribute(k,v){this.attrs[k]=v}
  };
  elements.set(id,n);
 }
 return elements.get(id);
}
const doc={getElementById:node,createElement:type=>({
 type,children:[],textContent:'',checked:false,disabled:false,events:{},className:'',
 addEventListener(k,f){this.events[k]=f},
 append(...x){this.children.push(...x)}
})};
const samples=[
 {id:'a',via:'Via Roma',civico:'50',comune:'Casalromano',lat:45.19126,lon:10.37015},
 {id:'b',via:'Strada Boschi',civico:'2',comune:"Canneto sull'Oglio",lat:45.17255,lon:10.37746},
 {id:'c',via:'Via Kennedy',civico:'51',comune:'Acquanegra sul Chiese',lat:45.1665,lon:10.43}
];
const original=JSON.stringify(samples);
const start={lat:45.18,lon:10.38};
let locateCalls=0;
const win={addEventListener(k,fn){listeners[k]=fn}};
const navigator={
 geolocation:{
  getCurrentPosition(resolve,reject){locateCalls++;resolve({coords:{latitude:start.lat,longitude:start.lon,accuracy:9}})}
 }
};
vm.runInNewContext(src,{
 window:win,document:doc,navigator,
 localStorage:{setItem:(k,v)=>{store[k]=v},getItem:k=>store[k]||null},
 fetch:()=>{throw Error('No HTTP required for geometric mode')},
 Number,Math,String,JSON,Set,Map,Promise,Date
});
const helpers=win.SCGiro.helpers;
assert.equal(helpers.heuristic(start,[]).length,0);
assert.equal(helpers.distance(start,start),0);
const ordered=helpers.heuristic(start,samples);
assert.equal(ordered.length,3);
assert.equal(new Set(ordered.map(x=>x.id)).size,3);
assert.ok(helpers.routeDistance(start,ordered) <= helpers.routeDistance(start,samples)+0.001);
async function testGraphhopper(){
 let payload;
 const reversed=await helpers.graphhopper(start,samples,'temporary-key',async(url,opts)=>{
  assert.match(url,/graphhopper\.com\/api\/1\/vrp\?key=temporary-key/);
  assert.equal(opts.credentials,'omit');assert.equal(opts.referrerPolicy,'no-referrer');
  payload=JSON.parse(opts.body);
  assert.equal(payload.vehicles[0].return_to_depot,false);
  assert.equal(payload.services.length,3);
  assert.ok(!opts.body.includes("Casalromano"));
  assert.ok(!opts.body.includes("Kennedy"));
  assert.ok(!opts.body.includes(samples[0].id+'"'));
  return {ok:true,json:async()=>({solution:{
   routes:[{activities:[{type:'start'},{type:'service',id:'s2'},{type:'service',id:'s0'},{type:'service',id:'s1'},{type:'end'}]}],
   distance:14000,transport_time:1200
  }})};
 });
 assert.deepEqual(Array.from(reversed.order.map(r=>r.id)),['c','a','b']);
 assert.equal(reversed.durationSeconds,1200);
 assert.equal(reversed.distanceMeters,14000);
 assert.equal(payload.services[0].duration,0);
 await assert.rejects(()=>helpers.graphhopper(start,samples,'temporary-key',async()=>({ok:false,status:429})),/limite/);
 await assert.rejects(()=>helpers.graphhopper(start,samples,'temporary-key',async()=>({ok:true,json:async()=>({solution:{
  routes:[{activities:[{type:'service',id:'s0'}]}]
 }})})),/incompleto/);
}
async function testUI(){
 const instance=win.SCGiro.create({getRecords:()=>samples,drawRoute:plan=>drawn.push(plan),notify(){}});
 node('giro-open').events.click();
 assert.equal(node('giro-panel').hidden,false);
 assert.equal(node('giro-open').hidden,true);
 assert.equal(node('giro-stops').children.length,3);
 assert.equal(node('giro-order').disabled,true);
 const rows=node('giro-stops').children;
 const first=rows[0].children[0],last=rows[2].children[0];
 first.checked=true;first.events.change();
 // Re-render creates new checkbox nodes.
 const newRows=node('giro-stops').children;
 newRows[2].children[0].checked=true;newRows[2].children[0].events.change();
 assert.equal(node('giro-count').textContent,'2 / 20 fermate selezionate');
 assert.equal(node('giro-order').disabled,false);
 node('giro-order').events.click();
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(locateCalls,1);
 assert.equal(node('giro-next').hidden,false);
 assert.equal(node('giro-itinerary').children.length,2);
 assert.match(node('giro-status').textContent,/NON è il percorso stradale più veloce/);
 assert.equal(drawn.at(-1)?.stops?.length,2);
 assert.match(node('giro-apple').href,/maps\.apple\.com/);
 const persisted=JSON.parse(store['salvacivici-giro-v1']);
 assert.equal(persisted.selected.length,2);
 node('giro-complete').events.click();
 assert.equal(node('giro-itinerary').children.length,2);
 assert.equal(JSON.parse(store['salvacivici-giro-v1']).done.length,1);
 assert.equal(drawn.at(-1)?.stops?.length,1);
 node('giro-close').events.click();
 assert.equal(node('giro-panel').hidden,true);
 assert.equal(node('giro-open').hidden,false);
 instance.close();
 assert.equal(JSON.stringify(samples),original,'Giro never changes permanent civics');
}
(async()=>{
 await testGraphhopper();await testUI();
 console.log('PASS Beta 0.6.42: optimization mock, GPS, selection, navigation, progress, no data mutation.');
})().catch(e=>{console.error(e);process.exitCode=1});
