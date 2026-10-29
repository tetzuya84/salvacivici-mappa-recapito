// Eseguire: node tests/cloud-merge.test.js (nessuna dipendenza esterna).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const sandbox={};sandbox.window=sandbox;
vm.runInNewContext(fs.readFileSync('cloud-merge.js','utf8'),sandbox);
const M=sandbox.SCCloudMerge;
const r=(id,civico)=>({id,comune:'Comune prova',via:'Via Fittizia',civico,lat:45,lon:10,accuracy:6,createdAt:'2026-10-29T08:00:00Z'});
const base=[r('a','1'),r('b','2')];
const cases=[
  ['prima scrittura',[],[r('a','1')],[],1,0],
  ['ricezione su altro dispositivo',[],[],[r('a','1')],1,0],
  ['modifiche indipendenti',base,[r('a','1A'),r('b','2')],[r('a','1'),r('b','2B')],2,0],
  ['eliminazione remota',base,base,[r('a','1')],1,0],
  ['eliminazione locale',base,[r('a','1')],base,1,0],
  ['stesso civico modificato diversamente',base,[r('a','1A'),r('b','2')],[r('a','1B'),r('b','2')],1,1],
  ['modifiche uguali',base,[r('a','1A'),r('b','2')],[r('a','1A'),r('b','2')],2,0],
  ['eliminazione uguale',base,[],[],0,0],
  ['eliminazione già confermata',base,[r('a','1')],[r('a','1')],1,0],
  ['due aggiunte',[],[r('a','1')],[r('b','2')],2,0]
];
for(const [name,baseline,local,cloud,count,conflicts]of cases){
 const outcome=M.merge(baseline,local,cloud);
 assert.equal(outcome.records.length,count,name+' count');
 assert.equal(outcome.conflicts.length,conflicts,name+' conflict count');
}
assert.throws(()=>M.merge([],[r('x','1'),r('x','2')],[]),/duplicati/);
console.log('11 controlli cloud-merge superati');
