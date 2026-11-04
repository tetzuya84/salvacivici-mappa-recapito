/* Beta 0.6.43 — Mappa con recupero GPS iPhone e overlay Giro non distruttivo. */
(function(root){
'use strict';
function valid(r){
 return r&&Number.isFinite(r.lat)&&Math.abs(r.lat)<=90&&
   Number.isFinite(r.lon)&&Math.abs(r.lon)<=180;
}
function statusOf(r){return r.positionSource==='manual'?'manual':r.positionSource==='gps_confirmed'?'verified':'unverified';}
function appleDirections(r){return 'https://maps.apple.com/?daddr='+r.lat+','+r.lon+'&dirflg=d';}
function googleDirections(r){return 'https://www.google.com/maps/dir/?api=1&destination='+r.lat+','+r.lon+'&travelmode=driving';}
function create({getRecords,onVerify,onEditData,notify}){
 const $=id=>document.getElementById(id);
 const town=$('overview-town'),filter=$('overview-status-filter'),
   civicSearch=$('overview-civic-search'),civicSelect=$('overview-civic-select'),
   summary=$('overview-summary'),empty=$('overview-empty'),detail=$('overview-detail'),
   title=$('overview-selected-title'),sub=$('overview-selected-status'),
   coord=$('overview-selected-coordinates'),apple=$('overview-apple'),google=$('overview-google'),
   loading=$('overview-loading'),
   locateButton=$('overview-locate'),locationStatus=$('overview-location-status'),
   gpsHelp=$('overview-gps-help'),gpsHelpRetry=$('overview-gps-help-retry'),
   gpsHelpClose=$('overview-gps-help-close'),
   editPinButton=$('overview-edit-pin'),editDataButton=$('overview-edit-data'),
   nearbyPanel=$('overview-nearby'),nearbyTitle=$('overview-nearby-title'),
   nearbyOptions=$('overview-nearby-options'),
   sheetToggle=$('overview-sheet-toggle'),sheetBody=$('overview-sheet-body'),
   sheetCaption=$('overview-sheet-caption'),filterToggle=$('overview-filters-toggle'),
   filterPanel=$('overview-filter-panel');
 let map=null,L=null,layer=null,selectedId=null,loadingPromise=null,initialized=false,hasTiles=false;
 let locationMarker=null,locationAccuracy=null,locating=false,cartography=null,autoCompassPermission=null;
 let giroLine=null,giroPending=null;
 function drawGiro(data){
   giroPending=data;
   if(!map||!L)return;
   if(giroLine){map.removeLayer?.(giroLine);giroLine=null;}
   if(!data||!valid(data.origin)||!Array.isArray(data.stops)||!data.stops.length)return;
   const coords=[data.origin,...data.stops].filter(valid).map(r=>[r.lat,r.lon]);
   if(coords.length<2||typeof L.polyline!=='function')return;
   // LINEA SCHEMATICA: non coincide necessariamente con strade percorribili.
   giroLine=L.polyline(coords,{color:'#087f79',weight:4,opacity:.9,
     dashArray:'8 10',interactive:false}).addTo(map);
   map.fitBounds(L.latLngBounds(coords).pad(.2),{
     maxZoom:15,paddingTopLeft:[30,110],paddingBottomRight:[30,135],animate:false});
 }
 const visible=()=>!$('page-map').hidden;
 const records=()=>getRecords().filter(valid);
 function setSheetExpanded(expanded){
   sheetBody.hidden=!expanded;
   sheetToggle.setAttribute('aria-expanded',String(expanded));
 }
 function setFiltersExpanded(expanded){
   filterPanel.hidden=!expanded;
   filterToggle.setAttribute('aria-expanded',String(expanded));
 }
 function updateSheetCaption(list){
   const item=selectedRecord();
   sheetCaption.textContent=item?item.via+', '+item.civico+' · '+item.comune:
     list.length+' '+(list.length===1?'civico':'civici')+' sulla mappa';
 }
 function normalizedSearch(value){
   return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
     .toLocaleLowerCase('it-IT').replace(/[^a-z0-9]+/g,' ').trim();
 }
 const searchTerm=()=>normalizedSearch(civicSearch.value);
 function matchesSearch(record,term){
   if(!term)return true;
   const searchable=normalizedSearch([record.comune,record.via,record.civico].join(' '));
   return term.split(/\s+/).every(part=>searchable.includes(part));
 }
 // Seleziona fra tutti i civici gia' pubblicati, senza alterare filtri
 // e senza leggere la coda delle acquisizioni.
 function rebuildCivicPicker(){
   const selected=civicSelect.value||selectedId||'';
   const term=searchTerm();
   const all=filtered().sort((a,b)=>a.comune.localeCompare(b.comune,'it')||
       a.via.localeCompare(b.via,'it')||String(a.civico).localeCompare(String(b.civico),'it'));
   civicSelect.replaceChildren();
   const placeholder=document.createElement('option');
   placeholder.value='';
   placeholder.textContent=term?'Risultati: '+all.length+' · scegli un civico':'Seleziona il civico dalla tendina…';
   civicSelect.append(placeholder);
   for(const record of all){
     const option=document.createElement('option');
     option.value=record.id;
     option.textContent=record.via+', '+record.civico+' · '+record.comune;
     civicSelect.append(option);
   }
   civicSelect.value=all.some(r=>r.id===selected)?selected:'';
   civicSelect.hidden=!term;
 }
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
 // Due ingressi possono avere coordinate diverse di pochi metri:
 // le etichette Leaflet possono coprirsi senza che manchi alcun record.
 // Confrontiamo i pixel ALLA SCALA ATTUALE, senza spostare i GPS reali.
 function closeEnough(a,b){
   if(!map)return false;
   // Leaflet non ha ancora un'origine pixel alla prima renderizzazione.
   // Prima di fitBounds usiamo soltanto la distanza reale.
   if(!Number.isFinite(map.getZoom?.()))
     return map.distance([a.lat,a.lon],[b.lat,b.lon])<12;
   const p=map.latLngToContainerPoint([a.lat,a.lon]);
   const q=map.latLngToContainerPoint([b.lat,b.lon]);
   return Math.hypot(p.x-q.x,p.y-q.y)<40;
 }
 function nearbyFor(item){
   if(!item||!map)return [];
   return filtered().filter(r=>r.id===item.id||closeEnough(r,item))
     .sort((a,b)=>a.via.localeCompare(b.via,'it')||String(a.civico).localeCompare(String(b.civico),'it'));
 }
 function drawNearby(item){
   const close=nearbyFor(item);
   nearbyPanel.hidden=close.length<2;
   nearbyOptions.replaceChildren();
   if(close.length<2)return;
   nearbyTitle.textContent=close.length+' civici molto vicini: scegli quello corretto';
   for(const record of close){
     const button=document.createElement('button');
     button.type='button';
     button.className='overview-nearby-choice';
     button.textContent=record.via+', '+record.civico;
     button.setAttribute('aria-pressed',String(item.id===record.id));
     if(item.id===record.id)button.classList.add('active');
     button.addEventListener('click',()=>select(record));
     nearbyOptions.append(button);
   }
 }
 function select(r){
   const previousId=selectedId;
   selectedId=r?.id||null;
   const item=selectedRecord();
   if(item&&item.id!==previousId){setSheetExpanded(true);setFiltersExpanded(false);}
   if(!item&&previousId)setSheetExpanded(false);
   updateSheetCaption(filtered());
   detail.hidden=!item;
   editPinButton.hidden=!item;
   editDataButton.hidden=!item;
   drawNearby(item);
   if(!item)return;
   editPinButton.setAttribute('aria-label','Modifica pin: '+item.via+', '+item.civico+', '+item.comune);
   title.textContent=item.via+', '+item.civico;
   sub.textContent=item.comune+' · '+(statusOf(item)==='manual'?'Pin corretto':statusOf(item)==='verified'?'Verificato':'Da verificare');
   coord.textContent=item.lat.toFixed(7)+', '+item.lon.toFixed(7);
   if([...civicSelect.options].some(x=>x.value===item.id))civicSelect.value=item.id;
   apple.href=appleDirections(item);google.href=googleDirections(item);
 }
 function filtered(){
   const term=searchTerm();
   return records().filter(r=>(!town.value||r.comune===town.value)&&
     (!filter.value||statusOf(r)===filter.value)&&matchesSearch(r,term));
 }
 function render(refit){
   if(!map||!layer)return;
   options();
   rebuildCivicPicker();
   const list=filtered();
   const term=searchTerm();
   layer.clearLayers();
   if(!list.some(r=>r.id===selectedId))select(null);
   // Il conteggio indica QUANTI punti sono pubblicati, non quante etichette
   // rimangono visibili quando due numeri civici si coprono sulla cartografia.
   const hasClosePair=list.some((r,i)=>list.slice(i+1).some(next=>closeEnough(r,next)));
   summary.textContent=(term?list.length+' '+(list.length===1?'risultato':'risultati')+
     ' sulla mappa per «'+civicSearch.value.trim()+'»':list.length+' civici sulla mappa')+
     (hasClosePair?' · Punti molto vicini: tocca un numero per distinguerli.':'');
   empty.hidden=list.length!==0;
   updateSheetCaption(list);
   if(term&&!list.length)setSheetExpanded(true);
   empty.textContent=term?'Nessun civico pubblicato corrisponde alla ricerca.':
     'Nessun civico corrisponde ai filtri selezionati.';
   if(!list.length){nearbyPanel.hidden=true;nearbyOptions.replaceChildren();return;}
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
   if(term&&list.length===1)select(list[0]);
   else if(selectedId)select(selectedRecord());
   if(refit){
     if(bounds.length===1)map.setView(bounds[0],19,{animate:false});
     else{
       // Nelle prove con ingressi a circa 5 m, lo zoom 17 comprimeva
       // due segnaposti "51" in un solo simbolo. Zoom fino a 20
       // solo quando tutti i punti sono concentrati in un'area minima.
       const compact=map.distance(bounds[0],bounds.reduce((far,p)=>
         map.distance(bounds[0],p)>map.distance(bounds[0],far)?p:far,bounds[0]))<55;
       map.fitBounds(L.latLngBounds(bounds).pad(.15),
         {maxZoom:compact?20:17,padding:[28,28],animate:false});
     }
   }
 }
 function showLocationMessage(message){
   locationStatus.hidden=false;
   locationStatus.textContent=message;
 }
 function hideGpsGuide(){gpsHelp.hidden=true;}
 function showGpsGuide(){
   gpsHelp.hidden=false;
   showLocationMessage('GPS non autorizzato dall’iPhone. Segui le istruzioni nella Mappa e riprova.');
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
   hideGpsGuide();
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
       hideGpsGuide();
       showLocationMessage('Posizione attuale individuata'+(gpsAccuracy===null?'':' · GPS ±'+gpsAccuracy+' m')+'.');
       finishLocate();
     },error=>{
       finishLocate();
       if(error?.code===1){
         // Il blocco di iOS richiede intervento nelle impostazioni, non toast ripetuti.
         showGpsGuide();
         return;
       }
       const reason=error?.code===3?'Tempo GPS scaduto. Riprova all’aperto.':
         'Posizione GPS non disponibile. Riprova.';
       showLocationMessage(reason);
       notify?.(reason);
     },{enableHighAccuracy:true,maximumAge:0,timeout:14000});
   }catch(_){
     showLocationMessage('Impossibile accedere alla posizione GPS.');
     finishLocate();
   }
 }
 function update(){if(map&&visible())render(false);}
 async function open(permission){
   if(!visible())return;
   if(permission)autoCompassPermission=permission;
   if(map){
     render(false);
     root.requestAnimationFrame(()=>map.invalidateSize({pan:false}));
     void cartography?.autoStartCompass(autoCompassPermission,visible);
     return;
   }
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
       map.on('zoomend',()=>render(false));
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
       if(giroPending)drawGiro(giroPending);
       root.requestAnimationFrame(()=>map.invalidateSize({pan:false}));
       void cartography?.autoStartCompass(autoCompassPermission,visible);
     }catch(e){
       loading.hidden=false;loading.textContent=e?.message||'Impossibile caricare la mappa.';
       notify?.('La cartografia richiede Internet.');
     }finally{loadingPromise=null;}
   })();
   return loadingPromise;
 }
 town.addEventListener('change',()=>render(true));
 filter.addEventListener('change',()=>render(true));
 civicSearch.addEventListener('input',()=>{
   // La ricerca prevale sui filtri precedenti; aggiorna subito anche i pin e la vista.
   town.value='';filter.value='';
   setFiltersExpanded(false);
   render(true);
 });
 civicSelect.addEventListener('change',()=>{
   const item=records().find(r=>r.id===civicSelect.value);
   if(!item)return;
   // Un civico trovato nella tendina deve essere visibile anche se
   // prima erano attivi filtri sul comune o sullo stato.
   town.value='';filter.value='';
   render(false);
   select(item);
   if(map)map.setView([item.lat,item.lon],19,{animate:false});
   civicSearch.blur?.();
 });
 function editSelected(){const r=selectedRecord();if(r)onVerify(r);}
 function editSelectedData(){const r=selectedRecord();if(r)onEditData?.(r);}
 sheetToggle.addEventListener('click',()=>setSheetExpanded(sheetBody.hidden));
 filterToggle.addEventListener('click',()=>setFiltersExpanded(filterPanel.hidden));
 editPinButton.addEventListener('click',editSelected);
 editDataButton.addEventListener('click',editSelectedData);
 locateButton.addEventListener('click',locate);
 gpsHelpRetry.addEventListener('click',locate);
 gpsHelpClose.addEventListener('click',hideGpsGuide);
 if(!initialized){
   root.addEventListener('salvacivici:mapchanged',update);
   initialized=true;
 }
 return {open,refresh:update,select,drawGiro,pauseCompass:()=>{autoCompassPermission=null;cartography?.pause();},helpers:{valid,statusOf,appleDirections,googleDirections}};
}
root.SCMapOverview={create};
})(window);
