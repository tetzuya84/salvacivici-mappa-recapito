/* Beta 0.6.64 — compass must follow iPhone immediately and without repeated UI DOM churn. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('map-features.js','utf8');
function scenario(animated){
 const events={},angles=[],bearings=[],uiWrites=[];
 function node(label){
  let text='';
  return {disabled:false,attrs:{},
   get textContent(){return text},set textContent(v){text=v;uiWrites.push(label+':'+v)},
   setAttribute(name,v){this.attrs[name]=v;uiWrites.push(label+':attr:'+name+':'+v)},
   addEventListener(k,f){this[k]=f}
  };
 }
 const compass=node('compass'),base=node('base'),status={hidden:true,textContent:''};
 const window={
  screen:{orientation:{angle:0}},
  DeviceOrientationEvent:class DeviceOrientationEvent{},
  addEventListener(k,fn){events[k]=fn},
  removeEventListener(k){delete events[k]}
 };
 const L={Map:function(){},tileLayer:()=>({on(){return this},addTo(){return this}})};
 L.Map.prototype.setBearing=function(){};
 const map={setBearing(a){bearings.push(a)},stopHeadingUp(){},on(){}};
 if(animated)map.setHeading=(a,opts)=>angles.push({a,opts});
 vm.runInNewContext(src,{window,document:{},setTimeout,clearTimeout,Promise});
 const api=window.SCMapFeatures.create({L,map,compassButton:compass,baseButton:base,status});
 return {events,angles,bearings,uiWrites,compass,api,window};
}
(async()=>{
 const p=scenario(true);
 await p.api.autoStartCompass(true,()=>true);
 assert.match(p.compass.textContent,/Attendo/);
 assert.equal(p.bearings.length,0,'No map rotation before valid compass event');
 p.events.deviceorientation({webkitCompassHeading:91,webkitCompassAccuracy:5});
 assert.deepEqual(p.bearings,[-91],'First valid heading applied synchronously');
 assert.equal(p.angles.length,1);
 assert.equal(p.angles[0].a,91);
 assert.equal(p.angles[0].opts.ease,.78);
 assert.equal(p.angles[0].opts.deadzone,.45);
 assert.match(p.compass.textContent,/Bussola attiva/);
 const writes=p.uiWrites.length;
 p.events.deviceorientation({webkitCompassHeading:105,webkitCompassAccuracy:7});
 p.events.deviceorientation({webkitCompassHeading:127,webkitCompassAccuracy:6});
 p.events.deviceorientation({webkitCompassHeading:146,webkitCompassAccuracy:7});
 assert.deepEqual(p.angles.map(x=>x.a),[91,105,127,146],
  'Every valid sensor event updates target immediately, no debounce');
 assert.deepEqual(p.bearings,[-91],
  'No repeated bearing snap when heading is already active');
 assert.equal(p.uiWrites.length,writes,
  'Repeated sensor events must not rewrite button/status DOM');
 p.events.deviceorientation({webkitCompassHeading:160,webkitCompassAccuracy:90});
 p.events.deviceorientationabsolute({alpha:5,absolute:true});
 assert.equal(p.angles.length,4,
  'Unreliable WebKit or iOS relative alpha still rejected');
 p.api.pause();
 assert.equal(p.compass.attrs['aria-pressed'],'false');
 assert.equal(p.events.deviceorientation,undefined);
 const q=scenario(false);
 await q.api.autoStartCompass(true,()=>true);
 q.events.deviceorientation({webkitCompassHeading:355,webkitCompassAccuracy:6});
 q.events.deviceorientation({webkitCompassHeading:2,webkitCompassAccuracy:6});
 assert.deepEqual(q.bearings,[-355,-2],
  'Fallback without plugin setHeading rotates at each event');
 q.api.pause();
 console.log('PASS Beta 0.6.64: first heading snapped, 0.78 follow, no debounce or repeated DOM writes, iOS safety preserved.');
})().catch(e=>{console.error(e);process.exitCode=1});
