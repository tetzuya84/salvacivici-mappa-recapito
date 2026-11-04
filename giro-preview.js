/* SalvaCivici Beta 0.6.44 — anteprima dedicata del Giro, distinta dalla Mappa.
 * Segmenti tratteggiati geometrici: NON sono strade né indicazioni di guida.
 * Non registra GPS, non modifica civici e non invia dati a server aggiuntivi.
 */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
const safe=r=>r&&Number.isFinite(r.lat)&&Number.isFinite(r.lon)&&
 Math.abs(r.lat)<=90&&Math.abs(r.lon)<=180;
function create(){
 const page=$('page-giro'),panel=$('giro-preview'),canvas=$('giro-canvas'),status=$('giro-preview-status');
 let map=null,L=null,routeLayer=null,loading=null,last=null,generation=0;
 const visible=()=>!page.hidden&&!panel.hidden;
 async function ensureMap(){
  if(map)return;
  if(loading)return loading;
  loading=(async()=>{
   const library=await (root.SCMapReview?.loadLeaflet?.()||root.SCMapFeatures?.load?.());
   if(!library||!visible())return;
   L=library;
   map=L.map(canvas,{
    zoomControl:true,scrollWheelZoom:false,touchZoom:true,
    dragging:true,bounceAtZoomLimits:false,maxZoom:20,zoomSnap:.25
   });
   routeLayer=L.layerGroup().addTo(map);
   const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:20,maxNativeZoom:19,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
   });
   tiles.addTo(map);
  })().finally(()=>{loading=null});
  return loading;
 }
 function paint(){
  if(!map||!L||!visible()||!last)return;
  routeLayer.clearLayers();
  const pts=[last.origin,...last.stops].filter(safe);
  if(pts.length<2)return;
  const coords=pts.map(p=>[p.lat,p.lon]);
  L.polyline(coords,{
   color:'#0c817b',weight:3,opacity:.9,dashArray:'7 9',
   interactive:false
  }).addTo(routeLayer);
  L.marker(coords[0],{
   icon:L.divIcon({className:'giro-marker-start',html:'',iconSize:[19,19],iconAnchor:[9,9]}),
   interactive:false
  }).addTo(routeLayer);
  for(let i=1;i<coords.length;i++){
   L.marker(coords[i],{
    icon:L.divIcon({
     className:'giro-marker-number',html:String(i),
     iconSize:[29,29],iconAnchor:[14,14]
    }),interactive:false
   }).addTo(routeLayer);
  }
  map.invalidateSize({pan:false});
  map.fitBounds(L.latLngBounds(coords).pad(.16),{
   padding:[28,28],maxZoom:15,animate:false
  });
  status.textContent='Linee tratteggiate schematiche: non indicano le strade. Segui Apple Mappe o Google Maps per la guida.';
 }
 async function activate(){
  if(!visible()||!last)return;
  const attempt=++generation;
  try{
   await ensureMap();
   if(attempt!==generation||!visible())return;
   if(root.requestAnimationFrame)root.requestAnimationFrame(()=>paint());
   else paint();
  }catch(_){
   // In assenza della cartografia si puo' comunque seguire l'itinerario testuale.
   status.textContent='Anteprima mappa non disponibile. Le fermate e i pulsanti Naviga restano utilizzabili.';
  }
 }
 function draw(data){
  last=data&&safe(data.origin)&&Array.isArray(data.stops)&&data.stops.length?data:null;
  panel.hidden=!last;
  if(!last){
   generation++;
   routeLayer?.clearLayers();
   return;
  }
  void activate();
 }
 return{draw,activate};
}
root.SCGiroPreview={create};
})(window);
