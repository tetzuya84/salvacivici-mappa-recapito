/* Beta 0.6.63 — nord magnetico iPhone e nessun alpha arbitrario. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('map-features.js','utf8');
function makeApple(){
 const listeners={},mapEvents={},angles=[],bearing=[],buttons={};
 const node=()=>({textContent:'',disabled:false,hidden:true,attrs:{},events:{},
  addEventListener(k,fn){this.events[k]=fn},
  setAttribute(k,v){this.attrs[k]=v}});
 const base=node(),compass=node(),status=node();
 const DeviceOrientationEvent=function(){};
 DeviceOrientationEvent.requestPermission=()=>Promise.resolve('granted');
 const win={DeviceOrientationEvent,screen:{orientation:{angle:0}},
  SCMapReview:{loadLeaflet:async()=>({})},
  addEventListener(k,fn){listeners[k]=fn},removeEventListener(k){delete listeners[k]}};
 const map={setHeading(x){angles.push(x)},setBearing(x){bearing.push(x)},stopHeadingUp(){},
  on(k,fn){mapEvents[k]=fn},removeLayer(){}};
 const L={Map:function(){},tileLayer(){return{on(){return this},addTo(){return this}}}};
 L.Map.prototype.setBearing=function(){};
 vm.runInNewContext(src,{window:win,document:{},setTimeout,clearTimeout,Promise});
 const api=win.SCMapFeatures.create({L,map,baseButton:base,compassButton:compass,status});
 return{win,api,map,angles,bearing,listeners,mapEvents,base,compass,status};
}
(async()=>{
 const h=makeApple();
 await h.api.autoStartCompass(h.win.SCMapFeatures.primeAutoCompass(),()=>true);
 assert.match(h.compass.textContent,/Attendo/);
 assert.equal(h.compass.attrs['aria-pressed'],'false');
 // Invalid relative iOS alpha must NEVER rotate the map.
 h.listeners.deviceorientation({alpha:123,absolute:true});
 h.listeners.deviceorientationabsolute({alpha:180,absolute:true});
 assert.equal(h.angles.length,0,'Safari alpha is arbitrary, not true north');
 // Rejected uncalibrated readings: no false active compass.
 h.listeners.deviceorientation({webkitCompassHeading:95,webkitCompassAccuracy:-1,alpha:90});
 h.listeners.deviceorientation({webkitCompassHeading:95,webkitCompassAccuracy:60,alpha:90});
 assert.equal(h.angles.length,0,'Unreliable compass accuracy is rejected');
 assert.match(h.compass.textContent,/Attendo/);
 // Valid heading clockwise from magnetic north.
 h.listeners.deviceorientation({webkitCompassHeading:90,webkitCompassAccuracy:5,alpha:223});
 assert.equal(h.angles.at(-1),90,'Map plugin rotates map negative of heading');
 assert.equal(h.compass.attrs['aria-pressed'],'true');
 assert.match(h.compass.textContent,/Bussola attiva/);
 // A simultaneous absolute alpha stream cannot overwrite WebKit heading.
 h.listeners.deviceorientationabsolute({alpha:150,absolute:true});
 assert.equal(h.angles.length,1);
 // Rotate phone screen 90 deg: align compass with top of screen.
 h.win.screen.orientation.angle=90;
 h.listeners.deviceorientation({webkitCompassHeading:180,webkitCompassAccuracy:6});
 assert.equal(h.angles.at(-1),90);
 h.win.screen.orientation.angle=0;
 h.listeners.deviceorientation({webkitCompassHeading:350,webkitCompassAccuracy:5});
 assert.equal(h.angles.at(-1),350);
 h.api.pause();
 assert.equal(h.compass.attrs['aria-pressed'],'false');
 assert.equal(Object.keys(h.listeners).length,0);
 // Non-iOS devices may use real absolute orientation, never relative alpha.
 const listeners={},angles=[],doc={};
 const win={DeviceOrientationEvent:function(){},
  addEventListener(k,fn){listeners[k]=fn},removeEventListener(k){delete listeners[k]}};
 vm.runInNewContext(src,{window:win,document:doc,setTimeout,clearTimeout,Promise});
 const fake={setHeading:n=>angles.push(n),setBearing(){},on(){}};
 const L={Map:function(){},tileLayer(){return{on(){return this},addTo(){return this}}}};
 L.Map.prototype.setBearing=function(){};
 const n=()=>({textContent:'',setAttribute(){},addEventListener(){}});
 const comp=win.SCMapFeatures.create({L,map:fake,baseButton:n(),compassButton:n(),status:n()});
 await comp.autoStartCompass(true,()=>true);
 listeners.deviceorientation({alpha:50,absolute:false});
 assert.equal(angles.length,0);
 listeners.deviceorientationabsolute({alpha:270,absolute:true});
 assert.equal(angles.at(-1),90,'Only real absolute alpha accepted on non-iOS');
 comp.pause();
 console.log('PASS Beta 0.6.63: iPhone magnetic heading, accuracy guard, screen rotation, alpha fallback, no false active state.');
})().catch(e=>{console.error(e);process.exitCode=1});
