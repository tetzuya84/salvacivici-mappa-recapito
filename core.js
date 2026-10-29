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
function validGpsSample(s){
 return !!s && Number.isFinite(s.lat)&&Math.abs(s.lat)<=90&&Number.isFinite(s.lon)&&Math.abs(s.lon)<=180&&Number.isFinite(s.accuracy)&&s.accuracy>0&&Number.isFinite(s.timestamp);
}
function isFreshGps(sample,now,maxAge){
 return validGpsSample(sample)&&Number.isFinite(now)&&Number.isFinite(maxAge)&&maxAge>=0&&sample.timestamp<=now&&now-sample.timestamp<=maxAge;
}
function bestGpsSample(samples){
 if(!Array.isArray(samples))return null;
 return samples.filter(validGpsSample).reduce((best,s)=>!best||s.accuracy<best.accuracy||(s.accuracy===best.accuracy&&s.timestamp>best.timestamp)?s:best,null);
}
function gpsSpread(samples){
 if(!Array.isArray(samples))return 0;
 const valid=samples.filter(validGpsSample);
 let max=0;
 for(let i=0;i<valid.length;i++)for(let j=i+1;j<valid.length;j++)max=Math.max(max,metersBetween(valid[i],valid[j]));
 return max;
}


/* La Geolocation API espone accuratezza orizzontale in metri, NON potenza satellitare.
   Il punteggio è solo un'indicazione visiva della qualità stimata delle coordinate. */
function gpsQuality(accuracy){
 if(!Number.isFinite(accuracy)||accuracy<=0)return{score:0,label:'Non disponibile',tone:'none'};
 let label,tone;
 if(accuracy<=5){label='Ottima';tone='excellent';}
 else if(accuracy<=10){label='Molto buona';tone='good';}
 else if(accuracy<=20){label='Buona';tone='good';}
 else if(accuracy<=35){label='Discreta';tone='fair';}
 else if(accuracy<=60){label='Debole';tone='poor';}
 else {label='Molto imprecisa';tone='poor';}
 return{score:Math.max(8,Math.min(100,Math.round(100*Math.exp(-accuracy/32)))),label,tone};
}
function hasRequiredGpsReadings(samples,required=3){
 return Array.isArray(samples)&&Number.isInteger(required)&&required>=1&&samples.length>=required&&
   samples.every(validGpsSample)&&new Set(samples.map(sample=>sample.timestamp)).size>=required;
}

/* Comune da confini ISTAT: tutte le coordinate sono [longitudine, latitudine]. */
function insideRing(lon,lat,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if(Math.abs((b[0]-a[0])*(lat-a[1])-(b[1]-a[1])*(lon-a[0]))<1e-10 &&
     lon>=Math.min(a[0],b[0])-1e-10&&lon<=Math.max(a[0],b[0])+1e-10 &&
     lat>=Math.min(a[1],b[1])-1e-10&&lat<=Math.max(a[1],b[1])+1e-10)return true;
  if((a[1]>lat)!==(b[1]>lat) && lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
function insidePolygon(lon,lat,rings){
 if(!rings||!rings.length||!insideRing(lon,lat,rings[0]))return false;
 for(let i=1;i<rings.length;i++)if(insideRing(lon,lat,rings[i]))return false;
 return true;
}
function getComune(lat,lon,features){
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Array.isArray(features))return '';
 for(const f of features){
  const b=f.bbox;
  if(b&&(lon<b[0]||lat<b[1]||lon>b[2]||lat>b[3]))continue;
  const g=f.geometry;
  if(!g)continue;
  const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  if(polys.some(p=>insidePolygon(lon,lat,p)))return f.name;
 }
 return '';
}
/* Unico campo operativo: via e civico finale. Via 24 Maggio 7/A => Via 24 Maggio + 7/A */
function splitAddress(text){
 const s=clean(text);
 const m=s.match(/^(.*?)\s*(?:,\s*|\s+)(\d{1,6}(?:(?:\s*[\/\-]\s*|\s+)[A-Za-z0-9]{1,4}|[A-Za-z])?(?:\s*bis|\s*ter|\s*quater)?|s\.?\s*n\.?\s*c\.?)$/i);
 if(!m)return null;
 const via=clean(m[1]).replace(/[,\s]+$/,'').trim(),civico=clean(m[2]);
 return via&&civico?{via,civico}:null;
}
/* Conserva il fix GPS originale anche quando il pin viene corretto a mano.
   accuracy rimane la precisione dichiarata del GPS originario, NON della correzione. */
function applyVerifiedPosition(record,selection,verifiedAt=new Date().toISOString()){
 const chosen=selection?.chosen,original=selection?.original;
 if(!validGpsPoint(chosen)||!validGpsPoint(original))throw new Error('Coordinate non valide.');
 const accuracy=Number(original.accuracy);
 if(!Number.isFinite(accuracy)||accuracy<=0)throw new Error('Accuratezza GPS non valida.');
 const offset=metersBetween(original,chosen),moved=offset>=.5;
 return {...record,lat:chosen.lat,lon:chosen.lon,accuracy,
   gpsOriginal:{lat:original.lat,lon:original.lon,accuracy},
   positionSource:moved?'manual':'gps_confirmed',
   positionVerifiedAt:verifiedAt,manualOffsetM:moved?Math.round(offset*10)/10:0};
}
function validGpsPoint(point){
 return !!point&&Number.isFinite(point.lat)&&Math.abs(point.lat)<=90&&
   Number.isFinite(point.lon)&&Math.abs(point.lon)<=180;
}
const csvEscape = value => '"'+String(value??'').replace(/"/g,'""')+'"';
function csv(records){
 const header=['Civico','Via','Comune','Latitudine','Longitudine','Precisione_m','Data','Google_Maps',
   'Origine_posizione','GPS_originale_lat','GPS_originale_lon','Precisione_GPS_originale_m','Scostamento_manuale_m'];
 const rows=records.map(r=>{
   const original=r.gpsOriginal||{lat:r.lat,lon:r.lon,accuracy:r.accuracy};
   return [r.civico,r.via,r.comune,r.lat,r.lon,
     r.positionSource==='manual'?'':r.accuracy??'',r.createdAt,
     `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lon}`,
     r.positionSource||'gps_legacy',original.lat,original.lon,original.accuracy??'',r.manualOffsetM??0];
 });
 return '\uFEFF'+[header,...rows].map(row=>row.map(csvEscape).join(',')).join('\r\n')+'\r\n';
}
function isRecord(item){return !!item && typeof item==='object' && typeof item.id==='string' && typeof item.comune==='string' && typeof item.via==='string' && typeof item.civico==='string' && typeof item.createdAt==='string' && Number.isFinite(item.lat) && Math.abs(item.lat)<=90 && Number.isFinite(item.lon)&&Math.abs(item.lon)<=180 && item.comune.trim() && item.via.trim() && item.civico.trim();}
const api={clean,normalized,normalizedCivic,isSameCivic,metersBetween,validGpsSample,isFreshGps,bestGpsSample,gpsSpread,gpsQuality,hasRequiredGpsReadings,applyVerifiedPosition,validGpsPoint,splitAddress,getComune,csv,isRecord};
root.SC=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
