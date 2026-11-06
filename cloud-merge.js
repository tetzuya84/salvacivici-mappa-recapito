/* SalvaCivici — fusione conservativa di due archivi.
   Regola: una modifica locale e una remota dello stesso ID = conflitto, mai sovrascrivere. */
(function(root){
 'use strict';
 function sorted(obj){if(Array.isArray(obj))return obj.map(sorted);if(obj&&typeof obj==='object'){const o={};for(const k of Object.keys(obj).sort())o[k]=sorted(obj[k]);return o;}return obj;}
 function same(a,b){return JSON.stringify(sorted(a))===JSON.stringify(sorted(b));}
 function toMap(records){return new Map(records.map(x=>[x.id,x]));}
 // La Mappa permanente e' append-only per le nuove acquisizioni.
 // Una ricezione automatica NON puo' mai sostituire un ID gia' pubblicato
 // con coordinate o dati differenti. L'aggiornamento esplicito usa
 // l'ultima Mappa conosciuta da entrambi i dispositivi come base.
 function publishedUnion(local,remote,base=[],allowVersionedUpdates=false){
   for(const a of [local,remote,base]){
     if(!Array.isArray(a)||a.some(x=>!x||typeof x.id!=='string'||!x.id)||
       new Set(a.map(x=>x.id)).size!==a.length)
       throw Error('Mappa non valida o con ID duplicati. Nessun punto aggiornato.');
   }
   const baseline=toMap(base),left=toMap(local),right=toMap(remote);
   const allIds=new Set([...left.keys(),...right.keys()]);
   const merged=[],conflicts=[],remoteChanged=[];
   for(const id of allIds){
     const l=left.get(id),r=right.get(id),b=baseline.get(id);
     if(l&&r&&!same(l,r)){
       if(!allowVersionedUpdates||!b){
         conflicts.push(id);continue;
       }
       if(same(l,b)&&!same(r,b)){
         merged.push(r);remoteChanged.push(id);continue;
       }
       if(same(r,b)&&!same(l,b)){
         merged.push(l);continue;
       }
       conflicts.push(id);continue;
     }
     if(l||r)merged.push(l||r);
   }
   merged.sort((x,y)=>String(y.createdAt||'').localeCompare(String(x.createdAt||'')));
   return {records:merged,conflicts,remoteChanged};
 }
 function merge(base,local,remote){
   for(const a of [base,local,remote]){
     if(!Array.isArray(a)||a.some(x=>!x||typeof x.id!=='string'||!x.id)||new Set(a.map(x=>x.id)).size!==a.length)
       throw Error('Archivio non valido o ID duplicati.');
   }
   const b=toMap(base),l=toMap(local),r=toMap(remote),ids=new Set([...b.keys(),...l.keys(),...r.keys()]);
   const merged=[],conflicts=[],stats={localOnly:0,remoteOnly:0,equal:0,deleted:0};
   for(const id of ids){
     const old=b.get(id),left=l.get(id),right=r.get(id);
     const lc=!same(old,left),rc=!same(old,right);
     if(lc&&rc&&!same(left,right)){conflicts.push(id);continue;}
     const chosen=lc?left:rc?right:left;
     if(chosen!==undefined)merged.push(chosen);else stats.deleted++;
     if(lc&&!rc)stats.localOnly++;else if(rc&&!lc)stats.remoteOnly++;else stats.equal++;
   }
   merged.sort((x,y)=>String(y.createdAt||'').localeCompare(String(x.createdAt||'')));
   return {records:merged,conflicts,stats};
 }
 root.SCCloudMerge={merge,same,publishedUnion};
})(typeof window!=='undefined'?window:globalThis);
