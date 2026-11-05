/* SalvaCivici Beta 0.6.59 — ottimizzazione stradale esplicita.
 * Una sola matrice tempi di guida Valhalla su richiesta dell'utente.
 * Percorso aperto: partenza GPS fissa, ultima fermata libera; nessun ritorno.
 * Fino a 12 fermate: soluzione ottima per la matrice con programmazione dinamica.
 * Oltre 12: ricerca multi-start con 2-opt e reinserimento, senza promessa di
 * ottimalita' globale. Nessun fallback silenzioso alla distanza in linea d'aria.
 */
(function(root){
'use strict';
const URL='https://valhalla1.openstreetmap.de/sources_to_targets';
const EXACT_LIMIT=12,MAX_STOPS=20;
const safe=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&
 Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
function readMatrix(body,total){
 const raw=body?.sources_to_targets;
 let times,distances;
 if(raw&&!Array.isArray(raw)&&Array.isArray(raw.durations)){
  times=raw.durations;
  distances=raw.distances;
 }else if(Array.isArray(raw)){
  times=raw.map(row=>Array.isArray(row)?row.map(x=>x?.time):null);
  distances=raw.map(row=>Array.isArray(row)?row.map(x=>x?.distance):null);
 }else throw Error('Matrice stradale non disponibile.');
 function normalize(a,label){
  if(!Array.isArray(a)||a.length!==total)throw Error('Matrice '+label+' incompleta.');
  return a.map((r,i)=>{
   if(!Array.isArray(r)||r.length!==total)throw Error('Matrice '+label+' incompleta.');
   return r.map((v,j)=>{
    // Un solo collegamento irraggiungibile impedisce il calcolo affidabile:
    // non inventare distanze/tempi per le strade mancanti.
    if(!Number.isFinite(v)||v<0)throw Error('Una fermata non è raggiungibile sulla rete stradale.');
    return v;
   });
  });
 }
 return {time:normalize(times,'tempi'),distance:normalize(distances,'distanze')};
}
async function fetchMatrix(points,{fetcher,signal}={}){
 if(!Array.isArray(points)||points.length<2||points.length>MAX_STOPS+1||
   points.some(p=>!safe(p)))throw Error('Fermate o coordinate non valide.');
 const http=fetcher||root.fetch?.bind(root);
 if(typeof http!=='function')throw Error('Connessione Internet necessaria per ottimizzare il giro.');
 const loc=points.map(p=>({lat:p.lat,lon:p.lon}));
 let response;
 try{
  response=await http(URL,{
   method:'POST',
   headers:{'Content-Type':'application/json','X-Client-Id':'salvacivici-mappa-recapito'},
   body:JSON.stringify({sources:loc,targets:loc,costing:'auto',units:'km',verbose:false}),
   signal
  });
 }catch(e){
  if(signal?.aborted)throw Error('Calcolo interrotto o scaduto. Il giro precedente è invariato.');
  throw Error('Servizio stradale non raggiungibile. Il giro precedente è invariato.');
 }
 if(!response?.ok){
  if(response?.status===429)throw Error('Servizio stradale occupato. Riprova più tardi; ordine invariato.');
  throw Error('Impossibile calcolare i tempi stradali ('+(response?.status||'rete')+'). Ordine invariato.');
 }
 let data;
 try{data=await response.json();}catch(_){throw Error('Risposta stradale non valida. Ordine invariato.');}
 return readMatrix(data,points.length);
}
function cost(path,matrix){
 let total=0,prev=0;
 for(const j of path){total+=matrix[prev][j+1];prev=j+1;}
 return total;
}
function exact(matrix,n){
 const size=1<<n,dp=new Float64Array(size*n),parent=new Int16Array(size*n);
 dp.fill(Infinity);parent.fill(-1);
 for(let j=0;j<n;j++)dp[(1<<j)*n+j]=matrix[0][j+1];
 for(let mask=1;mask<size;mask++){
  for(let j=0;j<n;j++){
   if(!(mask&(1<<j)))continue;
   const prevMask=mask^(1<<j);
   if(!prevMask)continue;
   const index=mask*n+j;
   for(let i=0;i<n;i++){
    if(!(prevMask&(1<<i)))continue;
    const value=dp[prevMask*n+i]+matrix[i+1][j+1];
    if(value+1e-8<dp[index]){dp[index]=value;parent[index]=i;}
   }
  }
 }
 const full=size-1;let last=-1,best=Infinity;
 for(let j=0;j<n;j++)if(dp[full*n+j]<best){best=dp[full*n+j];last=j;}
 if(last<0||!Number.isFinite(best))throw Error('Nessun percorso stradale valido.');
 const route=new Array(n);let mask=full;
 for(let idx=n-1;idx>=0;idx--){
  route[idx]=last;
  const prev=parent[mask*n+last];
  mask^=1<<last;last=prev;
 }
 return route;
}
function greedy(matrix,n,first){
 const remaining=new Set(Array.from({length:n},(_,i)=>i));
 const out=[];let current=0;
 if(Number.isInteger(first)&&remaining.has(first)){
  out.push(first);remaining.delete(first);current=first+1;
 }
 while(remaining.size){
  let choice=-1,best=Infinity;
  for(const j of remaining)if(matrix[current][j+1]<best){
   best=matrix[current][j+1];choice=j;
  }
  out.push(choice);remaining.delete(choice);current=choice+1;
 }
 return out;
}
function improve(path,m){
 let route=[...path],best=cost(route,m),passes=0,changed=true;
 while(changed&&passes++<12){
  changed=false;
  // 2-opt: con tempi direzionali e sensi unici calcolare tutto il costo,
  // non usare la scorciatoia simmetrica di 4 archi.
  for(let i=0;i<route.length-1;i++)for(let j=i+1;j<route.length;j++){
   const candidate=route.slice(0,i).concat(route.slice(i,j+1).reverse(),route.slice(j+1));
   const v=cost(candidate,m);
   if(v+1e-7<best){route=candidate;best=v;changed=true;}
  }
  // Reinserimento di una tappa in qualunque punto del giro.
  for(let i=0;i<route.length;i++)for(let j=0;j<route.length;j++){
   if(i===j)continue;
   const candidate=route.slice();
   const [point]=candidate.splice(i,1);candidate.splice(j,0,point);
   const v=cost(candidate,m);
   if(v+1e-7<best){route=candidate;best=v;changed=true;}
  }
 }
 return route;
}
function chooseOrder(matrix,n){
 if(!Number.isInteger(n)||n<1||n>MAX_STOPS||
    !Array.isArray(matrix)||matrix.length!==n+1)throw Error('Matrice errata.');
 if(n<=EXACT_LIMIT)return {path:exact(matrix,n),exact:true};
 const seeds=[Array.from({length:n},(_,i)=>i),greedy(matrix,n)];
 // Provare piu' possibili prime fermate in un percorso a fine libera.
 const sorted=Array.from({length:n},(_,i)=>i).sort((a,b)=>matrix[0][a+1]-matrix[0][b+1]);
 for(const first of sorted.slice(0,Math.min(n,10)))seeds.push(greedy(matrix,n,first));
 let path=seeds[0],best=cost(path,matrix);
 for(const seed of seeds){
  const result=improve(seed,matrix),score=cost(result,matrix);
  if(score+1e-7<best){path=result;best=score;}
 }
 return {path,exact:false};
}
async function optimizeRoad({origin,stops,fetcher,signal}={}){
 if(!safe(origin)||!Array.isArray(stops)||stops.length<1||
    stops.length>MAX_STOPS||stops.some(p=>!safe(p)))throw Error('Coordinate di partenza o fermate non valide.');
 if(stops.length===1)return {stops:[...stops],seconds:0,km:0,beforeSeconds:0,exact:true,single:true};
 const {time,distance}=await fetchMatrix([origin,...stops],{fetcher,signal});
 const {path,exact:isExact}=chooseOrder(time,stops.length);
 const baseline=Array.from({length:stops.length},(_,i)=>i);
 // Non peggiorare un percorso manuale gia' piu' rapido: specialmente
 // con euristiche o matrici direzionali, il costo guida la decisione.
 const originalCost=cost(baseline,time);
 const orderedCost=cost(path,time);
 const kept=originalCost+1e-7<orderedCost?baseline:path;
 return {
  stops:kept.map(i=>stops[i]),seconds:cost(kept,time),
  km:cost(kept,distance),beforeSeconds:originalCost,
  exact:isExact,estimated:true
 };
}
root.SCGiroOptimizer={optimizeRoad,helpers:{readMatrix,cost,chooseOrder,fetchMatrix,exact,improve}};
})(window);
