/* Beta 0.6.26 — autorizzazione iOS nel tap, avvio e stop bussola. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('map-features.js','utf8');
async function run(){
 const events={},mapEvents={},layers=[];
 let calls=0,permission='granted';
 let listenersActive=0;
 function node(){return{textContent:'',attrs:{},disabled:false,hidden:true,events:{},
   addEventListener(k,f){this.events[k]=f;},setAttribute(k,v){this.attrs[k]=v;}};}
 const buttons={base:node(),compass:node(),status:node()};
 const L={Map:function(){},tileLayer(url){return{
  on(){return this;},addTo(){layers.push(url);return this;},remove(){}};}};
 L.Map.prototype.setBearing=function(){};
 const bearing=[],heading=[];
 const map={setBearing:n=>bearing.push(n),setHeading:n=>heading.push(n),stopHeadingUp(){},
  on(k,f){mapEvents[k]=f;},removeLayer(){}};
 const DeviceOrientationEvent=function(){};
 DeviceOrientationEvent.requestPermission=()=>{calls++;return Promise.resolve(permission);};
 const win={DeviceOrientationEvent,SCMapReview:{loadLeaflet:async()=>L},
   addEventListener(k,fn){events[k]=fn;listenersActive++;},
   removeEventListener(k){if(events[k]){delete events[k];listenersActive--;}}};
 const doc={head:{appendChild(){}},createElement(){return{}}};
 vm.runInNewContext(source,{window:win,document:doc,setTimeout,clearTimeout,Promise});
 // Promise permission issued immediately by the tap, before Leaflet is constructed.
 const granted=win.SCMapFeatures.primeAutoCompass();
 assert.equal(calls,1);
 const kart=win.SCMapFeatures.create({L,map,baseButton:buttons.base,compassButton:buttons.compass,status:buttons.status});
 const started=await kart.autoStartCompass(granted,()=>true);
 assert.equal(started,true);
 assert.equal(buttons.compass.attrs['aria-pressed'],'true');
 assert.equal(listenersActive,2);
 events.deviceorientation({webkitCompassHeading:54});
 assert.equal(heading.at(-1),54);
 kart.pause();
 assert.equal(listenersActive,0,'Nessuna lettura sensori fuori dalla mappa');
 assert.equal(buttons.compass.attrs['aria-pressed'],'false');
 await kart.autoStartCompass(win.SCMapFeatures.primeAutoCompass(),()=>true);
 assert.equal(calls,1,'Permesso già concesso: non richiedere a ogni ingresso');
 assert.equal(listenersActive,2);
 kart.pause();
 // Permission pending: leaving map must prevent late activation.
 let grantLater;
 permission='granted';
 const pending=new Promise(resolve=>grantLater=resolve);
 const activation=kart.autoStartCompass(pending,()=>false);
 kart.pause();grantLater(true);
 assert.equal(await activation,false,'Niente ascolto se l’utente è già uscito');
 assert.equal(listenersActive,0);
 // Manual restart with explicit tap should still work.
 buttons.compass.events.click();
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(buttons.compass.attrs['aria-pressed'],'true');
 kart.pause();
 // Manual rotation cancels compass.
 buttons.compass.events.click();
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 mapEvents.rotatestart();
 assert.equal(listenersActive,0);
 console.log('PASS Beta 0.6.26: ingresso automatico, permesso iOS, pause e rotazione manuale');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
