/* Beta 0.6.19 — mappa civici con pulsante GPS «La mia posizione». */
(function(root){
'use strict';
function valid(r){
 return r&&Number.isFinite(r.lat)&&Math.abs(r.lat)<=90&&
   Number.isFinite(r.lon)&&Math.abs(r.lon)<=180;
}
function statusOf(r){return r.positionSource==='manual'?'manual':r.positionSource==='gps_confirmed'?'verified':'unverified';}
function appleDirections(r){return 'https://maps.apple.com/?daddr='+r.lat+','+r.lon+'&dirflg=d';}
function googleDirections(r){return 'https://www.google.com/maps/dir/?api=1&destination='+r.lat+','+r.lon+'&travelmode=driving';}
function create({getRecords,onVerify,notify}){
 const $=id=>document.getElementById(id);
 const town=$('overview-town'),filter=$('overview-status-filter'),
   summary=$('overview-summary'),empty=$('overview-empty'),detail=$('overview-detail'),
   title=$('overview-selected-title'),sub=$('overview-selected-status'),
   coord=$('overview-selected-coordinates'),apple=$('overview-apple'),google=$('overview-google'),
   verify=$('overview-verify'),loading=$('overview-loading'),
   locateButton=$('overview-locate'),locationStatus=$('overview-location-status');
 let map=null,L=null,layer=null,selectedId=null,loadingPromise=null,initialized=false,hasTiles=false;
 let locationMarker=null,locationAccuracy=null,locating=false,cartography=null;
 const visible=()=>!$('page-map').hidden;
 const records=()=>getRecords().filter(valid);
 function options(){
   const current=town.value;
   const names=[...new Set(records().map(r=>r.comune.trim()).filter(Boolean))]
     .sort((a,b)=>a.localeCompare(b,'it'));
   town.replaceChildren();
   const all=document.createElement('option');all.value='';all.textContent='Tutti i comuni';town.append(all);
   for(const name of names){const opt=document.createElement('option');opt.value=name;opt.textContent=name;town.append(opt);}
   town.value=names.includes(current)?current:'';
 }
 function selectedRecord(){
   return records().find(r=>r.id===selectedId)||null;
 }
 function select(r){
   selectedId=r?.id||null;
   const item=selectedRecord();
   detail.hidden=!item;
   if(!item)return;
   title.textContent=item.via+', '+item.civico;
   sub.textContent=item.comune+' · '+(statusOf(item)==='manual'?'Pin corretto':statusOf(item)==='verified'?'Verificato':'Da verificare');
   coord.textContent=item.lat.toFixed(7)+', '+item.lon.toFixed(7);
   apple.href=appleDirections(item);google.href=googleDirections(item);
 }
 function filtered(){
   return records().filter(r=>(!town.value||r.comune===town.value)&&
     (!filter.value||statusOf(r)===filter.value));
 }
 function render(refit){
   if(!map||!layer)return;
   options();
   const list=filtered();
   layer.clearLayers();
   if(!list.some(r=>r.id===selectedId))select(null);
   summary.textContent=list.length+' civici sulla mappa';
   empty.hidden=list.length!==0;
   if(!list.length)return;
   const bounds=[];
   for(const r of list){
     const label=document.createElement('span');label.className='overview-pin-label';label.textContent=r.civico;
     const size=Math.max(31,Math.min(66,18+String(r.civico).length*8));
     const icon=L.divIcon({className:'overview-pin overview-pin-'+statusOf(r),
       html:label,iconSize:[size,32],iconAnchor:[size/2,32]});
     const marker=L.marker([r.lat,r.lon],{icon,keyboard:true,title:r.via+', '+r.civico+', '+r.comune}).addTo(layer);
     marker.on('click',()=>select(r));
     bounds.push([r.lat,r.lon]);
   }
   if(selectedId)select(selectedRecord());
   if(refit){
     if(bounds.length===1)map.setView(bounds[0],19,{animate:false});
     else map.fitBounds(L.latLngBounds(bounds).pad(.15),{maxZoom:17,padding:[28,28],animate:false});
   }
 }
 function showLocationMessage(message){
   locationStatus.hidden=false;
   locationStatus.textContent=message;
 }
 function finishLocate(){locating=false;locateButton.disabled=!map;locateButton.textContent='◎ La mia posizione';}
 // Richiesta GPS volontaria, senza tracciare, sincronizzare o registrare dati civici.
 function locate(){
   if(!map||locating)return;
   if(!navigator.geolocation||typeof navigator.geolocation.getCurrentPosition!=='function'){
     showLocationMessage('Posizione non disponibile: attiva la geolocalizzazione sul dispositivo.');
     notify?.('Geolocalizzazione non disponibile.');
     return;
   }
   locating=true;locateButton.disabled=true;locateButton.textContent='Ricerca GPS…';
   showLocationMessage('Ricerca della posizione attuale…');
   try{
     navigator.geolocation.getCurrentPosition(position=>{
       const {latitude,longitude,accuracy}=position?.coords||{};
       if(!valid({lat:latitude,lon:longitude})){
         showLocationMessage('Il GPS ha restituito coordinate non valide. Riprova.');
         finishLocate();return;
       }
       const point=[latitude,longitude];
       const gpsAccuracy=Number.isFinite(accuracy)&&accuracy>0?Math.round(accuracy):null;
       if(locationMarker)locationMarker.setLatLng(point);
       else locationMarker=L.circleMarker(point,{
         radius:9,color:'#ffffff',weight:3,fillColor:'#1478e3',fillOpacity:1,
         interactive:false,bubblingMouseEvents:false
       }).addTo(map);
       // Il cerchio di precisione non è né un civico né una posizione salvata.
       if(gpsAccuracy!==null&&gpsAccuracy<=500){
         if(locationAccuracy){
           locationAccuracy.setLatLng(point);
           locationAccuracy.setRadius(gpsAccuracy);
         }else locationAccuracy=L.circle(point,{
           radius:gpsAccuracy,color:'#1478e3',weight:1,fillColor:'#1478e3',
           fillOpacity:.08,interactive:false,bubblingMouseEvents:false
         }).addTo(map);
       }else if(locationAccuracy){locationAccuracy.remove();locationAccuracy=null;}
       map.setView(point,18,{animate:false});
       showLocationMessage('Posizione attuale individuata'+(gpsAccuracy===null?'':' · GPS ±'+gpsAccuracy+' m')+'.');
       finishLocate();
     },error=>{
       const reason=error?.code===1?'Consenti la posizione nelle impostazioni del browser o dell’app.':
         error?.code===3?'Tempo GPS scaduto. Riprova in un punto con segnale migliore.':
         'Posizione GPS non disponibile. Riprova.';
       showLocationMessage(reason);
       finishLocate();
       notify?.(reason);
     },{enableHighAccuracy:true,maximumAge:0,timeout:14000});
   }catch(_){
     showLocationMessage('Impossibile accedere alla posizione GPS.');
     finishLocate();
   }
 }
 function update(){if(map&&visible())render(false);}
 async function open(){
   if(!visible())return;
   if(map){render(false);root.requestAnimationFrame(()=>map.invalidateSize({pan:false}));return;}
   if(loadingPromise)return loadingPromise;
   loading.hidden=false;
   loading.textContent='Caricamento cartografia…';
   loadingPromise=(async()=>{
     try{
       L=await (root.SCMapFeatures?.load?.()||root.SCMapReview.loadLeaflet());
       if(!visible())return;
       map=L.map($('overview-canvas'),{zoomControl:true,scrollWheelZoom:false,touchZoom:true,
         bounceAtZoomLimits:false,zoomSnap:0.25,maxZoom:21,rotate:typeof L.Map?.prototype?.setBearing==='function',
         touchRotate:true,rotateControl:false,preventPageGestures:true});
       layer=L.layerGroup().addTo(map);
       locateButton.disabled=false;
       if(root.SCMapFeatures){
         cartography=root.SCMapFeatures.create({L,map,baseButton:$('overview-basemap'),compassButton:$('overview-compass'),
           status:$('overview-layer-status'),
           onTileLoad:()=>{hasTiles=true;loading.hidden=true;},
           onTileError:()=>{if(!hasTiles){loading.hidden=false;loading.textContent='Cartografia non disponibile. Controlla Internet.';}}
         });
       }else{
       const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
         {maxZoom:21,maxNativeZoom:19,
          attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'});
       tiles.on('tileload',()=>{hasTiles=true;loading.hidden=true;});
       tiles.on('tileerror',()=>{if(!hasTiles){loading.hidden=false;loading.textContent='Cartografia non disponibile. Controlla Internet.';}});
       tiles.addTo(map);
       }
       options();render(true);
       root.requestAnimationFrame(()=>map.invalidateSize({pan:false}));
     }catch(e){
       loading.hidden=false;loading.textContent=e?.message||'Impossibile caricare la mappa.';
       notify?.('La cartografia richiede Internet.');
     }finally{loadingPromise=null;}
   })();
   return loadingPromise;
 }
 town.addEventListener('change',()=>render(true));
 filter.addEventListener('change',()=>render(true));
 verify.addEventListener('click',()=>{const r=selectedRecord();if(r)onVerify(r);});
 locateButton.addEventListener('click',locate);
 if(!initialized){
   root.addEventListener('salvacivici:datachanged',update);
   initialized=true;
 }
 return {open,refresh:update,select,pauseCompass:()=>cartography?.pause(),helpers:{valid,statusOf,appleDirections,googleDirections}};
}
root.SCMapOverview={create};
})(window);
