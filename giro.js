/* SalvaCivici Beta 0.6.42 — Giro: pianificazione non distruttiva con civici pubblicati.
 * Nessun record viene creato o modificato; selezione/completamenti restano solo sul dispositivo.
 * L'ordine base usa distanze geografiche, NON tempi stradali. Per gli itinerari su
 * rete stradale serve una chiave GraphHopper personale e un piano adatto all'uso.
 */
(function(root){
'use strict';
const LIMIT=20, STORAGE='salvacivici-giro-v1';
const $=id=>document.getElementById(id);
const safe=v=>v&&Number.isFinite(v.lat)&&Math.abs(v.lat)<=90&&Number.isFinite(v.lon)&&Math.abs(v.lon)<=180;
const label=r=>r.via+', '+r.civico+' · '+r.comune;
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLocaleLowerCase('it-IT').replace(/[^a-z0-9]+/g,' ').trim();
function distance(a,b){
 const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
function routeDistance(start,stops){
 let total=0,previous=start;
 for(const p of stops){total+=distance(previous,p);previous=p;}
 return total;
}
function heuristic(start,stops){
 if(!safe(start)||stops.some(r=>!safe(r)))throw Error('Coordinate non valide.');
 const left=[...stops],ordered=[];let last=start;
 while(left.length){
  let idx=0;
  for(let i=1;i<left.length;i++)
   if(distance(last,left[i])<distance(last,left[idx]))idx=i;
  const chosen=left.splice(idx,1)[0];ordered.push(chosen);last=chosen;
 }
 // Miglioramento 2-opt di un percorso aperto. NON stima tempi stradali.
 let improved=true,passes=0;
 while(improved&&passes++<30){
  improved=false;let bestCost=routeDistance(start,ordered);
  for(let i=0;i<ordered.length-1;i++){
   for(let j=i+1;j<ordered.length;j++){
    const candidate=ordered.slice(0,i).concat(ordered.slice(i,j+1).reverse(),ordered.slice(j+1));
    const cost=routeDistance(start,candidate);
    if(cost+0.01<bestCost){ordered.splice(0,ordered.length,...candidate);bestCost=cost;improved=true;}
   }
  }
 }
 return ordered;
}
function apple(r){return 'https://maps.apple.com/?daddr='+r.lat+','+r.lon+'&dirflg=d';}
function google(r){return 'https://www.google.com/maps/dir/?api=1&destination='+r.lat+','+r.lon+'&travelmode=driving';}
async function graphhopper(start,stops,key,fetcher){
 if(!safe(start)||!Array.isArray(stops)||!stops.length||stops.length>LIMIT||stops.some(r=>!safe(r)))
  throw Error('Punti non validi per il routing stradale.');
 if(!key||typeof key!=='string')throw Error('Inserisci una chiave API GraphHopper valida.');
 const ids=stops.map((_,i)=>'s'+i);
 const body={
  configuration:{routing:{calc_points:false}},
  objectives:[{type:'min',value:'completion_time'}],
  vehicles:[{vehicle_id:'v1',type_id:'car',start_address:{location_id:'partenza',lat:start.lat,lon:start.lon},return_to_depot:false}],
  vehicle_types:[{type_id:'car',profile:'car'}],
  services:stops.map((r,i)=>({id:ids[i],type:'service',address:{location_id:ids[i],lat:r.lat,lon:r.lon},duration:0}))
 };
 // Non inviare nomi, numeri civici, e-mail, UUID originali o dati di Google Drive.
 const res=await fetcher('https://graphhopper.com/api/1/vrp?key='+encodeURIComponent(key),{
  method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'
 });
 if(!res.ok){
  if(res.status===401||res.status===403)throw Error('GraphHopper: chiave non autorizzata o piano non abilitato.');
  if(res.status===429)throw Error('GraphHopper: limite di richieste raggiunto.');
  throw Error('Servizio stradale non disponibile (HTTP '+res.status+').');
 }
 const response=await res.json();
 if(response.unassigned?.length||response.solution?.unassigned?.length)
  throw Error('Non tutte le fermate sono raggiungibili sulle strade.');
 const solution=response.solution||response;
 const routes=solution.routes||[];
 if(routes.length!==1||!Array.isArray(routes[0]?.activities))throw Error('Risposta stradale non valida.');
 const indices=routes[0].activities.filter(a=>a.type==='service').map(a=>ids.indexOf(String(a.id||a.service_id||'')));
 if(indices.length!==stops.length||new Set(indices).size!==stops.length||indices.some(i=>i<0))
  throw Error('Ordine stradale incompleto: non applicato.');
 return{
  order:indices.map(i=>stops[i]),
  distanceMeters:Number.isFinite(solution.distance)?solution.distance:null,
  durationSeconds:Number.isFinite(solution.transport_time)?solution.transport_time:null
 };
}
function create({getRecords,drawRoute,notify}){
 const panel=$('giro-panel'),search=$('giro-search'),list=$('giro-stops'),
  count=$('giro-count'),status=$('giro-status'),steps=$('giro-itinerary'),
  next=$('giro-next'),complete=$('giro-complete'),appleLink=$('giro-apple'),
  googleLink=$('giro-google'),keyInput=$('giro-api-key'),road=$('giro-road'),
  originLabel=$('giro-origin');
 let selected=new Set(),done=new Set(),order=[],origin=null,mode='indicativo',busy=false;
 let fingerprint='',lastRoad=null;
 function records(){return (getRecords()||[]).filter(r=>safe(r)&&typeof r.id==='string'&&!!r.id);}
 function current(){return records().filter(r=>selected.has(r.id));}
 function save(){
  try{localStorage.setItem(STORAGE,JSON.stringify({selected:[...selected],done:[...done]}));}catch(_){}
 }
 function restore(){
  try{
   const v=JSON.parse(localStorage.getItem(STORAGE)||'{}');
   if(Array.isArray(v.selected))selected=new Set(v.selected.filter(x=>typeof x==='string').slice(0,LIMIT));
   if(Array.isArray(v.done))done=new Set(v.done.filter(x=>typeof x==='string'));
  }catch(_){}
 }
 function message(text,error=false){
  status.textContent=text;status.classList.toggle('warning',!!error);
 }
 function updateButtons(){
  const has=selected.size>0;
  $('giro-order').disabled=busy||!has;
  road.disabled=busy||!has||!keyInput.value.trim();
  $('giro-locate').disabled=busy;
  $('giro-recalc').disabled=busy||!has;
  $('giro-select-all').disabled=busy;
  $('giro-clear').disabled=busy||!has;
  count.textContent=selected.size+' / '+LIMIT+' fermate selezionate';
 }
 function clearPath(){
  order=[];lastRoad=null;fingerprint='';mode='indicativo';drawRoute?.(null);renderItinerary();
 }
 function snapshot(){
  return JSON.stringify(current().map(r=>[r.id,r.lat,r.lon]).sort((a,b)=>a[0].localeCompare(b[0])));
 }
 function syncRecords(){
  const ids=new Set(records().map(r=>r.id));
  const was=selected.size;
  selected=new Set([...selected].filter(id=>ids.has(id)));
  done=new Set([...done].filter(id=>selected.has(id)));
  if(order.length&&fingerprint!==snapshot()){
   clearPath();
   message('I civici della Mappa sono cambiati: ricalcola il giro.',true);
  }
  if(was!==selected.size)save();
  renderList();updateButtons();
 }
 function renderList(){
  const query=normalize(search.value);
  list.replaceChildren();
  const options=records().filter(r=>!query||query.split(/\s+/).every(t=>normalize(label(r)).includes(t)))
    .sort((a,b)=>a.comune.localeCompare(b.comune,'it')||a.via.localeCompare(b.via,'it')||String(a.civico).localeCompare(String(b.civico),'it'));
  for(const r of options){
   const row=document.createElement('label');row.className='giro-stop-row';
   const input=document.createElement('input');input.type='checkbox';input.checked=selected.has(r.id);
   input.disabled=busy||(!input.checked&&selected.size>=LIMIT);
   input.addEventListener('change',()=>{
    if(input.checked&&selected.size>=LIMIT){input.checked=false;message('Massimo '+LIMIT+' fermate per giro.',true);return;}
    if(input.checked)selected.add(r.id);else{selected.delete(r.id);done.delete(r.id);}
    save();clearPath();renderList();updateButtons();
   });
   const title=document.createElement('span');title.textContent=label(r);
   row.append(input,title);list.append(row);
  }
  if(!options.length){const p=document.createElement('p');p.textContent='Nessun civico pubblicato corrisponde alla ricerca.';list.append(p);}
 }
 function refreshPath(){
  const remaining=order.filter(r=>!done.has(r.id));
  const lastDone=[...order].reverse().find(r=>done.has(r.id));
  const first=lastDone||origin;
  drawRoute?.(remaining.length&&first?{origin:first,stops:remaining,road:false}:null);
 }
 function renderItinerary(){
  steps.replaceChildren();
  for(let i=0;i<order.length;i++){
   const r=order[i],item=document.createElement('li');
   if(done.has(r.id))item.className='giro-done';
   item.textContent=(i+1)+'. '+label(r)+(done.has(r.id)?' ✓':'');
   steps.append(item);
  }
  const target=order.find(r=>!done.has(r.id));
  next.hidden=!target;
  if(target){
   $('giro-next-label').textContent=label(target);
   appleLink.href=apple(target);googleLink.href=google(target);complete.disabled=busy;
  }else if(order.length)message('Giro completato. Nessun civico è stato modificato.');
 }
 function applyOrder(result,labelText){
  order=result;
  done=new Set([...done].filter(id=>selected.has(id)));
  fingerprint=snapshot();save();refreshPath();renderItinerary();
  message(labelText);
 }
 async function gps(){
  if(!navigator.geolocation?.getCurrentPosition)throw Error('GPS non disponibile su questo dispositivo.');
  const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{
   enableHighAccuracy:true,maximumAge:10000,timeout:15000
  }));
  const p={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy};
  if(!safe(p))throw Error('GPS non valido, riprova all’aperto.');
  origin=p;
  originLabel.textContent='Partenza GPS: '+p.lat.toFixed(5)+', '+p.lon.toFixed(5)+
   (Number.isFinite(p.accuracy)?' (±'+Math.round(p.accuracy)+' m)':'');
  if(p.accuracy>100)message('Partenza GPS imprecisa (±'+Math.round(p.accuracy)+' m): riprova prima di guidare.',true);
  return p;
 }
 async function withBusy(task){
  if(busy)return;
  busy=true;updateButtons();
  try{await task();}
  catch(error){message(error.message||'Operazione non riuscita: dati invariati.',true);}
  finally{busy=false;updateButtons();}
 }
 async function estimate(refetch){
  await withBusy(async()=>{
   const stops=current().filter(r=>!done.has(r.id));
   if(!stops.length){message('Seleziona almeno un civico da raggiungere.',true);return;}
   if(refetch||!origin){message('Acquisisco il GPS di partenza…');await gps();}
   const ordered=heuristic(origin,stops);
   applyOrder(ordered,'Ordine indicativo per distanza geometrica (≈'+(routeDistance(origin,ordered)/1000).toFixed(1)+' km in linea d’aria). NON è il percorso stradale più veloce.');
  });
 }
 async function optimizeRoad(){
  await withBusy(async()=>{
   const stops=current().filter(r=>!done.has(r.id));
   if(!stops.length){message('Seleziona almeno un civico.',true);return;}
   const token=keyInput.value.trim();
   if(!token){message('Inserisci la chiave GraphHopper. Non viene salvata nel dispositivo.',true);return;}
   if(!origin)await gps();
   message('Calcolo tempi e ordine sulla rete stradale…');
   const result=await graphhopper(origin,stops,token,fetch);
   mode='stradale';lastRoad=result;
   applyOrder(result.order,'Ordine ottimizzato da GraphHopper sulla rete stradale'+
    (result.durationSeconds!=null?' · guida stimata '+Math.round(result.durationSeconds/60)+' min':'')+
    '. Le linee sulla mappa sono schematiche; per le svolte usa Naviga.');
  });
 }
 $('giro-open').addEventListener('click',()=>{
  panel.hidden=false;syncRecords();$('giro-open').hidden=true;
  message('Seleziona i civici e calcola il giro. Nessuna acquisizione viene modificata.');
 });
 $('giro-close').addEventListener('click',()=>{panel.hidden=true;$('giro-open').hidden=false;});
 $('giro-order').addEventListener('click',()=>void estimate(false));
 $('giro-recalc').addEventListener('click',()=>void estimate(true));
 $('giro-locate').addEventListener('click',()=>void withBusy(async()=>{await gps();clearPath();message('Posizione GPS rilevata. Calcola il giro.');}));
 $('giro-road').addEventListener('click',()=>void optimizeRoad());
 $('giro-api-key').addEventListener('input',updateButtons);
 $('giro-search').addEventListener('input',renderList);
 $('giro-select-all').addEventListener('click',()=>{
  const filtered=records().filter(r=>normalize(label(r)).includes(normalize(search.value)));
  for(const r of filtered){if(selected.size>=LIMIT)break;selected.add(r.id);}
  save();clearPath();renderList();updateButtons();
 });
 $('giro-clear').addEventListener('click',()=>{
  selected.clear();done.clear();save();clearPath();renderList();updateButtons();message('Selezione azzerata. I civici sono invariati.');
 });
 complete.addEventListener('click',()=>{
  const item=order.find(r=>!done.has(r.id));
  if(!item)return;
  done.add(item.id);save();refreshPath();renderItinerary();
 });
 root.addEventListener('salvacivici:mapchanged',syncRecords);
 restore();syncRecords();renderItinerary();
 return {refresh:syncRecords,close:()=>{panel.hidden=true;$('giro-open').hidden=false;},
  helpers:{heuristic,graphhopper,distance,routeDistance}};
}
root.SCGiro={create,helpers:{heuristic,graphhopper,distance,routeDistance}};
})(window);
