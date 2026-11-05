/* Beta 0.6.44 — regressione permessi GPS negati su Mappa e Giro. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const mapSrc=fs.readFileSync('map-overview.js','utf8'),giroSrc=fs.readFileSync('giro.js','utf8');
function dom(){
 const nodes=new Map(),doc={
  getElementById(id){
   if(!nodes.has(id))nodes.set(id,{id,hidden:['overview-gps-help','giro-gps-help','page-map','overview-detail','overview-nearby','giro-next','giro-panel'].includes(id),
    textContent:'',value:'',checked:false,disabled:false,href:'',options:[],children:[],attrs:{},events:{},classList:{toggle(){}},
    addEventListener(k,fn){this.events[k]=fn},setAttribute(k,v){this.attrs[k]=v},
    append(...items){this.children.push(...items);this.options=this.children},replaceChildren(){this.children=[];this.options=this.children;this.value=''},
    blur(){}});
   return nodes.get(id);
  },
  createElement(type){return {type,checked:false,disabled:false,textContent:'',value:'',className:'',children:[],events:{},
   addEventListener(k,fn){this.events[k]=fn},append(...xs){this.children.push(...xs);}}}
 };
 return {doc,node:doc.getElementById.bind(doc)};
}
function leaflet(){
 const layer={layers:[],addTo(){return this},clearLayers(){this.layers=[]}};
 const map={on(){return this},distance(){return 500},setView(){},fitBounds(){},invalidateSize(){},getZoom(){return 15}};
 const L={
  map(){return map},layerGroup(){return layer},marker(){return{on(){return this},addTo(){return this}}},
  tileLayer(){return{on(){return this},addTo(){return this}}},
  circleMarker(){return{addTo(){return this},setLatLng(){}}},
  circle(){return{addTo(){return this},setLatLng(){},setRadius(){},remove(){}}},
  divIcon(opts){return opts},latLngBounds(){return{pad(){return this}}}
 };
 return {L};
}
async function testMap(){
 const {doc,node}=dom(),{L}=leaflet(),toasts=[];
 node('page-map').hidden=false;
 let allow=false,calls=0;
 const navigator={geolocation:{getCurrentPosition(success,error){
  calls++;
  if(!allow)error({code:1,message:'Permission denied'});
  else success({coords:{latitude:45.19,longitude:10.38,accuracy:8}});
 }}};
 const root={SCMapReview:{loadLeaflet:async()=>L},addEventListener(){},requestAnimationFrame:fn=>fn()};
 vm.runInNewContext(mapSrc,{window:root,document:doc,navigator});
 const map=root.SCMapOverview.create({getRecords:()=>[],notify:m=>toasts.push(m)});
 await map.open();
 node('overview-locate').events.click();
 assert.equal(calls,1);
 assert.equal(node('overview-gps-help').hidden,false,'permesso negato: mostra le istruzioni');
 assert.match(node('overview-location-status').textContent,/non autorizzato/);
 assert.equal(toasts.length,0,'non coprire la mappa con un toast temporaneo');
 allow=true;
 node('overview-gps-help-retry').events.click();
 assert.equal(calls,2);
 assert.equal(node('overview-gps-help').hidden,true,'la guida scompare dopo GPS riuscito');
 assert.match(node('overview-location-status').textContent,/GPS ±8 m/);
 allow=false;node('overview-locate').events.click();
 assert.equal(node('overview-gps-help').hidden,false);
 node('overview-gps-help-close').events.click();
 assert.equal(node('overview-gps-help').hidden,true,'la guida deve essere richiudibile');
 return 'Mappa: codice 1, retry e chiusura';
}
async function testGiro(){
 const {doc,node}=dom(),events={},routes=[];
 let allow=false,calls=0;
 const navigator={geolocation:{getCurrentPosition(success,error){
  calls++;
  if(!allow)error({code:1,message:'Permission denied'});
  else success({coords:{latitude:45.19,longitude:10.38,accuracy:5}});
 }}};
 const saved={},localStorage={getItem:k=>saved[k]||null,setItem:(k,v)=>{saved[k]=v}};
 const root={addEventListener(k,fn){events[k]=fn}};
 vm.runInNewContext(giroSrc,{window:root,document:doc,navigator,localStorage,
  fetch:()=>{throw Error('network not used')}});
 const points=[{id:'a',via:'Via Roma',civico:'50',comune:'Casalromano',lat:45.19,lon:10.37}];
 const unchanged=JSON.stringify(points);
 const giro=root.SCGiro.create({getRecords:()=>points,drawRoute:r=>routes.push(r),notify(){}});
 node('page-giro').hidden=false;
 giro.open();
 const check=node('giro-stops').children[0].children[0];check.checked=true;check.events.change();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(calls,1);
 assert.equal(node('giro-gps-help').hidden,false);
 assert.match(node('giro-status').textContent,/GPS non autorizzato/);
 allow=true;
 node('giro-gps-help-retry').events.click();
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(calls,2);
 assert.equal(node('giro-gps-help').hidden,true);
 assert.match(node('giro-origin').textContent,/La tua posizione/);
 assert.equal(JSON.stringify(points),unchanged,'non scrivere coordinate dei civici');
 return 'Giro: codice 1, retry e dati civici invariati';
}
(async()=>{
 const results=[await testMap(),await testGiro()];
 console.log('PASS Beta 0.6.44: '+results.join('; '));
})().catch(e=>{console.error(e);process.exitCode=1});
