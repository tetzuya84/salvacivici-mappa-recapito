/* Beta 0.6.59 — giro multistop, etichetta GPS e nessun GraphHopper. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('giro.js','utf8');
const elements=new Map(),listeners={},store={},drawn=[];
function node(id){
 if(!elements.has(id)){
  const n={id,hidden:id==='giro-panel'||id==='giro-next',value:'',disabled:false,checked:false,textContent:'',
   children:[],attrs:{},classList:{toggle(){},add(){},remove(){}},style:{},events:{},
   addEventListener(k,fn){this.events[k]=fn},
   append(...els){this.children.push(...els)},
   replaceChildren(){this.children=[]},
   setAttribute(k,v){this.attrs[k]=v}
  };
  elements.set(id,n);
 }
 return elements.get(id);
}
const doc={getElementById:node,querySelector(){return null},createElement:type=>({
 type,children:[],textContent:'',checked:false,disabled:false,events:{},className:'',attrs:{},
 style:{},classList:{add(){},remove(){},toggle(){}},
 setAttribute(k,v){this.attrs[k]=v},
 addEventListener(k,f){this.events[k]=f},
 append(...x){this.children.push(...x)},
 getBoundingClientRect(){
  const i=node('giro-itinerary').children.indexOf(this);
  return {top:100+i*60,bottom:160+i*60,height:60};
 }
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
function testNavigationUrls(){
 const stops=[samples[0],samples[1],samples[2]];
 const apple=new URL(helpers.appleRoute(stops));
 assert.equal(apple.origin,'https://maps.apple.com');
 assert.equal(apple.pathname,'/directions');
 assert.equal(apple.searchParams.get('destination'),stops[2].lat+','+stops[2].lon);
 assert.deepEqual(apple.searchParams.getAll('waypoint'),[
  stops[0].lat+','+stops[0].lon,
  stops[1].lat+','+stops[1].lon
 ]);
 assert.equal(apple.searchParams.get('mode'),'driving');
 assert.equal(apple.searchParams.has('source'),false,'Usa posizione corrente del navigatore');
 const google=new URL(helpers.googleRoute(stops));
 assert.equal(google.origin,'https://www.google.com');
 assert.equal(google.pathname,'/maps/dir/');
 assert.equal(google.searchParams.get('api'),'1');
 assert.equal(google.searchParams.get('destination'),stops[2].lat+','+stops[2].lon);
 assert.equal(google.searchParams.get('waypoints'),
  stops.slice(0,2).map(p=>p.lat+','+p.lon).join('|'));
 assert.equal(google.searchParams.has('origin'),false);
 assert.equal(google.searchParams.get('travelmode'),'driving');
 assert.ok(!google.href.includes('Casalromano'));
 assert.ok(!google.href.includes(samples[0].id+'%'));
 assert.ok(!apple.href.includes('Kennedy'));
 const pair=new URL(helpers.appleRoute(stops.slice(0,2)));
 assert.equal(pair.searchParams.getAll('waypoint').length,1);
 assert.equal(pair.searchParams.get('destination'),stops[1].lat+','+stops[1].lon);
 assert.equal(new URL(helpers.googleRoute(stops.slice(0,1))).searchParams.has('waypoints'),false);
 const many=Array.from({length:20},(_,i)=>({lat:45.1+i*.002,lon:10.1+i*.003}));
 assert.equal(new URL(helpers.appleRoute(many.slice(0,14))).searchParams.getAll('waypoint').length,13);
 assert.equal(new URL(helpers.googleRoute(many.slice(0,4))).searchParams.get('waypoints').split('|').length,3);
 assert.throws(()=>helpers.appleRoute(many),/14/);
 assert.throws(()=>helpers.googleRoute(many),/4/);
 assert.throws(()=>helpers.googleRoute([]),/1 a 4/);
}
assert.equal(helpers.graphhopper,undefined,'GraphHopper è stato eliminato dal Giro');
async function testUI(){
 const instance=win.SCGiro.create({getRecords:()=>samples,drawRoute:plan=>drawn.push(plan),notify(){}});
 node('page-giro').hidden=false;
 instance.open();
 assert.equal(node('page-giro').hidden,false);
 assert.equal(node('giro-stops').children.length,3);
 const rows=node('giro-stops').children;
 const first=rows[0].children[0],last=rows[2].children[0];
 first.checked=true;first.events.change();
 // Re-render creates new checkbox nodes.
 const newRows=node('giro-stops').children;
 newRows[2].children[0].checked=true;newRows[2].children[0].events.change();
 assert.equal(node('giro-count').textContent,'2 / 20 fermate selezionate');
 assert.equal(node('giro-recalc').disabled,false);
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(locateCalls,1);
 assert.equal(node('giro-next').hidden,false);
 assert.equal(node('giro-itinerary').children.length,2);
 assert.match(node('giro-status').textContent,/Ordine di selezione/);
 assert.equal(drawn.at(-1)?.stops?.length,2);
 const removed=node('giro-stops').children[2].children[0];
 removed.checked=false;removed.events.change();
 assert.equal(drawn.at(-1)?.stops?.length,1,'Deselezione ricalcolata');
 const restored=node('giro-stops').children[2].children[0];
 restored.checked=true;restored.events.change();
 assert.equal(drawn.at(-1)?.stops?.length,2,'Selezione ricalcolata');
 const firstBefore=Array.from(drawn.at(-1).stops,r=>r.id);
 const firstRow=node('giro-itinerary').children[0];
 const grip=firstRow.children[1];
 assert.equal(grip.className,'giro-drag-handle');
 assert.equal(grip.children[0].className,'giro-grip-bars');
 assert.equal(grip.children[0].children.length,3);
 assert.equal(grip.disabled,false);
 assert.ok(grip.events.pointerdown&&grip.events.pointermove&&grip.events.pointerup);
 grip.events.pointerdown({pointerId:1,pointerType:'touch',isPrimary:true,clientY:130,preventDefault(){}});
 grip.events.pointermove({pointerId:1,clientY:210,preventDefault(){}});
 grip.events.pointerup({pointerId:1});
 assert.deepEqual(Array.from(drawn.at(-1).stops,r=>r.id),[firstBefore[1],firstBefore[0]],'Drag updates preview');
 assert.deepEqual(JSON.parse(store['salvacivici-giro-v1']).manualOrder,[firstBefore[1],firstBefore[0]]);
 assert.equal(new URL(node('giro-apple').href).searchParams.get('waypoint'),
  drawn.at(-1).stops[0].lat+','+drawn.at(-1).stops[0].lon);
 assert.equal(new URL(node('giro-google').href).searchParams.get('destination'),
  drawn.at(-1).stops[1].lat+','+drawn.at(-1).stops[1].lon);
 instance.close();instance.open();
 assert.deepEqual(Array.from(drawn.at(-1).stops,r=>r.id),[firstBefore[1],firstBefore[0]],'Tab change preserves manual order');
 const extra=node('giro-stops').children[1].children[0];
 extra.checked=true;extra.events.change();
 assert.equal(drawn.at(-1).stops.length,3);
 assert.deepEqual(Array.from(drawn.at(-1).stops.slice(0,2),r=>r.id),[firstBefore[1],firstBefore[0]],'Add stop preserves manual order');
 const extraOff=node('giro-stops').children[1].children[0];
 extraOff.checked=false;extraOff.events.change();
 assert.deepEqual(Array.from(drawn.at(-1).stops,r=>r.id),[firstBefore[1],firstBefore[0]],'Remove stop preserves manual order');
 assert.match(node('giro-apple').href,/maps\.apple\.com\/directions/);
 assert.match(node('giro-google').href,/waypoints=/);
 assert.match(node('giro-apple').textContent,/Naviga con Apple Mappe/);
 assert.match(node('giro-google').textContent,/Naviga con Google Maps/);
 assert.match(node('giro-route-coverage').textContent,/Apple Mappe: 2 di 2 fermate[\s\S]*Google Maps: 2 di 2 fermate/);
 const fullApple=new URL(node('giro-apple').href);
 const fullGoogle=new URL(node('giro-google').href);
 assert.equal(fullApple.searchParams.getAll('waypoint').length,1);
 assert.equal(fullGoogle.searchParams.get('waypoints').split('|').length,1);
 const persisted=JSON.parse(store['salvacivici-giro-v1']);
 assert.equal(persisted.selected.length,2);
 assert.equal(Object.prototype.hasOwnProperty.call(persisted,'done'),false);
 assert.equal(drawn.at(-1)?.stops?.length,2,'Tutte le fermate rimangono nel percorso');
 assert.ok(!node('giro-google').href.includes('SingleStop'));
// Se la versione precedente aveva completamenti salvati, non escludere i civici.
 instance.close();
 assert.equal(node('page-giro').hidden,false,'La barra di navigazione gestisce la pagina');
 assert.equal(JSON.stringify(samples),original,'Giro never changes permanent civics');
}
(async()=>{
 testNavigationUrls();await testUI();
 console.log('PASS Beta 0.6.59: multi-stop links, selection-order, GPS La tua posizione, no GraphHopper, no data mutation.');
})().catch(e=>{console.error(e);process.exitCode=1});
