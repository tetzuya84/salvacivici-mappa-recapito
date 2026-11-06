/* Beta 0.6.46 — regressione: ricerca e Filtri non si sovrappongono ai comandi Mappa. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');
const source=fs.readFileSync('map-features.js','utf8');
const map=html.split('<section id="page-map"')[1]?.split('<section id="page-giro"')[0]||'';
assert.ok(map.includes('id="overview-civic-search"'));
assert.ok(map.includes('id="overview-civic-select"'));
assert.ok(map.includes('id="overview-filter-panel"'));
assert.ok(map.includes('id="overview-basemap"'));
assert.ok(map.includes('id="overview-compass"'));
assert.ok(map.includes('id="overview-locate"'));
const fix=css.split('/* Beta 0.6.46 — Mappa senza sovrapposizioni')[1]||'';
assert.ok(fix.includes('--map-tool-stack-top:81px'),'comandi normali invariati');
assert.ok(fix.includes(':has(#overview-civic-select:not([hidden]))'),'ricerca aperta rilevata');
assert.ok(fix.includes('--map-tool-stack-top:125px'),'comandi spostati sotto risultati');
assert.ok(fix.includes('.overview-map-style-controls'));
assert.ok(fix.includes('.overview-locate'));
assert.ok(fix.includes('.leaflet-top.leaflet-left'),'anche i controlli zoom devono spostarsi');
assert.ok(fix.includes(':has(#overview-filter-panel:not([hidden]))'),'Filtri attivi');
assert.ok(fix.includes('#overview-civic-select{'),'risultati non coprono Filtri aperti');
assert.ok(fix.includes('display:none!important'),'comandi temporaneamente nascosti sotto Filtri');
assert.ok(!source.includes("setStatus('Bussola attiva."),'nessuna fascia di stato attiva permanente');
assert.ok(source.includes('clearStatus();'),'bussola nasconde fascia duplicata');

async function testCompass(){
 const events={},root={
  DeviceOrientationEvent:function(){},
  addEventListener(name,fn){events[name]=fn;},
  removeEventListener(name){delete events[name];}
 };
 const button=()=>({
  textContent:'',disabled:false,attrs:{},handlers:{},
  addEventListener(name,fn){this.handlers[name]=fn},
  setAttribute(name,value){this.attrs[name]=value}
 });
 const baseButton=button(),compassButton=button(),status={hidden:true,textContent:''};
 let ticks=[];
 const L={tileLayer(){return{on(){return this},addTo(){return this}}}};
 const canvas={
  setBearing(){},setHeading(){},stopHeadingUp(){},removeLayer(){},
  on(){return this}
 };
 vm.runInNewContext(source,{
  window:root,document:{},setTimeout:fn=>{ticks.push(fn);return ticks.length},
  clearTimeout:()=>{},
  Promise,Number
 });
 const controls=root.SCMapFeatures.create({L,map:canvas,baseButton,compassButton,status});
 assert.equal(compassButton.disabled,false);
 const ok=await controls.autoStartCompass(Promise.resolve(true),()=>true);
 assert.equal(ok,true);
 assert.match(compassButton.textContent,/Attendo la bussola/);
 events.deviceorientationabsolute({alpha:270,absolute:true});
 assert.match(compassButton.textContent,/Bussola attiva/);
 assert.equal(status.hidden,true,'la fascia Bussola attiva non deve apparire');
 assert.equal(status.textContent,'');
 baseButton.handlers.click();
 assert.match(baseButton.textContent,/Stradale/,'Satellite resta funzionante');
 controls.pause();
 assert.match(compassButton.textContent,/Segui bussola/);
 assert.equal(status.hidden,true);
 const failed=await controls.autoStartCompass(Promise.resolve(false),()=>true);
 assert.equal(failed,false);
 assert.match(status.textContent,/non autorizzata/);
 assert.equal(status.hidden,false,'errore comunicato temporaneamente');
 assert.ok(ticks.length>=1);
 ticks.at(-1)();
 assert.equal(status.hidden,true,'avviso temporaneo si chiude');
}
testCompass().then(()=>console.log('PASS Beta 0.6.46: nessuna sovrapposizione ricerca/filtri, bussola senza fascia persistente.'))
.catch(e=>{console.error(e);process.exitCode=1});
