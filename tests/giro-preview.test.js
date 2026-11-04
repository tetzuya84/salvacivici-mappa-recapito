/* Beta 0.6.44 — anteprima dedicata Giro, apertura differita, nessuna Mappa alterata. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script=fs.readFileSync('giro-preview.js','utf8');
const nodes=new Map();
function node(id){
 if(!nodes.has(id))nodes.set(id,{id,hidden:id==='page-giro'||id==='giro-preview',textContent:''});
 return nodes.get(id);
}
const docs={getElementById:node};
const effects={maps:0,lines:0,markers:0,clears:0,fits:0};
const group={addTo(){return this},clearLayers(){effects.clears++;return this}};
const map={
 invalidateSize(){},fitBounds(){effects.fits++},
};
const L={
 map(){effects.maps++;return map},
 layerGroup(){return group},
 tileLayer(){return{addTo(){return this}}},
 polyline(){effects.lines++;return{addTo(){return this}}},
 marker(){effects.markers++;return{addTo(){return this}}},
 divIcon(options){return options},
 latLngBounds(){return{pad(){return this}}},
};
const win={
 SCMapReview:{loadLeaflet:async()=>L},
 requestAnimationFrame:fn=>fn()
};
vm.runInNewContext(script,{window:win,document:docs});
const preview=win.SCGiroPreview.create();
const start={lat:45.18,lon:10.38},stops=[
 {id:'x',lat:45.19,lon:10.40},{id:'y',lat:45.20,lon:10.41}
];
const unchanged=JSON.stringify(stops);
(async()=>{
 preview.draw({origin:start,stops});
 assert.equal(node('giro-preview').hidden,false);
 assert.equal(effects.maps,0,'non inizializzare una mappa nella scheda nascosta');
 node('page-giro').hidden=false;
 await preview.activate();
 assert.equal(effects.maps,1);
 assert.equal(effects.lines,1);
 assert.equal(effects.markers,3);
 assert.equal(effects.fits,1);
 assert.match(node('giro-preview-status').textContent,/schematiche/);
 preview.draw(null);
 assert.equal(node('giro-preview').hidden,true);
 assert.ok(effects.clears>=1);
 assert.equal(JSON.stringify(stops),unchanged,'le coordinate civici non si modificano');
 console.log('PASS Beta 0.6.44: anteprima separata, lazy load, pin e linea schematica, no data changes.');
})().catch(e=>{console.error(e);process.exitCode=1});
