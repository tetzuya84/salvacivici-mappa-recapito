/* Beta 0.6.20: test della cartografia Satellite, rotazione e bussola. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('map-features.js','utf8');
function node(){return{hidden:true,textContent:'',disabled:false,events:{},attrs:{},addEventListener(k,fn){this.events[k]=fn;},setAttribute(k,v){this.attrs[k]=v;}};}
async function run(){
 const scripts=[],listeners={},mapEvents={};
 const layers=[],added=[],removed=[],status=node(),baseButton=node(),compassButton=node();
 const L={Map:function(){},tileLayer(url,opts){const layer={url,opts,events:{},
  on(k,fn){this.events[k]=fn;return this;},addTo(m){added.push(this);return this;},
  remove(){removed.push(this);return this;}};layers.push(layer);return layer;}};
 L.Map.prototype.setBearing=function(){};
 const bearing=[],headings=[],stopCalls=[];
 const map={setBearing(n){bearing.push(n);},setHeading(n){headings.push(n);},stopHeadingUp(){stopCalls.push(1);},
   removeLayer(layer){removed.push(layer);},on(k,fn){mapEvents[k]=fn;}};
 const DeviceOrientationEvent=function(){};
 let requestInvoked=0,permission='granted';
 DeviceOrientationEvent.requestPermission=()=>{requestInvoked++;return Promise.resolve(permission);};
 const root={L,SCMapReview:{loadLeaflet:async()=>L},DeviceOrientationEvent,
  addEventListener(k,fn){listeners[k]=fn;},removeEventListener(k){delete listeners[k];}};
 const doc={createElement:()=>({}),head:{appendChild(){}}};
 vm.runInNewContext(source,{window:root,document:doc,setTimeout,clearTimeout,Promise});
 const library=await root.SCMapFeatures.load();
 assert.equal(library,L,'Should reuse Leaflet and rotate plugin');
 const shared=root.SCMapFeatures.create({L,map,baseButton,compassButton,status});
 assert.equal(layers.length,1,'Satellite must be lazy');
 assert.match(layers[0].url,/openstreetmap/);
 assert.equal(added.length,1);
 assert.equal(compassButton.disabled,false);
 baseButton.events.click();
 assert.equal(layers.length,2);
 assert.match(layers[1].url,/World_Imagery/);
 assert.match(layers[1].opts.attribution,/Esri/);
 assert.equal(baseButton.attrs['aria-pressed'],'true');
 baseButton.events.click();
 assert.equal(layers.length,2,'Layers must be reused');
 assert.equal(baseButton.attrs['aria-pressed'],'false');
 compassButton.events.click();
 assert.equal(requestInvoked,1,'Permission request must begin on user gesture');
 await Promise.resolve();await Promise.resolve();
 assert.equal(compassButton.attrs['aria-pressed'],'true');
 assert.equal(typeof listeners.deviceorientation,'function');
 listeners.deviceorientation({webkitCompassHeading:83,webkitCompassAccuracy:12});
 assert.equal(headings.at(-1),83,'The heading from iPhone compass must align the map');
 shared.pause();
 assert.equal(compassButton.attrs['aria-pressed'],'false');
 assert.equal(listeners.deviceorientation,undefined,'Stop all device sensor listeners');
 assert.equal(stopCalls.length,1);
 permission='denied';compassButton.events.click();
 await Promise.resolve();await Promise.resolve();
 assert.match(status.textContent,/non autorizzata/i);
 assert.equal(listeners.deviceorientation,undefined);
 permission='granted';compassButton.events.click();
 await Promise.resolve();await Promise.resolve();
 mapEvents.rotatestart();
 assert.equal(listeners.deviceorientation,undefined,'Finger rotation ends automatic tracking');
 assert.equal(shared.isSatellite(),false);
 console.log('Beta 0.6.20: satellite/stradale, bussola, gesti e privacy PASS.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
