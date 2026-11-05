/* SalvaCivici Beta 0.6.54 — Giro: pianificazione non distruttiva con civici pubblicati.
 * Nessun record viene creato o modificato; selezione/completamenti restano solo sul dispositivo.
 * L'ordine base usa distanze geografiche, NON tempi stradali. Per gli itinerari su
 * l'anteprima stradale utilizza Valhalla demo, senza traffico in tempo reale.
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
// Un link di navigazione trasferisce un ordine, non ottimizza il tragitto.
// Limiti prudenti: Apple 14 fermate, Google 3 waypoint + destinazione
// su browser mobile. Oltre tali limiti si crea una tranche esplicita.
const APPLE_STOPS=14,GOOGLE_STOPS=4;
const coord=r=>r.lat+','+r.lon;
function apple(r){return 'https://maps.apple.com/?daddr='+coord(r)+'&dirflg=d';}
function google(r){return 'https://www.google.com/maps/dir/?api=1&destination='+coord(r)+'&travelmode=driving';}
function appleRoute(stops){
 if(!Array.isArray(stops)||!stops.length||stops.length>APPLE_STOPS||stops.some(r=>!safe(r)))
  throw Error('Apple Mappe: da 1 a '+APPLE_STOPS+' fermate valide.');
 if(stops.length===1)return apple(stops[0]);
 const dest=stops.at(-1),via=stops.slice(0,-1);
 return 'https://maps.apple.com/directions?destination='+encodeURIComponent(coord(dest))+
  via.map(r=>'&waypoint='+encodeURIComponent(coord(r))).join('')+'&mode=driving';
}
function googleRoute(stops){
 if(!Array.isArray(stops)||!stops.length||stops.length>GOOGLE_STOPS||stops.some(r=>!safe(r)))
  throw Error('Google Maps: da 1 a '+GOOGLE_STOPS+' fermate valide su browser mobile.');
 if(stops.length===1)return google(stops[0]);
 const dest=stops.at(-1),via=stops.slice(0,-1);
 return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(coord(dest))+
  '&travelmode=driving&waypoints='+encodeURIComponent(via.map(coord).join('|'));
}
function create({getRecords,drawRoute,notify,areRecordsReady=()=>true}){
 const page=$('page-giro'),search=$('giro-search'),list=$('giro-stops'),
  count=$('giro-count'),status=$('giro-status'),steps=$('giro-itinerary'),
  next=$('giro-next'),complete=$('giro-complete'),appleLink=$('giro-apple'),
  googleLink=$('giro-google'),routeCoverage=$('giro-route-coverage'),
  singleLinks=$('giro-single-links'),singleApple=$('giro-single-apple'),
  singleGoogle=$('giro-single-google'),gpsHelp=$('giro-gps-help');
 let selected=new Set(),done=new Set(),order=[],origin=null,busy=false;
 let fingerprint='',revision=0,gpsInFlight=null,manualMode=false,manualOrderIds=[];
 function records(){return (getRecords()||[]).filter(r=>safe(r)&&typeof r.id==='string'&&!!r.id);}
 function current(){return records().filter(r=>selected.has(r.id));}
 function save(){
  try{localStorage.setItem(STORAGE,JSON.stringify({selected:[...selected],done:[...done],
   manualOrder:manualMode?manualOrderIds:[]}));}catch(_){}
 }
 function restore(){
  try{
   const v=JSON.parse(localStorage.getItem(STORAGE)||'{}');
   if(Array.isArray(v.selected))selected=new Set(v.selected.filter(x=>typeof x==='string').slice(0,LIMIT));
   if(Array.isArray(v.done))done=new Set(v.done.filter(x=>typeof x==='string'));
   if(Array.isArray(v.manualOrder)&&v.manualOrder.length){
    manualOrderIds=[...new Set(v.manualOrder.filter(x=>typeof x==='string'))].slice(0,LIMIT);
    manualMode=manualOrderIds.length>0;
   }
  }catch(_){}
 }
 function message(text,error=false){
  status.textContent=text;status.classList.toggle('warning',!!error);
 }
 function updateButtons(){
  const has=selected.size>0;

  $('giro-recalc').disabled=busy||!has;
  $('giro-select-all').disabled=busy;
  $('giro-clear').disabled=busy||!has;
  count.textContent=selected.size+' / '+LIMIT+' fermate selezionate';
 }
 function clearPath(){
  order=[];fingerprint='';drawRoute?.(null);renderItinerary();
 }
 function snapshot(){
  return JSON.stringify(current().map(r=>[r.id,r.lat,r.lon]).sort((a,b)=>a[0].localeCompare(b[0])));
 }
 function syncRecords(){
  const was=selected.size;
  // All'avvio IndexedDB non e' ancora stato aperto: non cancellare le fermate
  // salvate nella sessione precedente solo perche' il catalogo e' in caricamento.
  if(areRecordsReady()){
   const ids=new Set(records().map(r=>r.id));
   selected=new Set([...selected].filter(id=>ids.has(id)));
   done=new Set([...done].filter(id=>selected.has(id)));
   if(manualMode){
    manualOrderIds=manualOrderIds.filter(id=>selected.has(id));
    if(!manualOrderIds.length)manualMode=false;
   }
  }
  const changed=order.length&&fingerprint!==snapshot();
  if(changed)clearPath();
  if(was!==selected.size)save();
  renderList();updateButtons();
  if(areRecordsReady()&&selected.size&&(!order.length||changed))void autoEstimate();
  if(areRecordsReady()&&!selected.size&&changed)void autoEstimate();
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
    save();clearPath();renderList();updateButtons();void autoEstimate();
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
 function moveStop(index,delta){
  const other=index+delta;
  if(index<0||other<0||other>=order.length||
    done.has(order[index].id)||done.has(order[other].id))return;
  [order[index],order[other]]=[order[other],order[index]];
  ++revision;
  manualMode=true;manualOrderIds=order.map(r=>r.id);
  save();refreshPath();renderItinerary();
  message('Ordine personalizzato aggiornato.');
 }
 function renderItinerary(){
  steps.replaceChildren();
  for(let i=0;i<order.length;i++){
   const r=order[i],item=document.createElement('li');
   if(done.has(r.id))item.className='giro-done';
   const name=document.createElement('span');
   name.className='giro-itinerary-text';
   name.textContent=label(r)+(done.has(r.id)?' ✓':'');
   const controls=document.createElement('span');
   controls.className='giro-order-controls';
   for(const [delta,symbol,direction] of [[-1,'↑','alto'],[1,'↓','basso']]){
    const button=document.createElement('button');
    button.type='button';button.className='giro-order-move';
    button.textContent=symbol;
    button.setAttribute('aria-label','Sposta '+label(r)+' in '+direction);
    button.disabled=done.has(r.id)||!order[i+delta]||done.has(order[i+delta].id);
    button.addEventListener('click',()=>moveStop(i,delta));
    controls.append(button);
   }
   item.append(name,controls);steps.append(item);
  }
  const remaining=order.filter(r=>!done.has(r.id));
  const target=remaining[0];
  next.hidden=!target;
  if(target){
   const appleCount=Math.min(remaining.length,APPLE_STOPS);
   const googleCount=Math.min(remaining.length,GOOGLE_STOPS);
   appleLink.href=appleRoute(remaining.slice(0,appleCount));
   googleLink.href=googleRoute(remaining.slice(0,googleCount));
   appleLink.textContent='Naviga con Apple Mappe';
   googleLink.textContent='Naviga con Google Maps';
   routeCoverage.textContent='Apple Mappe: '+appleCount+' di '+remaining.length+' fermate\n'+
     'Google Maps: '+googleCount+' di '+remaining.length+' fermate'+
     (appleCount<remaining.length||googleCount<remaining.length?
      '\nLe altre fermate saranno disponibili dopo aver completato le precedenti (limiti dei navigatori mobili).':'');
   singleLinks.hidden=remaining.length===1;
   singleApple.href=apple(target);singleGoogle.href=google(target);
   complete.disabled=busy;
  }else if(order.length)message('Giro completato. Nessun civico è stato modificato.');
 }
 function applyOrder(result,labelText){
  order=result;
  done=new Set([...done].filter(id=>selected.has(id)));
  fingerprint=snapshot();save();refreshPath();renderItinerary();
  message(labelText);
 }
 async function gps(){
  if(!navigator.geolocation?.getCurrentPosition){
   gpsHelp.hidden=false;
   throw Error('GPS non disponibile. Verifica la Localizzazione nelle impostazioni dell’iPhone.');
  }
  let pos;
  try{
   pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{
    enableHighAccuracy:true,maximumAge:10000,timeout:15000
   }));
  }catch(error){
   if(error?.code===1){
    gpsHelp.hidden=false;
    throw Error('GPS non autorizzato. Segui le istruzioni qui sotto e premi «Riprova GPS».');
   }
   if(error?.code===3)throw Error('GPS lento: riprova all’aperto o in un punto con segnale migliore.');
   throw Error('Posizione GPS non disponibile. Riprova.');
  }
  const p={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy};
  if(!safe(p))throw Error('GPS non valido, riprova all’aperto.');
  origin=p;
  gpsHelp.hidden=true;
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
 function autoEstimate(){
  const ticket=++revision;
  if(!current().some(r=>!done.has(r.id))){
   clearPath();message('Seleziona i civici da raggiungere.');return Promise.resolve();
  }
  const apply=()=>{
   if(ticket!==revision)return;
   const stops=current().filter(r=>!done.has(r.id));
   if(!stops.length){clearPath();return;}
   try{
    let ordered=heuristic(origin,stops);
    if(manualMode&&manualOrderIds.length){
     const byId=new Map(stops.map(r=>[r.id,r]));
     const preserved=manualOrderIds.map(id=>byId.get(id)).filter(Boolean);
     const seen=new Set(preserved.map(r=>r.id));
     ordered=preserved.concat(ordered.filter(r=>!seen.has(r.id)));
     manualOrderIds=ordered.map(r=>r.id);
    }
    applyOrder(ordered,'Percorso aggiornato automaticamente · '+ordered.length+' fermate. La sequenza usa la vicinanza geografica; per guidare segui il navigatore.');
   }catch(error){message(error.message||'Impossibile calcolare il giro.',true);}
  };
  if(origin){apply();return Promise.resolve();}
  message('Rilevo la tua posizione per creare il percorso…');
  if(!gpsInFlight)gpsInFlight=gps().finally(()=>{gpsInFlight=null;});
  return gpsInFlight.then(apply,error=>{
   if(ticket!==revision)return;
   clearPath();message(error.message||'GPS non disponibile. Riprova.',true);
  });
 }
 async function estimate(refetch){
  await withBusy(async()=>{
   const ticket=++revision;
   if(!current().some(r=>!done.has(r.id))){message('Seleziona almeno un civico da raggiungere.',true);return;}
   if(refetch||!origin){message('Acquisisco il GPS di partenza…');await gps();}
   if(ticket!==revision)return;
   const stops=current().filter(r=>!done.has(r.id));
   if(!stops.length){clearPath();return;}
   manualMode=false;manualOrderIds=[];
   applyOrder(heuristic(origin,stops),
    'Percorso ricalcolato dal GPS · '+stops.length+' fermate. Sequenza per vicinanza geografica, senza traffico in tempo reale.');
  });
 }
 // La nuova scheda Giro e' gestita dalla barra di navigazione principale.
 // Il passaggio Mappa/Giro non azzera selezione, sequenza o fermate completate.
 function open(){syncRecords();}
 function close(){/* Stato del Giro mantenuto sul dispositivo. */}

 $('giro-recalc').addEventListener('click',()=>void estimate(true));
 $('giro-gps-help-retry').addEventListener('click',()=>void withBusy(async()=>{
   await gps();
   if(selected.size)await autoEstimate();
   else message('GPS autorizzato. Posizione aggiornata.');
 }));

 $('giro-search').addEventListener('input',renderList);
 $('giro-select-all').addEventListener('click',()=>{
  const terms=normalize(search.value).split(/\s+/).filter(Boolean);
  const filtered=records().filter(r=>terms.every(t=>normalize(label(r)).includes(t)));
  for(const r of filtered){if(selected.size>=LIMIT)break;selected.add(r.id);}
  save();clearPath();renderList();updateButtons();void autoEstimate();
 });
 $('giro-clear').addEventListener('click',()=>{
  selected.clear();done.clear();manualMode=false;manualOrderIds=[];save();clearPath();renderList();updateButtons();
  ++revision;message('Selezione azzerata. I civici sono invariati.');
 });
 complete.addEventListener('click',()=>{
  const item=order.find(r=>!done.has(r.id));
  if(!item)return;
  done.add(item.id);save();refreshPath();renderItinerary();
 });
 root.addEventListener('salvacivici:mapchanged',syncRecords);
 restore();syncRecords();renderItinerary();
 return {refresh:syncRecords,open,close,
  helpers:{heuristic,distance,routeDistance,appleRoute,googleRoute}};
}
root.SCGiro={create,helpers:{heuristic,distance,routeDistance,appleRoute,googleRoute}};
})(window);
