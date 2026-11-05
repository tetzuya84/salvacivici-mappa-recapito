/* Beta 0.6.51 — giro multistop, etichetta GPS e nessun GraphHopper. */
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
 assert.match(node('giro-apple').href,/maps\.apple\.com\/directions/);
 assert.match(node('giro-google').href,/waypoints=/);
 assert.match(node('giro-apple').textContent,/Giro completo/);
 assert.match(node('giro-google').textContent,/Giro completo/);
 assert.match(node('giro-route-coverage').textContent,/2 fermate incluse/);
 assert.equal(node('giro-single-links').hidden,false);
 assert.match(node('giro-single-apple').href,/daddr=/);
 assert.ok(!node('giro-single-google').href.includes('waypoints='));
 const fullApple=new URL(node('giro-apple').href);
 const fullGoogle=new URL(node('giro-google').href);
 assert.equal(fullApple.searchParams.getAll('waypoint').length,1);
 assert.equal(fullGoogle.searchParams.get('waypoints').split('|').length,1);
 const persisted=JSON.parse(store['salvacivici-giro-v1']);
 assert.equal(persisted.selected.length,2);
 node('giro-complete').events.click();
 assert.equal(node('giro-itinerary').children.length,2);
 assert.equal(JSON.parse(store['salvacivici-giro-v1']).done.length,1);
 assert.equal(drawn.at(-1)?.stops?.length,1);
 assert.equal(node('giro-single-links').hidden,true,'Un civico residuo: solo un navigatore diretto');
 assert.ok(!node('giro-google').href.includes('waypoints='));
 assert.match(node('giro-apple').textContent,/Naviga Apple/);
 instance.close();
 assert.equal(node('page-giro').hidden,false,'La barra di navigazione gestisce la pagina');
 assert.equal(JSON.stringify(samples),original,'Giro never changes permanent civics');
}
(async()=>{
 testNavigationUrls();await testUI();
 console.log('PASS Beta 0.6.51: multi-stop links, GPS La tua posizione, no GraphHopper, no data mutation.');
})().catch(e=>{console.error(e);process.exitCode=1});
