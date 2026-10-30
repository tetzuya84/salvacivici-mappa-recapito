/* Test Beta 0.6.17 — panoramica civici senza accesso rete, dati immutati. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('map-overview.js','utf8');
async function run(){
  const nodes=new Map();
  const node=id=>{
    if(!nodes.has(id)){
      const n={value:'',textContent:'',hidden:id==='overview-detail'||id==='overview-empty'||id==='page-map',href:'',children:[],events:{},
        append(c){this.children.push(c);},replaceChildren(){this.children=[];},
        addEventListener(k,fn){this.events[k]=fn;}};
      nodes.set(id,n);
    }
    return nodes.get(id);
  };
  node('page-map').hidden=false;
  const events={},mapCalls=[],pins=[];
  let tiles=null,overlay=null,libLoads=0,verified=null,filteredMarkers=0;
  const L={
    map(_el,opts){const map={opts,setView(pos,z){mapCalls.push({kind:'setView',pos,z});},
      fitBounds(b,o){mapCalls.push({kind:'fit',b,o});},invalidateSize(){}};return map;},
    layerGroup(){overlay={layers:[],addTo(){return this;},clearLayers(){this.layers=[];}};return overlay;},
    tileLayer(){tiles={events:{},on(k,fn){this.events[k]=fn;return this;},addTo(){return this;}};return tiles;},
    divIcon(opts){return opts;},
    marker(pos,opts){const marker={pos,opts,events:{},addTo(layer){layer.layers.push(this);pins.push(this);return this;},
      on(k,fn){this.events[k]=fn;return this;}};return marker;},
    latLngBounds(x){return{points:x,pad(){return this;}};}
  };
  const win={SCMapReview:{async loadLeaflet(){libLoads++;return L;}},addEventListener(k,fn){events[k]=fn;},
    requestAnimationFrame(fn){fn();}};
  const doc={getElementById:node,createElement:tag=>({tagName:tag,value:'',textContent:'',className:''})};
  vm.runInNewContext(src,{window:win,document:doc,Number,Math,String,Promise});
  const base=[
    {id:'a',comune:'Redondesco',via:'Piazza Castello',civico:'42',lat:45.16595,lon:10.51232,positionSource:'gps_unverified'},
    {id:'b',comune:'Redondesco',via:'Piazza Castello',civico:'24',lat:45.16605,lon:10.5124,positionSource:'manual'},
    {id:'c',comune:'Mariana Mantovana',via:'Corte Maestà',civico:'1',lat:45.187,lon:10.486,positionSource:'gps_confirmed'}
  ];
  let records=base.map(x=>({...x}));
  const original=JSON.stringify(records);
  const o=win.SCMapOverview.create({getRecords:()=>records,onVerify:r=>verified=r,notify(){}});
  await o.open();
  assert.equal(libLoads,1);assert.equal(overlay.layers.length,3);
  assert.match(node('overview-summary').textContent,/3 civici/);
  assert.equal(overlay.layers[0].opts.icon.html.textContent,'42');
  assert.equal(overlay.layers[0].opts.icon.className,'overview-pin overview-pin-unverified');
  assert.equal(overlay.layers[1].opts.icon.className,'overview-pin overview-pin-manual');
  assert.equal(overlay.layers[2].opts.icon.className,'overview-pin overview-pin-verified');
  tiles.events.tileload();assert.equal(node('overview-loading').hidden,true);
  overlay.layers[0].events.click();
  assert.equal(node('overview-detail').hidden,false);
  assert.match(node('overview-selected-title').textContent,/Piazza Castello, 42/);
  assert.equal(node('overview-apple').href,'https://maps.apple.com/?daddr=45.16595,10.51232&dirflg=d');
  assert.match(node('overview-google').href,/destination=45.16595,10.51232/);
  node('overview-verify').events.click();
  assert.equal(verified.id,'a');
  assert.equal(JSON.stringify(records),original,'Apertura e navigazione non devono scrivere i civici');
  node('overview-town').value='Mariana Mantovana';node('overview-town').events.change();
  assert.equal(overlay.layers.length,1);
  assert.equal(node('overview-detail').hidden,true);
  assert.equal(node('overview-summary').textContent,'1 civici sulla mappa');
  node('overview-town').value='Redondesco';node('overview-town').events.change();
  node('overview-status-filter').value='manual';node('overview-status-filter').events.change();
  assert.equal(overlay.layers.length,1);assert.equal(overlay.layers[0].opts.icon.html.textContent,'24');
  node('overview-status-filter').value='verified';node('overview-status-filter').events.change();
  assert.equal(overlay.layers.length,0);assert.equal(node('overview-empty').hidden,false);
  node('overview-status-filter').value='';node('overview-status-filter').events.change();
  records[0]={...records[0],lat:45.17,positionSource:'manual'};
  events['salvacivici:datachanged']();
  assert.equal(overlay.layers.length,2);
  await o.open();assert.equal(libLoads,1,'Leaflet condiviso: niente caricamenti doppi');
  assert.equal(o.helpers.valid({lat:91,lon:10}),false);
  console.log('PASS Beta 0.6.17: mappa, filtri, pin, navigazione, dati e cache Leaflet.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
