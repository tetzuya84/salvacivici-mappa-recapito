/* Beta 0.6.16: test della mappa su Leaflet simulato, senza connessione o dati reali.
   Eseguire con: node tests/map-review.test.js */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const SC=require('../core.js');
const script=fs.readFileSync('map-review.js','utf8');
const base={id:'test-1',comune:'Redondesco',via:'Piazza Castello',civico:'20',
  lat:45.1659,lon:10.5126,accuracy:18,createdAt:'2026-10-29T14:30:00Z'};
function harness(){
  const controls=new Map(),on={};
  const $=id=>{
    if(!controls.has(id))controls.set(id,{
      hidden:false,disabled:false,textContent:'',open:false,
      classList:{add(){},remove(){}},
      addEventListener(name,fn){this['on'+name]=fn;},
      showModal(){this.open=true;},
      close(){this.open=false;}
    });
    return controls.get(id);
  };
  let fakeMap=null,tiles=null,marker=null;
  const layer=()=>({position:[],events:{},addTo(){return this;},
    setLatLng(p){this.position=p;},setRadius(n){this.radius=n;},
    getLatLng(){return{lat:this.position[0],lng:this.position[1]};},
    on(name,fn){this.events[name]=fn;return this;}});
  const Leaflet={
    map(element,options){fakeMap={options,events:{},on(name,fn){this.events[name]=fn;return this;},
      setView(p,z){this.center=p;this.zoom=z;},invalidateSize(){}};
      return fakeMap;},
    tileLayer(url,options){tiles=layer();tiles.options=options;return tiles;},
    circle(){return layer();},circleMarker(){return layer();},
    marker(pos){marker=layer();marker.position=pos;return marker;}
  };
  const window={L:Leaflet,SC};
  const document={getElementById:$,head:{appendChild(){throw Error('No CDN required in tests');}}};
  const entry=new Function('window','document','navigator','setTimeout','clearTimeout',
    'requestAnimationFrame',script+'\nreturn window.SCMapReview;');
  const api=entry(window,document,{onLine:true},()=>1,()=>{},cb=>cb());
  let ready=false,savedCapture=null,savedArchive=null;
  const review=api.create({
    getCaptureGps:()=>({lat:base.lat,lon:base.lon,accuracy:base.accuracy}),
    getCaptureReady:()=>ready,
    onCaptureConfirm:selection=>{savedCapture=selection;},
    onArchiveConfirm:async(record,selection)=>{
      savedArchive=SC.applyVerifiedPosition(record,selection);return true;
    },
    toast(message){throw Error(message);}
  });
  return{
    $,review,base,
    setReady(value){ready=value;},
    get map(){return fakeMap;},
    get tiles(){return tiles;},
    get marker(){return marker;},
    get savedCapture(){return savedCapture;},
    get savedArchive(){return savedArchive;}
  };
}
async function flush(){for(let i=0;i<5;i++)await Promise.resolve();}
async function run(){
  const gps={lat:base.lat,lon:base.lon,accuracy:base.accuracy};
  const chosen={lat:45.16595,lon:10.51275};
  const corrected=SC.applyVerifiedPosition(base,{original:gps,chosen},'2026-10-29T20:00:00Z');
  assert.ok(SC.isRecord(corrected));
  assert.equal(corrected.positionSource,'manual');
  assert.equal(corrected.gpsOriginal.lat,gps.lat);
  assert.ok(corrected.manualOffsetM>10);
  assert.equal(corrected.id,base.id);
  const legacy={...base};delete legacy.accuracy;
  const legacyResult=SC.applyVerifiedPosition(legacy,{original:{lat:base.lat,lon:base.lon},chosen});
  assert.equal(legacyResult.gpsOriginal.accuracy,null,'nessuna precisione inventata sui vecchi record');
  assert.equal(legacyResult.id,base.id);
  assert.throws(()=>SC.applyVerifiedPosition(base,{original:gps,chosen:{lat:200,lon:20}}));
  assert.match(SC.csv([corrected]),/GPS_originale_lat/);
  assert.match(SC.csv([corrected]),/manual/);
  assert.match(SC.csv([corrected]),/Piazza Castello/);

  const h=harness();
  h.review.openCapture();await flush();
  assert.equal(h.$('map-review-dialog').open,true);
  assert.equal(h.map.options.touchZoom,true,'Pinch zoom abilitato');
  assert.equal(h.map.options.bounceAtZoomLimits,false,'Nessun rimbalzo al limite');
  assert.equal(h.map.options.zoomSnap,0.25,'Zoom fine disponibile');
  assert.equal(h.map.options.maxZoom,21,'Disponibile zoom oltre il livello iniziale 19');
  assert.equal(h.tiles.options.maxZoom,21);
  assert.equal(h.tiles.options.maxNativeZoom,19,'Non richiedere tile native inesistenti');
  assert.equal(h.$('map-review-confirm').disabled,true,'La mappa deve essere visibile');
  h.tiles.events.tileload();
  assert.equal(h.$('map-review-confirm').disabled,true,'Tre letture obbligatorie');
  h.setReady(true);
  h.review.updateGps(gps,true);
  assert.equal(h.$('map-review-confirm').disabled,false);
  h.map.zoom=20.25; // Simula il livello raggiunto con un pinch sul display.
  h.review.updateGps(gps,true);
  assert.equal(h.map.zoom,20.25,'Un aggiornamento GPS non ripristina lo zoom precedente');
  h.map.events.click({latlng:{lat:chosen.lat,lng:chosen.lon}});
  assert.equal(h.map.zoom,20.25,'Lo spostamento del pin non azzera lo zoom');
  assert.match(h.$('map-review-status').textContent,/corretta/);
  await h.$('map-review-confirm').onclick();await flush();
  assert.equal(h.review.isOpen(),false);
  assert.equal(h.savedCapture.moved,true);
  assert.ok(Number.isFinite(h.savedCapture.confirmedAt));
  assert.equal(SC.applyVerifiedPosition(base,h.review.getCaptureSelection()).positionSource,'manual');
  h.review.resetCapture();
  assert.equal(h.review.getCaptureSelection(),null);
  h.review.openArchive(base);await flush();
  assert.match(h.$('map-review-title').textContent,/Piazza Castello, 20/);
  assert.match(h.$('map-review-gps-status').textContent,/Punto già salvato/);
  assert.equal(h.$('map-review-confirm').textContent,'Conferma posizione verificata');
  h.map.events.click({latlng:{lat:chosen.lat,lng:chosen.lon}});
  assert.equal(h.$('map-review-confirm').textContent,'Salva pin corretto');
  await h.$('map-review-confirm').onclick();await flush();
  assert.equal(h.savedArchive.id,base.id);
  assert.equal(h.savedArchive.positionSource,'manual');
  h.review.openArchive(base);await flush();
  h.$('map-review-cancel').onclick();
  assert.equal(h.review.isOpen(),false);
  assert.equal(h.savedArchive.positionSource,'manual','La semplice apertura non cambia il record');
  h.review.openArchive(base);await flush();
  await h.$('map-review-confirm').onclick();await flush();
  assert.equal(h.savedArchive.positionSource,'gps_confirmed','Punto non spostato verificato');
  assert.equal(h.savedArchive.id,base.id,'ID originale preservato');
  assert.equal(h.savedArchive.lat,base.lat);
  assert.equal(h.savedArchive.lon,base.lon);
  console.log('Beta 0.6.16: test mappa e verifica archivio superati.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
