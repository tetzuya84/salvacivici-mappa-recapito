/* SalvaCivici Beta 0.6.52 — Anteprima stradale di Giro.
 * Usa il demo pubblico Valhalla/OSM per anteprime selezionate dall'utente (fair use).
 * Richiede solo le coordinate; non invia indirizzi, nomi, account, UUID o backup.
 * Nessuna linea d'aria in alternativa: se il router fallisce, restano i pin.
 * L'ordine delle tappe e' definito da Giro, non ottimizzato da questo servizio.
 */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
const ROUTER='https://valhalla1.openstreetmap.de/route';
const safe=r=>r&&Number.isFinite(r.lat)&&Number.isFinite(r.lon)&&
 Math.abs(r.lat)<=90&&Math.abs(r.lon)<=180;
function decodePolyline6(encoded){
 if(typeof encoded!=='string'||!encoded.length)throw Error('Forma percorso non valida.');
 let index=0,latitude=0,longitude=0;
 const coords=[];
 while(index<encoded.length){
  const values=[];
  for(let axis=0;axis<2;axis++){
   let result=0,shift=0,byte=0;
   do{
    if(index>=encoded.length)throw Error('Forma percorso incompleta.');
    byte=encoded.charCodeAt(index++)-63;
    if(byte<0||byte>63||shift>30)throw Error('Forma percorso non valida.');
    result|=(byte&31)<<shift;
    shift+=5;
   }while(byte>=32);
   values.push(result&1?~(result>>1):result>>1);
  }
  latitude+=values[0];longitude+=values[1];
  const point=[latitude/1e6,longitude/1e6];
  if(!safe({lat:point[0],lon:point[1]}))throw Error('Coordinate percorso fuori scala.');
  coords.push(point);
  if(coords.length>50000)throw Error('Percorso troppo complesso.');
 }
 return coords;
}
async function requestRoadRoute(points,fetcher,signal){
 if(!Array.isArray(points)||points.length<2||points.length>21||points.some(p=>!safe(p)))
  throw Error('Fermate o posizione non valide.');
 const res=await fetcher(ROUTER,{
  method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
  referrerPolicy:'no-referrer',signal,
  headers:{'Content-Type':'application/json','X-Client-Id':'salvacivici.github.io'},
  body:JSON.stringify({
   locations:points.map(p=>({lat:p.lat,lon:p.lon})),
   costing:'auto',directions_type:'none',shape_format:'polyline6',units:'kilometers'
  })
 });
 if(!res.ok){
  if(res.status===429)throw Error('Servizio stradale sovraccarico: riprova più tardi.');
  throw Error('Servizio stradale non disponibile (HTTP '+res.status+').');
 }
 const body=await res.json(),trip=body?.trip;
 if(!Array.isArray(trip?.legs)||trip.legs.length!==points.length-1)
  throw Error('Percorso stradale incompleto.');
 const coords=[];
 for(const leg of trip.legs){
  const legPts=decodePolyline6(leg?.shape);
  if(legPts.length<2)throw Error('Tratta stradale incompleta.');
  for(let i=0;i<legPts.length;i++){
   const p=legPts[i];
   if(coords.length&&i===0&&coords.at(-1)[0]===p[0]&&coords.at(-1)[1]===p[1])continue;
   coords.push(p);
  }
  if(coords.length>50000)throw Error('Percorso troppo lungo.');
 }
 if(coords.length<2)throw Error('Percorso stradale non trovato.');
 return {
  coords,
  km:Number.isFinite(trip.summary?.length)?trip.summary.length:null,
  seconds:Number.isFinite(trip.summary?.time)?trip.summary.time:null
 };
}
function create({fetcher}={}){
 const page=$('page-giro'),panel=$('giro-preview'),canvas=$('giro-canvas'),status=$('giro-preview-status');
 let map=null,L=null,layer=null,loading=null,plan=null,generation=0,activeRequest=null;
 let cachedKey='',cachedRoute=null,debounceTimer=null,lastNetworkStart=0;
 const visible=()=>!page.hidden&&!panel.hidden;
 const http=fetcher||root.fetch?.bind(root);
 const getPoints=()=>plan?[plan.origin,...plan.stops]:[];
 const routeKey=points=>points.map(p=>p.lat.toFixed(6)+','+p.lon.toFixed(6)).join(';');
 function stopRequest(){
  generation++;
  if(activeRequest)activeRequest.abort();
  activeRequest=null;
 }
 async function ensureMap(){
  if(map)return;
  if(loading)return loading;
  loading=(async()=>{
   const lib=await (root.SCMapReview?.loadLeaflet?.()||root.SCMapFeatures?.load?.());
   if(!lib||!visible())return;
   L=lib;
   map=L.map(canvas,{
    zoomControl:true,scrollWheelZoom:false,touchZoom:true,
    dragging:true,bounceAtZoomLimits:false,maxZoom:20,zoomSnap:.25
   });
   layer=L.layerGroup().addTo(map);
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:20,maxNativeZoom:19,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
   }).addTo(map);
  })().finally(()=>{loading=null});
  return loading;
 }
 function distanceMeters(a,b){
  const dx=(a.lat-b.lat)*111100,dy=(a.lon-b.lon)*111100*Math.cos(a.lat*Math.PI/180);
  return Math.hypot(dx,dy);
 }
 function markers(points){
  L.marker([points[0].lat,points[0].lon],{
   icon:L.divIcon({className:'giro-marker-start',html:'',iconSize:[19,19],iconAnchor:[9,9]}),
   interactive:false
  }).addTo(layer);
  // Quando due civici sono quasi coincidenti, mostra ENTRAMBI i numeri.
  const groups=[];
  for(let i=1;i<points.length;i++){
   const p=points[i],group=groups.find(g=>distanceMeters(g.point,p)<20);
   if(group)group.numbers.push(i);
   else groups.push({point:p,numbers:[i]});
  }
  for(const group of groups){
   const nums=group.numbers.join('·'),wide=group.numbers.length>1;
   const width=wide?Math.max(43,group.numbers.length*19):29;
   L.marker([group.point.lat,group.point.lon],{
    icon:L.divIcon({
     className:'giro-marker-number',html:nums,
     iconSize:[width,29],iconAnchor:[Math.floor(width/2),14]
    }),interactive:false
   }).addTo(layer);
  }
 }
 function paint(points,road){
  if(!map||!L||!visible())return;
  layer.clearLayers();
  if(road){
   L.polyline(road.coords,{color:'#fff',weight:8,opacity:.9,interactive:false}).addTo(layer);
   L.polyline(road.coords,{color:'#0b847d',weight:5,opacity:.96,interactive:false}).addTo(layer);
  }
  markers(points);
  const bounds=road?road.coords:points.map(p=>[p.lat,p.lon]);
  map.invalidateSize({pan:false});
  map.fitBounds(L.latLngBounds(bounds).pad(.15),{
   padding:[28,28],maxZoom:15,animate:false
  });
 }
 async function activate(){
  if(debounceTimer!==null){clearTimeout(debounceTimer);debounceTimer=null;}
  if(!visible()||!plan)return;
  stopRequest();
  const id=generation,points=getPoints(),key=routeKey(points);
  try{
   await ensureMap();
   if(id!==generation||!visible()||!map)return;
   // Conserva la mappa con i pin, anche quando il servizio stradale fallisce.
   paint(points,null);
   if(cachedKey===key&&cachedRoute){
    paint(points,cachedRoute);
    status.textContent=routeSummary(cachedRoute);
    return;
   }
   status.textContent='Calcolo percorso sulle strade OpenStreetMap…';
   if(typeof http!=='function')throw Error('Servizio stradale non raggiungibile.');
   const ctrl=typeof AbortController==='function'?new AbortController():null;
   activeRequest=ctrl;
   let timer=null;
   try{
    const wait=Math.max(0,1100-(Date.now()-lastNetworkStart));
    if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
    if(id!==generation||!visible())return;
    lastNetworkStart=Date.now();
    if(ctrl)timer=setTimeout(()=>ctrl.abort(),18000);
    const road=await requestRoadRoute(points,http,ctrl?.signal);
    if(id!==generation||!visible())return;
    cachedKey=key;cachedRoute=road;
    paint(points,road);
    status.textContent=routeSummary(road);
   }finally{
    if(timer!==null)clearTimeout(timer);
    if(id===generation)activeRequest=null;
   }
  }catch(e){
   if(id!==generation||!visible())return;
   status.textContent='Percorso sulle strade non disponibile: '+(e?.name==='AbortError'?'richiesta scaduta':e.message||'servizio irraggiungibile')+
    '. Mostro solo le fermate. Per guidare usa Apple Mappe o Google Maps.';
  }
 }
 function routeSummary(road){
  const km=road.km==null?'':road.km.toFixed(1).replace('.',',')+' km';
  const minutes=road.seconds==null?'':' · circa '+Math.round(road.seconds/60)+' min';
  return 'Percorso sulle strade OpenStreetMap'+(km?' · '+km:'')+minutes+
   '. Stima senza traffico; per navigare usa Apple Mappe o Google Maps.';
 }
 function draw(data){
  plan=data&&safe(data.origin)&&Array.isArray(data.stops)&&data.stops.length&&
   data.stops.every(safe)?data:null;
  stopRequest();
  if(debounceTimer!==null){clearTimeout(debounceTimer);debounceTimer=null;}
  panel.hidden=!plan;
  if(!plan){layer?.clearLayers();return;}
  if(visible()){
   status.textContent='Aggiorno l’anteprima sulle strade…';
   debounceTimer=setTimeout(()=>{debounceTimer=null;void activate();},1100);
  }
 }
 return{draw,activate};
}
root.SCGiroPreview={create,helpers:{decodePolyline6,requestRoadRoute}};
})(window);
