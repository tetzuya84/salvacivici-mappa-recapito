/* Beta 0.6.51 — swipe orizzontale nella scheda Giro, anche sulle righe civici. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const begin=source.indexOf('function setupHorizontalTabSwipe(){');
const end=source.indexOf('  setupHorizontalTabSwipe();',begin);
assert.ok(begin>0&&end>begin);
const code=source.slice(begin,end+'  setupHorizontalTabSwipe();'.length);
const tabs=['capture','records','map','giro','data'];
const pages=Object.fromEntries(tabs.map(t=>['page-'+t,{hidden:t!=='giro'}]));
let calls=[];
function showPage(tab){
 calls.push(tab);
 for(const t of tabs)pages['page-'+t].hidden=t!==tab;
}
const events={},main={addEventListener(name,fn){events[name]=fn}};
const document={
 querySelector(selector){
  if(selector==='main')return main;
  if(selector==='dialog[open]')return null;
  return null;
 },
 documentElement:{clientWidth:390}
};
const $=id=>pages[id]||null;
const window={innerWidth:390};
vm.runInNewContext(code,{$,document,window,showPage,Date});
function swipe(startX,endX,kind='label'){
 const target={closest(selector){
   if(kind==='input'&&selector.includes('input'))return{tagName:'INPUT'};
   if(kind==='map'&&selector.includes('#giro-canvas'))return{tagName:'DIV'};
   if(kind==='label'&&selector.includes('label,summary'))return{tagName:'LABEL'};
   if(kind==='label'&&selector.includes('[data-no-swipe]')&&!selector.includes(':not(#giro-stops)'))return{tagName:'DIV'};
   return null;
 }};
 let prevented=false;
 const y=210;
 events.touchstart({touches:[{clientX:startX,clientY:y}],target});
 events.touchmove({touches:[{clientX:endX,clientY:y+3}],cancelable:true,preventDefault(){prevented=true}});
 events.touchend({changedTouches:[{clientX:endX,clientY:y+3}]});
 return prevented;
}
assert.equal(swipe(240,120),true,'Giro: swipe verso sinistra intercettato anche sulla lista');
assert.deepEqual(calls,['data'],'Giro → Dati');
showPage('giro');calls=[];
assert.equal(swipe(120,240),true,'Giro: swipe verso destra intercettato');
assert.deepEqual(calls,['map'],'Giro → Mappa');
showPage('giro');calls=[];
assert.equal(swipe(240,120,'input'),false,'Checkbox e input non intercettati');
assert.equal(swipe(240,120,'map'),false,'Leaflet mantiene il proprio pan');
assert.equal(calls.length,0,'Nessun cambio scheda accidentale');
console.log('PASS Beta 0.6.51: swipe Giro sinistra/destra dalle righe, protezione input e mappa.');
