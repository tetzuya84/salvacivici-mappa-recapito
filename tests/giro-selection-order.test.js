/* Beta 0.6.61 — i tap determinano l'ordine iniziale; nessuna ottimizzazione
   prima del pulsante; selezione massiva segue le righe visibili. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('giro.js','utf8');
const records=[
 {id:'C',via:'Via C',civico:'3',comune:'Redondesco',lat:45.153,lon:10.53},
 {id:'A',via:'Via A',civico:'1',comune:'Redondesco',lat:45.151,lon:10.51},
 {id:'D',via:'Via D',civico:'4',comune:'Redondesco',lat:45.154,lon:10.54},
 {id:'B',via:'Via B',civico:'2',comune:'Redondesco',lat:45.152,lon:10.52}
];
const saved={},nodes=new Map(),drawn=[];
let pendingGps=null,gpsCalls=0,networkCalls=0;
function node(id){
 if(!nodes.has(id))nodes.set(id,{
  id,value:'',hidden:false,disabled:false,checked:false,textContent:'',
  children:[],events:{},classList:{add(){},remove(){},toggle(){}},style:{},
  addEventListener(k,f){this.events[k]=f},
  append(...xs){this.children.push(...xs)},
  replaceChildren(){this.children=[]},
  setAttribute(){}
 });
 return nodes.get(id);
}
function element(type){
 return{type,children:[],events:{},style:{},classList:{add(){},remove(){},toggle(){}},
  className:'',textContent:'',checked:false,disabled:false,
  addEventListener(k,f){this.events[k]=f},
  append(...xs){this.children.push(...xs)},
  setAttribute(){},
  getBoundingClientRect(){return{top:100,height:55,bottom:155}}
 };
}
const document={getElementById:node,querySelector(){return null},createElement:element};
const window={addEventListener(){},fetch(){networkCalls++;throw Error('No network expected')}};
const navigator={geolocation:{getCurrentPosition(success){
 gpsCalls++;pendingGps=success;
}}};
vm.runInNewContext(source,{
 document,window,navigator,Number,Math,String,JSON,Set,Map,Promise,Date,
 localStorage:{getItem:k=>saved[k]||null,setItem(k,v){saved[k]=v}}
});
window.SCGiro.create({getRecords:()=>records,drawRoute:p=>drawn.push(p)});
function lines(){return node('giro-itinerary').children.map(li=>li.children[0].textContent)}
function labels(){return node('giro-stops').children.map(row=>row.children[1].textContent)}
function seq(){return Array.from(drawn.at(-1)?.stops||[],r=>r.id)}
function tap(letter,checked){
 const row=node('giro-stops').children.find(r=>r.children[1].textContent==='Via '+letter+', '+({A:'1',B:'2',C:'3',D:'4'}[letter])+' · Redondesco');
 assert.ok(row,'Checkbox '+letter+' visibile');
 const input=row.children[0];input.checked=checked;input.events.change();
}
function ids(){return lines().map(label=>label.match(/Via ([ABCD]),/)[1])}
(async()=>{
 // Il catalogo ricevuto è C,A,D,B, ma l'elenco visibile A,B,C,D.
 assert.deepEqual(labels().map(x=>x.match(/Via ([ABCD]),/)[1]),['A','B','C','D']);
 tap('C',true);tap('A',true);tap('B',true);
 assert.deepEqual(ids(),['C','A','B'],'Ordine di tap, non di catalogo/latitudine');
 assert.deepEqual(JSON.parse(saved['salvacivici-giro-v1']).selected,['C','A','B']);
 assert.match(node('giro-status').textContent,/Ordine di selezione/);
 assert.equal(networkCalls,0,'Nessuna ottimizzazione stradale automatica');
 assert.equal(gpsCalls,1,'Un solo GPS simultaneo');
 assert.equal(drawn.at(-1),null,'La preview attende il GPS, senza perdere le fermate');
 pendingGps({coords:{latitude:45.15,longitude:10.5,accuracy:5}});
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.deepEqual(seq(),['C','A','B'],'Anteprima stradale nell\'ordine scelto');
 assert.equal(drawn.at(-1).road,false,'La preview mantiene la richiesta stradale');
 assert.equal(new URL(node('giro-google').href).searchParams.get('destination'),records[3].lat+','+records[3].lon);
 // Deselezionare e poi ritoccare aggiunge il civico in fondo.
 tap('A',false);tap('A',true);
 assert.deepEqual(seq(),['C','B','A']);
 assert.deepEqual(JSON.parse(saved['salvacivici-giro-v1']).selected,['C','B','A']);
 // Seleziona trovati: rispetta l'ordinamento delle righe VISIBILI.
 node('giro-clear').events.click();
 node('giro-select-all').events.click();
 assert.deepEqual(seq(),['A','B','C','D']);
 assert.deepEqual(JSON.parse(saved['salvacivici-giro-v1']).selected,['A','B','C','D']);
 // Riordino manuale è rispettato quando viene aggiunta un'altra fermata.
 const grip=node('giro-itinerary').children[0].children[1];
 grip.events.keydown({key:'ArrowDown',preventDefault(){}});
 assert.deepEqual(seq(),['B','A','C','D']);
 tap('C',false);tap('C',true);
 assert.deepEqual(seq(),['B','A','D','C'],'Nuova selezione accodata dopo ordine manuale');
 assert.equal(networkCalls,0,'Solo il pulsante Ottimizza può usare il calcolo matrice');
 assert.equal(new Set(seq()).size,4);
 console.log('PASS Beta 0.6.61: ordine di tap, preview GPS, selezione massiva, drag e zero auto-optimizer.');
})().catch(e=>{console.error(e);process.exitCode=1});
