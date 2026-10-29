/* Beta 0.6.10 — test logici GPS senza rete né posizione reale.
   Esegui: node tests/gps-three-readings.test.js */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const SC=require('../core.js');
const app=fs.readFileSync('app.js','utf8');
const beginning=app.indexOf('  function stopGpsWatch(){');
const ending=app.indexOf("  document.addEventListener('visibilitychange',()=>{",beginning);
assert.ok(beginning>0&&ending>beginning,'funzioni GPS presenti');
const gpsCode=app.slice(beginning,ending);
function setup(){
  const els=new Map(),timers=new Map(),events={};
  let nextTimer=0;
  const $=id=>{
    if(!els.has(id))els.set(id,{
      disabled:false,hidden:false,style:{},dataset:{},
      classList:{toggle(){},add(){},remove(){}},
      setAttribute(key,value){this[key]=value;},
      addEventListener(type,callback){this[type]=callback;},
      textContent:''
    });
    return els.get(id);
  };
  const state={gps:null,db:{},records:[]};
  const navigator={geolocation:{
    watchPosition(success,error){events.watch={success,error};return 1;},
    clearWatch(){},
    getCurrentPosition(success,error){events.poll={success,error};}
  }};
  const fakeSetTimeout=(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;};
  const fakeClearTimeout=id=>timers.delete(id);
  const load=new Function('SC','$','state','navigator','document','toast','autoComune',
    'geolocationError','showComune','setTimeout','clearTimeout',`
    const GPS_TARGET_SAMPLES=3,GPS_MAX_SAVE_AGE_MS=30000;
    const GPS_FIRST_FIX_TIMEOUT_MS=16000,GPS_REFINEMENT_MS=14500;
    let comuneManual=false,gpsWatch=null,gpsFirstTimer=null,gpsRefineTimer=null,gpsPollTimers=[],gpsRequestId=0;
    let gpsBusy=false,gpsValidated=false,gpsSamples=[],gpsStartedAt=0,gpsResolve=null,gpsPromise=null,gpsError=null;
    ${gpsCode}
    return {startGpsAcquisition,get:()=>({gpsBusy,gpsValidated,gpsSamples:[...gpsSamples],gpsError,gps:state.gps})};
  `);
  const api=load(SC,$,state,navigator,{visibilityState:'visible'},()=>{},()=>{},()=> 'GPS non disponibile',()=>{},fakeSetTimeout,fakeClearTimeout);
  return{api,$,state,timers,events};
}
const pos=(lat,lon,accuracy,timestamp)=>({coords:{latitude:lat,longitude:lon,accuracy},timestamp});
async function test(){
  assert.equal(SC.hasRequiredGpsReadings([],3),false);
  assert.equal(SC.hasRequiredGpsReadings([
    {lat:45,lon:10,accuracy:1,timestamp:1},
    {lat:45,lon:10,accuracy:1,timestamp:1},
    {lat:45,lon:10,accuracy:1,timestamp:2}
  ],3),false);
  assert.equal(SC.gpsQuality(NaN).score,0);
  assert.ok(SC.gpsQuality(4).score>SC.gpsQuality(50).score);
  const x=setup(),work=x.api.startGpsAcquisition(),now=Date.now();
  x.events.watch.success(pos(45,10,2,now-100));
  assert.equal(x.$('save-button').disabled,true,'un fix eccellente non basta');
  x.events.watch.success(pos(45,10,1,now-100));
  assert.equal(x.api.get().gpsSamples.length,1,'no doppio timestamp');
  x.events.watch.success(pos(45.00001,10,7,now-50));
  assert.equal(x.$('save-button').disabled,true,'due fix non bastano');
  x.events.watch.success(pos(45.00002,10,9,now));
  assert.equal(await work,true);
  assert.equal(x.$('save-button').disabled,false,'terzo fix sblocca');
  assert.equal(x.api.get().gps.sampleCount,3);
  assert.equal(x.api.get().gps.accuracy,2,'sceglie la precisione migliore');
  assert.equal(x.$('gps-samples').textContent,'3/3 letture');
  const y=setup(),failed=y.api.startGpsAcquisition();
  y.events.watch.success(pos(45,10,2,Date.now()-100));
  y.events.watch.success(pos(45,10,7,Date.now()-50));
  const timeout=[...y.timers.values()].find(timer=>timer.delay===14500);
  assert.ok(timeout,'timeout dopo primo fix');
  timeout.fn();
  assert.equal(await failed,false);
  assert.equal(y.$('save-button').disabled,true);
  assert.equal(y.$('gps-retry').hidden,false,'retry visibile');
  assert.equal(y.api.get().gpsValidated,false);
  assert.match(y.api.get().gpsError,/solo 2 letture/);
  console.log('Beta 0.6.10: 12 verifiche GPS superate.');
}
test().catch(error=>{console.error(error);process.exitCode=1;});
