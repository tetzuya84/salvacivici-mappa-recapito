/* Beta 0.6.61 — soltanto il pulsante Ottimizza cambia l'ordine dei tap. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const optimizer=fs.readFileSync('giro-optimizer.js','utf8');
const source=fs.readFileSync('giro.js','utf8');
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/>Ottimizza percorso<\/button>/);
const elements=new Map(),storage={},drawn=[];
function node(id){
 if(!elements.has(id))elements.set(id,{
  id,hidden:id==='giro-next',value:'',disabled:false,checked:false,textContent:'',
  children:[],events:{},classList:{add(){},remove(){},toggle(){}},style:{},
  addEventListener(k,f){this.events[k]=f},append(...a){this.children.push(...a)},
  replaceChildren(){this.children=[]},setAttribute(){}
 });
 return elements.get(id);
}
function makeElement(type){
 return {type,children:[],events:{},className:'',disabled:false,checked:false,
  style:{},classList:{add(){},remove(){},toggle(){}},
  addEventListener(k,f){this.events[k]=f},append(...a){this.children.push(...a)},
  setAttribute(){},getBoundingClientRect(){return{top:100,height:60,bottom:160}}};
}
const document={getElementById:node,querySelector(){return null},createElement:makeElement};
const records=Array.from({length:3},(_,i)=>({id:'stop'+i,via:'Via Prova',civico:String(i+1),
 comune:'Redondesco',lat:45.15+i*.002,lon:10.50+i*.002}));
const unchanged=JSON.stringify(records);
const grid=[
 [0,900,1000,100],
 [900,0,100,900],
 [900,900,0,900],
 [900,100,900,0]
];
let fetchCalls=0,fail=false,gpsCalls=0;
const requestedOrders=[];
const window={
 addEventListener(){},
 fetch:async(url,opts)=>{
  fetchCalls++;assert.equal(url,'https://valhalla1.openstreetmap.de/sources_to_targets');
  assert.equal(opts.method,'POST');
  if(fail) return{ok:false,status:429};
  const body=JSON.parse(opts.body);assert.equal(body.sources.length,4);
  // Il server restituisce la matrice nell'ordine richiesto dalla app:
  // partenza GPS + fermate effettivamente mostrate, anche dopo un drag.
  const indices=[0,...body.sources.slice(1).map(point=>{
   const id=records.findIndex(r=>r.lat===point.lat&&r.lon===point.lon);
   assert.ok(id>=0,'Fermata richiesta al provider inesistente');
   return id+1;
  })];
  requestedOrders.push(indices.slice(1).map(i=>'stop'+(i-1)));
  const matrix=indices.map(i=>indices.map(j=>grid[i][j]));
  return{ok:true,json:async()=>({sources_to_targets:{
   durations:matrix,distances:matrix.map(row=>row.map(x=>x/100))
  }})};
 }
};
const navigator={geolocation:{getCurrentPosition(resolve){
 gpsCalls++;resolve({coords:{latitude:45.15,longitude:10.5,accuracy:9}});
}}};
vm.runInNewContext(optimizer+'\n'+source,{
 window,document,navigator,localStorage:{
  getItem:k=>storage[k]||null,setItem(k,v){storage[k]=v}
 },Number,Math,String,JSON,Set,Map,Promise,Date,Array,Float64Array,Int16Array,
 AbortController,setTimeout,clearTimeout
});
const instance=window.SCGiro.create({getRecords:()=>records,drawRoute:r=>drawn.push(r)});
const delay=()=>new Promise(resolve=>setTimeout(resolve,25));
(async()=>{
 node('giro-select-all').events.click();await delay();
 assert.equal(drawn.at(-1).stops.length,3);
 // Cambia manualmente l'ordine, poi richiedi ottimizzazione stradale.
 const initial=Array.from(drawn.at(-1).stops,r=>r.id);
 assert.deepEqual(initial,['stop0','stop1','stop2'],'Selezione ordinata, non geodesica');
 assert.equal(fetchCalls,0,'Nessuna matrice stradale richiesta senza il pulsante');
 const old=node('giro-itinerary').children[0].children[1];
 old.events.keydown({key:'ArrowDown',preventDefault(){}});
 assert.notDeepEqual(Array.from(drawn.at(-1).stops,r=>r.id),initial);
 assert.deepEqual(Array.from(drawn.at(-1).stops,r=>r.id),['stop1','stop0','stop2']);
 node('giro-recalc').events.click();await delay();
 assert.equal(fetchCalls,1);
 assert.deepEqual(requestedOrders[0],['stop1','stop0','stop2'],
  'L\'ottimizzazione usa l\'ordine VISIBILE, non l\'ordine del catalogo');
 assert.ok(gpsCalls>=2,'GPS aggiornato a ogni ottimizzazione');
 assert.deepEqual(Array.from(drawn.at(-1).stops,r=>r.id),['stop2','stop0','stop1']);
 assert.match(node('giro-status').textContent,/ottimizzato su strada/);
 assert.match(node('giro-status').textContent,/senza traffico in tempo reale/);
 assert.equal(new URL(node('giro-google').href).searchParams.get('destination'),
  records[1].lat+','+records[1].lon);
 assert.deepEqual(JSON.parse(storage['salvacivici-giro-v1']).manualOrder,['stop2','stop0','stop1']);
 assert.equal(JSON.stringify(records),unchanged);
 // Se il provider fallisce, conservare selezione, sequenza e salvataggio.
 const previous=storage['salvacivici-giro-v1'];
 fail=true;node('giro-recalc').events.click();await delay();
 assert.equal(fetchCalls,2);
 assert.equal(storage['salvacivici-giro-v1'],previous);
 assert.deepEqual(Array.from(drawn.at(-1).stops,r=>r.id),['stop2','stop0','stop1']);
 assert.match(node('giro-status').textContent,/occupato/);
 assert.equal(node('giro-recalc').disabled,false,'Pulsante ripristinato dopo errore');
 instance.close();instance.open();
 assert.deepEqual(Array.from(drawn.at(-1).stops,r=>r.id),['stop2','stop0','stop1']);
 console.log('PASS Beta 0.6.61: ottimizzazione solo su click, ordine visibile, GPS, persistenza, rollback.');
})().catch(e=>{console.error(e);process.exitCode=1});
