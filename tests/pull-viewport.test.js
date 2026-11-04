/* Beta 0.6.48 — iOS: viewport fisso e pull GPS/sync controllato senza bounce. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8'),css=fs.readFileSync('styles.css','utf8');
const block=css.split('/* Beta 0.6.48 — blocco scorrimento iOS/PWA')[1]||'';
for(const fragment of ['body:has(#page-capture:not([hidden]))','body:has(#page-records:not([hidden]))',
 'height:100dvh','position:fixed','overflow:hidden','overflow-y:auto','overscroll-behavior-y:none',
 'touch-action:none','#page-capture .intro','#page-records .intro',
 'margin:0 0 calc(82px + env(safe-area-inset-bottom))'])
 assert.ok(block.includes(fragment),'missing responsive rule: '+fragment);
assert.match(app,/scroller\.scrollTop=0/);
assert.equal((app.match(/const atTop=\(\)=>scroller\.scrollTop<=5;/g)||[]).length,2);
function slice(name){
 const begin=app.indexOf('function '+name+'(){');
 const marker='  '+name+'();',end=app.indexOf(marker,begin);
 assert.ok(begin>0&&end>begin,'gesture function: '+name);
 return app.slice(begin,end+marker.length);
}
async function check(which){
 const archive=which==='archive',code=slice(archive?'setupArchivePullToSync':'setupCapturePullToRefresh');
 const scroll={scrollTop:0};
 const events={},timers=[],label={textContent:''},indicator={style:{},dataset:{}},
 status={hidden:true,dataset:{},textContent:''};
 const page={hidden:false,events,addEventListener(k,fn){events[k]=fn}};
 const keyboard={addEventListener(){}};
 const dom={'archive-sync-keyboard':keyboard};
 dom['page-'+(archive?'records':'capture')]=page;
 dom[archive?'archive-pull':'capture-pull']=indicator;
 dom[archive?'archive-pull-label':'capture-pull-label']=label;
 dom[archive?'archive-pull-status':'capture-pull-status']=status;
 const $=id=>dom[id]||null;
 let runs=0;
 const win={SCCloud:{syncFromArchive:async()=>{runs++;return {ok:true,count:0,mapCount:15}}}};
 const doc={querySelector:s=>s==='.app-shell > main'?scroll:null};
 const state={gps:{sampleCount:3}};
 vm.runInNewContext(code,{
  $,document:doc,navigator:{},window:win,
  resetCaptureForFreshGps:async()=>{runs++;return true},
  state,gpsValidated:true,
  setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout:()=>{}
 });
 const target={closest:()=>null};
 const start=(x=120,y=130)=>events.touchstart({touches:[{clientX:x,clientY:y}],target});
 const move=(x,y)=>{
  let prevented=false;
  events.touchmove({touches:[{clientX:x,clientY:y}],cancelable:true,
   preventDefault(){prevented=true}});
  return prevented;
 };
 const end=()=>events.touchend({});
 start();assert.equal(move(120,133),true,'pull blocks native scroll from 3px');
 assert.equal(move(120,220),true);
 assert.match(label.textContent,/Rilascia/);
 end();for(let i=0;i<25;i++)await Promise.resolve();
 assert.equal(runs,1,'exactly one refresh/sync at 90px');
 timers.forEach(fn=>fn());
 scroll.scrollTop=120;start();assert.equal(move(120,230),false);end();
 for(let i=0;i<5;i++)await Promise.resolve();
 assert.equal(runs,1,'no pull when internal scroller is away from top');
 scroll.scrollTop=0;start();assert.equal(move(120,75),false);end();
 assert.equal(runs,1,'upward scroll is native');
 start();assert.equal(move(220,140),false);end();
 assert.equal(runs,1,'horizontal swipe is native');
 start();assert.equal(move(120,189),true);end();
 assert.equal(runs,1,'short pull should not trigger action');
 return archive?'Archivio: sync protetta':'Salva: GPS protetto';
}
(async()=>{
 const checked=[await check('capture'),await check('archive')];
 console.log('PASS Beta 0.6.48: '+checked.join(' · ')+', viewport fermo e contenuto scrollabile.');
})().catch(e=>{console.error(e);process.exitCode=1});
