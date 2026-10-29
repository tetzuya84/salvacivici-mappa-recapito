/* SalvaCivici — fusione conservativa di due archivi.
   Regola: una modifica locale e una remota dello stesso ID = conflitto, mai sovrascrivere. */
(function(root){
 'use strict';
 function sorted(obj){if(Array.isArray(obj))return obj.map(sorted);if(obj&&typeof obj==='object'){const o={};for(const k of Object.keys(obj).sort())o[k]=sorted(obj[k]);return o;}return obj;}
 function same(a,b){return JSON.stringify(sorted(a))===JSON.stringify(sorted(b));}
 function toMap(records){return new Map(records.map(x=>[x.id,x]));}
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
 root.SCCloudMerge={merge,same};
})(typeof window!=='undefined'?window:globalThis);
