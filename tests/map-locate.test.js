/* Test Beta 0.6.19 — pulsante La mia posizione senza dati reali né rete. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('map-overview.js','utf8');
const nodes=new Map(),listeners={};
function node(id){
 if(!nodes.has(id))nodes.set(id,{
   id,hidden:id==='page-map'?false:id==='overview-detail'||id==='overview-empty'||id==='overview-location-status',
   value:'',textContent:'',disabled:id==='overview-locate',href:'',children:[],events:{},
   append(o){this.children.push(o);},replaceChildren(){this.children=[];},
   addEventListener(k,fn){this.events[k]=fn;}
 });
 return nodes.get(id);
}
const calls=[],requests=[],locationDots=[],accuracyRings=[],recordLayers=[];
let leaflets=0,cardOpened=null;
const layer=(kind,pos,opts={})=>({
 kind,position:pos,opts,removed:false,
 addTo(target){this.parent=target;target.layers?.push(this);return this;},
 setLatLng(pos){this.position=pos;return this;},
 setRadius(radius){this.opts.radius=radius;return this;},
 remove(){this.removed=true;return this;},
 on(k,fn){this.events??={};this.events[k]=fn;return this;}
});
const Leaflet={
 map(_canvas,options){const map={options,layers:[],setView(p,z){calls.push({p,z});},
 fitBounds(p){calls.push({bounds:p});},invalidateSize(){}};return map;},
 layerGroup(){const l={layers:[],addTo(){recordLayers.push(this);return this;},clearLayers(){this.layers=[];}};return l;},
 tileLayer(){return layer('tile',[],{});},
 marker(p,opts){return layer('civic',p,opts);},
 divIcon(opts){return opts;},
 circleMarker(p,opts){const dot=layer('gpsdot',p,opts);locationDots.push(dot);return dot;},
 circle(p,opts){const ring=layer('ring',p,opts);accuracyRings.push(ring);return ring;},
 latLngBounds(p){return{pad(){return p;}}}
};
const geo={getCurrentPosition(success,error,opts){requests.push({success,error,opts});}};
const navigator={geolocation:geo};
const window={SCMapReview:{loadLeaflet:async()=>{leaflets++;return Leaflet;}},requestAnimationFrame(fn){fn();},addEventListener(k,fn){listeners[k]=fn;}};
const document={getElementById:node,createElement:tag=>({tagName:tag,value:'',textContent:''})};
vm.runInNewContext(src,{window,document,navigator});
const data=[{id:'record-1',via:'Kennedy',civico:'51',comune:'Acquanegra sul Chiese',lat:45.1603,lon:10.4374,positionSource:'gps_confirmed'}];
const savedJSON=JSON.stringify(data);
const map=window.SCMapOverview.create({getRecords:()=>data,onVerify:r=>{cardOpened=r;},notify(){}});
async function run(){
 await map.open();
 assert.equal(leaflets,1);
 assert.equal(node('overview-locate').disabled,false,'GPS button must enable on map ready');
 assert.equal(recordLayers[0].layers.length,1);
 node('overview-locate').events.click();
 assert.equal(requests.length,1,'GPS requested only on explicit click');
 assert.equal(requests[0].opts.enableHighAccuracy,true);
 assert.equal(requests[0].opts.maximumAge,0,'Do not reuse cached GPS coordinates');
 assert.equal(requests[0].opts.timeout,14000);
 assert.equal(node('overview-locate').disabled,true);
 node('overview-locate').events.click();
 assert.equal(requests.length,1,'Do not start concurrent requests');
 requests[0].success({coords:{latitude:45.1602,longitude:10.4375,accuracy:23.9}});
 assert.equal(node('overview-locate').disabled,false);
 assert.equal(calls.at(-1).z,18);
 assert.deepEqual(Array.from(calls.at(-1).p),[45.1602,10.4375]);
 assert.equal(locationDots.length,1);
 assert.equal(accuracyRings.length,1);
 assert.equal(accuracyRings[0].opts.radius,24);
 assert.match(node('overview-location-status').textContent,/GPS ±24 m/);
 assert.equal(node('overview-location-status').hidden,false);
 assert.equal(JSON.stringify(data),savedJSON,'GPS user must never write a civic record');
 node('overview-status-filter').value='manual';
 node('overview-status-filter').events.change();
 assert.equal(recordLayers[0].layers.length,0,'Filter removes civic markers');
 assert.equal(locationDots[0].removed,false,'Current GPS marker must survive civic filtering');
 node('overview-locate').events.click();
 assert.equal(requests.length,2);
 requests[1].error({code:1});
 assert.match(node('overview-location-status').textContent,/Consenti la posizione/);
 assert.equal(node('overview-locate').disabled,false,'Retry after denied permission');
 node('overview-locate').events.click();
 requests[2].success({coords:{latitude:45.1607,longitude:10.438,accuracy:1000}});
 assert.equal(locationDots.length,1,'Repeated positioning must update existing point');
 assert.deepEqual(Array.from(locationDots[0].position),[45.1607,10.438]);
 assert.equal(accuracyRings[0].removed,true,'Hide old inaccurate confidence ring');
 assert.equal(calls.at(-1).z,18);
 node('overview-locate').events.click();
 requests[3].success({coords:{latitude:91,longitude:10,accuracy:10}});
 assert.match(node('overview-location-status').textContent,/coordinate non valide/);
 assert.equal(node('overview-locate').disabled,false);
 navigator.geolocation=null;
 node('overview-locate').events.click();
 assert.match(node('overview-location-status').textContent,/Posizione non disponibile/);
 assert.equal(JSON.stringify(data),savedJSON);
 assert.equal(cardOpened,null);
 console.log('Beta 0.6.19: GPS locate, retry, precision ring, filtri e dati invariati PASS.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
