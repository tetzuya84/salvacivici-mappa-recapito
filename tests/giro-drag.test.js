/* Beta 0.6.57 — trascinamento verticale Giro: mobile, annullamento,
   completate bloccate, ordine persistente, link ricalcolati e tastiera. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('giro.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const store={},nodes=new Map(),drawn=[],listeners={};
const cl=()=>{const set=new Set();return{
 add(x){set.add(x)},remove(x){set.delete(x)},toggle(x,on){if(on)set.add(x);else set.delete(x)},
 contains(x){return set.has(x)}
}};
function node(id){
 if(!nodes.has(id))nodes.set(id,{
  id,value:'',disabled:false,hidden:false,textContent:'',checked:false,
  children:[],events:{},attrs:{},style:{},classList:cl(),
  addEventListener(k,f){this.events[k]=f},
  replaceChildren(){this.children=[]},
  append(...a){this.children.push(...a)},
  setAttribute(k,v){this.attrs[k]=v}
 });
 return nodes.get(id);
}
function createElement(type){return{
 type,children:[],events:{},attrs:{},classList:cl(),style:{},
 className:'',textContent:'',checked:false,disabled:false,
 setAttribute(k,v){this.attrs[k]=v},
 addEventListener(k,f){this.events[k]=f},
 append(...a){this.children.push(...a)},
 getBoundingClientRect(){
  const i=node('giro-itinerary').children.indexOf(this);
  return {top:100+i*60,height:60,bottom:160+i*60};
 }
};}
const document={getElementById:node,querySelector(){return null},createElement};
const samples=Array.from({length:4},(_,i)=>({
 id:'stop-'+i,via:'Via Civico',civico:String(i+1),comune:'Redondesco',
 lat:45.16+i*.001,lon:10.51+i*.001
}));
const window={addEventListener(k,f){listeners[k]=f}};
const navigator={geolocation:{getCurrentPosition(resolve){
 resolve({coords:{latitude:45.1603,longitude:10.51,accuracy:5}});
}}};
vm.runInNewContext(source,{
 document,window,navigator,
 localStorage:{setItem(k,v){store[k]=v},getItem(k){return store[k]||null}},
 Number,Math,String,JSON,Set,Map,Promise,Date
});
const g=window.SCGiro.create({getRecords:()=>samples,drawRoute(p){drawn.push(p)}});
function sequence(){return Array.from(drawn.at(-1)?.stops||[],x=>x.id)}
function item(i){return node('giro-itinerary').children[i]}
function handle(i){return item(i).children[1]}
function point(h,type,y,pointerId){
 h.events[type]({pointerId,pointerType:'touch',isPrimary:true,clientY:y,button:0,preventDefault(){}});
}
function expectedLink(){
 const stops=drawn.at(-1).stops;
 const dest=stops.at(-1);
 assert.equal(new URL(node('giro-apple').href).searchParams.get('destination'),dest.lat+','+dest.lon);
 assert.equal(new URL(node('giro-google').href).searchParams.get('destination'),dest.lat+','+dest.lon);
}
(async()=>{
 node('giro-select-all').events.click();
 await new Promise(r=>setTimeout(r,20));
 assert.equal(sequence().length,4);
 assert.equal(node('giro-itinerary').children.length,4);
 const first=sequence(),start=handle(0);
 assert.equal(start.className,'giro-drag-handle');
 assert.equal(start.children[0].children.length,3,'Tre barrette visibili');
 assert.ok(start.attrs['data-no-swipe']!==undefined,'Gesto non cambia scheda');
 assert.ok(start.attrs['aria-label'].includes('Riordina'));
 // Tocco breve: non sposta nulla.
 point(start,'pointerdown',125,10);point(start,'pointermove',130,10);point(start,'pointerup',130,10);
 assert.deepEqual(sequence(),first,'Tocco breve non riordina');
 // Trascina la prima fermata fino all'ultima.
 point(handle(0),'pointerdown',125,11);
 point(handle(0),'pointermove',345,11);
 assert.equal(item(0).classList.contains('giro-dragging'),true,'Feedback visivo durante il gesto');
 point(handle(0),'pointerup',345,11);
 assert.deepEqual(sequence(),[...first.slice(1),first[0]]);
 assert.deepEqual(JSON.parse(store['salvacivici-giro-v1']).manualOrder,sequence());
 expectedLink();
 // Se annulli il gesto, conserva percorso e ordine persistito.
 const after=sequence(),second=handle(1);
 point(second,'pointerdown',190,12);point(second,'pointermove',320,12);
 second.events.pointercancel({pointerId:12});
 assert.deepEqual(sequence(),after,'Annullamento non modifica il giro');
 // Tastiera: ArrowDown riordina la fermata evidenziata.
 const current=sequence(),keyboard=handle(0);
 let prevented=false;
 keyboard.events.keydown({key:'ArrowDown',preventDefault(){prevented=true}});
 assert.equal(prevented,true);
 assert.deepEqual(sequence(),[current[1],current[0],current[2],current[3]]);
 expectedLink();
 // La fermata completata rimane fissa; non e' trascinabile.
 node('giro-complete').events.click();
 const finish=sequence(),doneHandle=handle(0);
 assert.equal(doneHandle.disabled,true);
 point(doneHandle,'pointerdown',125,14);
 if(doneHandle.events.pointermove)point(doneHandle,'pointermove',400,14);
 if(doneHandle.events.pointerup)point(doneHandle,'pointerup',400,14);
 assert.deepEqual(sequence(),finish,'Fermata completata non spostata');
 const secondGrip=handle(1);
 point(secondGrip,'pointerdown',190,15);
 point(secondGrip,'pointermove',70,15);
 point(secondGrip,'pointerup',70,15);
 assert.deepEqual(sequence(),finish,'Non oltrepassare la fermata completata');
 assert.equal(JSON.parse(store['salvacivici-giro-v1']).done.length,1);
 assert.match(css,/#page-giro \.giro-drag-handle\{[\s\S]*?touch-action:none/);
 assert.ok(css.includes('#page-giro .giro-grip-bars'));
 assert.ok(!css.includes('#page-giro .giro-order-move'));
 console.log('PASS Beta 0.6.57: drag iPhone, click, cancel, keyboard, completed, links, persistence.');
})().catch(e=>{console.error(e);process.exitCode=1});
