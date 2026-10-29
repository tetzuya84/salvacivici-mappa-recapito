/* Beta 0.6.11 — revisione del pin su cartografia, senza geocoding o scritture cloud.
   Leaflet viene caricato solo quando l'utente apre la mappa; i tile OSM richiedono rete. */
(function(root){
'use strict';
const leafletVersion='1.9.4';
const leafletBase='https://unpkg.com/leaflet@'+leafletVersion+'/dist/';
const cssIntegrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const jsIntegrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
let leafletLoading=null;
function loadLeaflet(){
  if(root.L)return Promise.resolve(root.L);
  if(leafletLoading)return leafletLoading;
  leafletLoading=new Promise((resolve,reject)=>{
    if(!navigator.onLine){reject(new Error('Per aprire la cartografia serve una connessione Internet.'));return;}
    if(!document.getElementById('salvacivici-leaflet-style')){
      const css=document.createElement('link');
      css.id='salvacivici-leaflet-style';css.rel='stylesheet';css.href=leafletBase+'leaflet.css';
      css.integrity=cssIntegrity;css.crossOrigin='anonymous';
      document.head.appendChild(css);
    }
    const script=document.createElement('script');script.src=leafletBase+'leaflet.js';
    script.integrity=jsIntegrity;script.crossOrigin='anonymous';
    const timer=setTimeout(()=>reject(new Error('Caricamento della mappa scaduto. Verifica Internet.')),15000);
    script.onload=()=>{clearTimeout(timer);if(root.L)resolve(root.L);else reject(new Error('Libreria cartografica non disponibile.'));};
    script.onerror=()=>{clearTimeout(timer);reject(new Error('Mappa non disponibile: controlla la connessione.'));};
    document.head.appendChild(script);
  }).catch(error=>{leafletLoading=null;throw error;});
  return leafletLoading;
}
const valid=point=>!!point&&Number.isFinite(point.lat)&&Math.abs(point.lat)<=90&&
  Number.isFinite(point.lon)&&Math.abs(point.lon)<=180;
function create({getCaptureGps,getCaptureReady,onCaptureConfirm,onArchiveConfirm,toast}){
  const $=id=>document.getElementById(id);
  let captureSelection=null,active=null,map=null,pin=null,gpsDot=null,accuracyCircle=null,busy=false,tilesVisible=false;
  const status=$('map-review-status'),confirmButton=$('map-review-confirm');
  const point=p=>({lat:Number(p.lat),lon:Number(p.lon)});
  function redraw(){
    if(!active)return;
    const original=active.original,chosen=active.chosen;
    if(!valid(original)||!valid(chosen))return;
    const distance=root.SC.metersBetween(original,chosen);
    const moved=active.moved&&distance>=.5;
    const accuracy=Number.isFinite(original.accuracy)?Math.round(original.accuracy):null;
    status.textContent=!active.mapLoaded?'Attendo la cartografia: il pin potrà essere confermato solo quando la mappa sarà visibile.':
      moved?'Posizione corretta di '+Math.round(distance)+' m rispetto al GPS. Controlla che il pin sia sull’ingresso.':
      'Pin sul GPS'+(accuracy!==null?' (precisione stimata ±'+accuracy+' m)':'')+'. Trascina il pin o tocca l’ingresso sulla mappa.';
    $('map-review-coordinates').textContent=chosen.lat.toFixed(7)+', '+chosen.lon.toFixed(7);
    $('map-review-gps-status').textContent=active.kind==='capture'
      ?(active.ready?'3/3 letture GPS · scegli l’ingresso':'Attendi le tre letture GPS prima di confermare')
      :'Correzione di un civico già salvato';
    confirmButton.disabled=busy||!active.ready||!active.mapLoaded;
    confirmButton.textContent=moved?'Usa posizione corretta':'Conferma questo punto';
    $('map-review-reset').disabled=busy||!active.moved;
    if(map&&pin){
      pin.setLatLng([chosen.lat,chosen.lon]);
      gpsDot.setLatLng([original.lat,original.lon]);
      accuracyCircle.setLatLng([original.lat,original.lon]);
      accuracyCircle.setRadius(Math.min(Number(original.accuracy)||10,500));
    }
  }
  function setPosition(latlng){
    if(!active||busy)return;
    const chosen={lat:Number(latlng.lat),lon:Number(latlng.lng)};
    if(!valid(chosen))return;
    active.chosen=chosen;
    active.moved=root.SC.metersBetween(chosen,active.original)>=.5;
    redraw();
  }
  function ensureMap(){
    if(!active||!root.L)return;
    const L=root.L;
    if(!map){
      map=L.map($('map-review-canvas'),{zoomControl:true,attributionControl:true,scrollWheelZoom:false,maxZoom:19});
      const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
        maxZoom:19,maxNativeZoom:19,
        attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
      });
      tiles.on('tileload',()=>{
        tilesVisible=true;
        $('map-review-loading').hidden=true;
        if(active){active.mapLoaded=true;redraw();}
      });
      tiles.on('tileerror',()=>{
        if(active&&!active.mapLoaded){
          $('map-review-loading').hidden=false;
          $('map-review-loading').textContent='La cartografia non si carica. Verifica Internet; il GPS resta disponibile.';
        }
      });
      tiles.addTo(map);
      accuracyCircle=L.circle([active.original.lat,active.original.lon],{
        radius:Math.min(Number(active.original.accuracy)||10,500),color:'#0d8e86',
        weight:1,fillColor:'#0d8e86',fillOpacity:.08,interactive:false
      }).addTo(map);
      gpsDot=L.circleMarker([active.original.lat,active.original.lon],{
        radius:5,color:'#136b68',fillColor:'#48c1b6',fillOpacity:1,weight:2,interactive:false
      }).addTo(map);
      pin=L.marker([active.chosen.lat,active.chosen.lon],{draggable:true,autoPan:true,title:'Trascina il pin sull’ingresso effettivo'}).addTo(map);
      pin.on('dragend',()=>setPosition(pin.getLatLng()));
      map.on('click',event=>setPosition(event.latlng));
    }
    active.mapLoaded=tilesVisible;
    redraw();
    map.setView([active.chosen.lat,active.chosen.lon],19,{animate:false});
    requestAnimationFrame(()=>map&&map.invalidateSize({pan:false}));
  }
  function close(){
    if($('map-review-dialog').open)$('map-review-dialog').close();
    active=null;busy=false;confirmButton.disabled=false;
  }
  async function open(selection){
    if(!selection||!valid(selection.original)||!valid(selection.chosen)){
      toast('Attendi almeno la prima posizione GPS.');return;
    }
    active={...selection,mapLoaded:false};
    const dialog=$('map-review-dialog');
    dialog.showModal();
    $('map-review-canvas').hidden=false;
    $('map-review-loading').hidden=false;
    $('map-review-loading').textContent='Caricamento della mappa…';
    redraw();
    try{
      await loadLeaflet();
      if(!active||!dialog.open)return;
      $('map-review-loading').hidden=true;
      ensureMap();
    }catch(error){
      if(!active||!dialog.open)return;
      active.mapLoaded=false;
      $('map-review-canvas').hidden=true;
      $('map-review-loading').hidden=false;
      $('map-review-loading').textContent=error.message;
      confirmButton.disabled=true;
    }
  }
  function openCapture(){
    const gps=getCaptureGps();
    if(!valid(gps)){toast('Attendi la prima lettura GPS.');return;}
    const selection=captureSelection&&valid(captureSelection.chosen)?captureSelection:null;
    void open({
      kind:'capture',original:{...gps},
      chosen:selection?point(selection.chosen):point(gps),
      moved:!!selection?.moved,ready:getCaptureReady()
    });
  }
  function openArchive(record){
    const original=valid(record.gpsOriginal)?{...record.gpsOriginal}:{lat:record.lat,lon:record.lon,accuracy:record.accuracy};
    void open({kind:'archive',record,original,chosen:point(record),
      moved:root.SC.metersBetween(original,record)>=.5,ready:true});
  }
  function updateGps(sample,ready){
    if(!active||active.kind!=='capture'||!valid(sample))return;
    active.original={...sample};active.ready=!!ready;
    if(!active.moved)active.chosen=point(sample);
    redraw();
  }
  function resetCapture(){
    captureSelection=null;
    if(active?.kind==='capture')close();
  }
  function getCaptureSelection(){return captureSelection?{...captureSelection,original:{...captureSelection.original},chosen:{...captureSelection.chosen}}:null;}
  $('map-review-close').addEventListener('click',close);
  $('map-review-cancel').addEventListener('click',close);
  $('map-review-dialog').addEventListener('cancel',event=>{event.preventDefault();close();});
  $('map-review-reset').addEventListener('click',()=>{
    if(!active||busy)return;
    active.chosen=point(active.original);active.moved=false;
    if(map)map.setView([active.chosen.lat,active.chosen.lon],19,{animate:false});
    redraw();
  });
  confirmButton.addEventListener('click',async()=>{
    if(!active||busy||!active.ready||!active.mapLoaded||!valid(active.chosen))return;
    const selection={
      original:{lat:active.original.lat,lon:active.original.lon,accuracy:active.original.accuracy},
      chosen:point(active.chosen),
      moved:active.moved&&root.SC.metersBetween(active.original,active.chosen)>=.5,
      confirmedAt:Date.now()
    };
    if(active.kind==='capture'){
      captureSelection=selection;
      onCaptureConfirm(selection);
      close();
      return;
    }
    busy=true;confirmButton.disabled=true;
    try{
      if(await onArchiveConfirm(active.record,selection)!==false)close();
      else{busy=false;redraw();}
    }catch(error){busy=false;redraw();toast('Impossibile salvare la nuova posizione.');}
  });
  return{openCapture,openArchive,updateGps,resetCapture,getCaptureSelection,isOpen:()=>!!active};
}
root.SCMapReview={create};
})(window);
