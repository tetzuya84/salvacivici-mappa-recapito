/* Helpers indipendenti dall'interfaccia, testabili anche da Node.js. */
(function(root){
'use strict';
const clean = value => String(value||'').trim().replace(/\s+/g,' ');
const normalized = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it-IT').replace(/[.]/g,'');
const normalizedCivic = value => normalized(value).replace(/[\s/._-]/g,'');
function isSameCivic(a,b){return normalized(a.comune)===normalized(b.comune)&&normalized(a.via)===normalized(b.via)&&normalizedCivic(a.civico)===normalizedCivic(b.civico);}
function metersBetween(a,b){
  const toRad = x=>x*Math.PI/180;
  const rad=6371000, dlat=toRad(b.lat-a.lat),dlon=toRad(b.lon-a.lon);
  const x=Math.sin(dlat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dlon/2)**2;
  return 2*rad*Math.asin(Math.min(1,Math.sqrt(x)));
}
const csvEscape = value => '"'+String(value??'').replace(/"/g,'""')+'"';
function csv(records){
 const header=['Civico','Via','Comune','Latitudine','Longitudine','Precisione_m','Data','Google_Maps'];
 const rows = records.map(r=>[r.civico,r.via,r.comune,r.lat,r.lon,r.accuracy??'',r.createdAt,`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lon}`]);
 return '\uFEFF'+[header,...rows].map(row=>row.map(csvEscape).join(',')).join('\r\n')+'\r\n';
}
function isRecord(item){return !!item && typeof item==='object' && typeof item.id==='string' && typeof item.comune==='string' && typeof item.via==='string' && typeof item.civico==='string' && typeof item.createdAt==='string' && Number.isFinite(item.lat) && Math.abs(item.lat)<=90 && Number.isFinite(item.lon)&&Math.abs(item.lon)<=180 && item.comune.trim() && item.via.trim() && item.civico.trim();}
const api={clean,normalized,normalizedCivic,isSameCivic,metersBetween,csv,isRecord};
root.SC=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
