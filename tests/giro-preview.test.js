/* Beta 0.6.51 — anteprima stradale reale; nessuna linea d'aria se il router fallisce. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('giro-preview.js','utf8');
function encode(points){
 let plat=0,plon=0,out='';
 const part=(num)=>{
  let n=num<0?~(Math.abs(num)):num;
  n=Math.abs(num)<<1;
  if(num<0)n=~n;
  while(n>=0x20){out+=String.fromCharCode((0x20|(n&0x1f))+63);n>>=5;}
  out+=String.fromCharCode(n+63);
 };
 for(const [la,lo] of points){
  const a=Math.round(la*1e6),b=Math.round(lo*1e6);
  part(a-plat);part(b-plon);plat=a;plon=b;
 }
 return out;
}
const start={lat:45.18,lon:10.38},stops=[
 {id:'a',lat:45.19,lon:10.40},{id:'b',lat:45.20,lon:10.41}
];
const leg1=[[45.18,10.38],[45.182,10.391],[45.188,10.392],[45.19,10.40]];
const leg2=[[45.19,10.40],[45.194,10.403],[45.197,10.405],[45.20,10.41]];
const response={
 trip:{legs:[{shape:encode(leg1)},{shape:encode(leg2)}],summary:{length:5.2,time:840}}
};
const dom=new Map();
function node(id){
 if(!dom.has(id))dom.set(id,{id,hidden:id==='page-giro'||id==='giro-preview',textContent:''});
 return dom.get(id);
}
const docs={getElementById:node};
const effects={maps:0,lines:[],markers:[],clears:0,fits:[]};
const layer={addTo(){return this},clearLayers(){effects.clears++;return this}};
const map={invalidateSize(){},fitBounds(bounds){effects.fits.push(bounds)}};
const L={
 map(){effects.maps++;return map},
 layerGroup(){return layer},
 tileLayer(){return{addTo(){return this}}},
 polyline(coords,opts){effects.lines.push({coords,opts});return{addTo(){return this}}},
 marker(coords,opts){effects.markers.push({coords,opts});return{addTo(){return this}}},
 divIcon(opts){return opts},
 latLngBounds(coords){return{coords,pad(){return this}}}
};
const win={SCMapReview:{loadLeaflet:async()=>L}};
vm.runInNewContext(source,{window:win,document:docs,Number,Math,Array,Error,Promise});
const {decodePolyline6,requestRoadRoute}=win.SCGiroPreview.helpers;
assert.deepEqual(Array.from(decodePolyline6('e~epoA|jfpOiDaK')[0]),[42.225139,-8.670911]);
assert.deepEqual(decodePolyline6(encode(leg1)).map(c=>Array.from(c)),leg1);
assert.throws(()=>decodePolyline6('bad!'),/Forma percorso/);
const unchanged=JSON.stringify(stops);
let calls=0,fail=false;
const fetcher=async(url,opts)=>{
 calls++;
 assert.equal(url,'https://valhalla1.openstreetmap.de/route');
 assert.equal(opts.credentials,'omit');
 assert.equal(opts.referrerPolicy,'no-referrer');
 assert.equal(opts.headers['X-Client-Id'],'salvacivici.github.io');
 const payload=JSON.parse(opts.body);
 assert.deepEqual(Object.keys(payload.locations[0]).sort(),['lat','lon']);
 assert.equal(payload.locations.length,3);
 assert.ok(!opts.body.includes('"id"')&&!opts.body.includes('"via"'));
 if(fail)return{ok:false,status:429};
 return{ok:true,json:async()=>response};
};
(async()=>{
 const route=await requestRoadRoute([start,...stops],fetcher);
 assert.equal(route.coords.length,7,'Le tratte sono unite senza duplicare gli incroci');
 assert.deepEqual(Array.from(route.coords[0]),leg1[0]);
 assert.equal(route.km,5.2);
 assert.equal(route.seconds,840);
 const preview=win.SCGiroPreview.create({fetcher});
 preview.draw({origin:start,stops});
 assert.equal(node('giro-preview').hidden,false);
 assert.equal(effects.maps,0,'Lazy load con scheda nascosta');
 node('page-giro').hidden=false;
 await preview.activate();
 assert.equal(effects.maps,1);
 assert.equal(effects.lines.length,2,'Contorno e percorso stradale continui');
 assert.ok(effects.lines.every(x=>!('dashArray' in x.opts)));
 assert.equal(effects.lines[1].coords.length,7,'Polyline non rettilinea: tutte le svolte');
 assert.equal(effects.markers.length,6,'Tre pin per due render');
 assert.match(node('giro-preview-status').textContent,/Percorso sulle strade OpenStreetMap/);
 assert.match(node('giro-preview-status').textContent,/5,2 km/);
 const oldLines=effects.lines.length;
 fail=true;
 preview.draw({origin:start,stops:[stops[0],{id:'c',lat:45.22,lon:10.44}]});
 await preview.activate();
 assert.equal(effects.lines.length,oldLines,'Nessun rettilineo fittizio dopo un errore');
 assert.match(node('giro-preview-status').textContent,/Mostro solo le fermate/);
 assert.equal(JSON.stringify(stops),unchanged,'I dati originali restano invariati');
 preview.draw(null);
 assert.equal(node('giro-preview').hidden,true);
 assert.ok(effects.clears>=1);
 console.log('PASS Beta 0.6.51: geometria Valhalla/polyline6, lazy preview, error without straight line, privacy, no data changes.');
})().catch(e=>{console.error(e);process.exitCode=1});
