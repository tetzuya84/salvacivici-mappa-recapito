/* Beta 0.6.27: update indipendente dal GPS, aiuto corto, nessun dato perso. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8'),
      html=fs.readFileSync('index.html','utf8'),
      sw=fs.readFileSync('sw.js','utf8'),
      updates=fs.readFileSync('updates.js','utf8');
const begin=app.indexOf('beforeUpdate:async()=>{'),
      end=app.indexOf('\n      }\n    });',begin);
assert.ok(begin>=0&&end>begin,'Callback aggiornamento trovato');
const body=app.slice(begin+'beforeUpdate:async()=>{'.length,end);
assert.doesNotMatch(body,/gpsBusy|gpsValidated|GPS_TARGET_SAMPLES/,'Aggiorna indipendente dalle letture GPS');
assert.doesNotMatch(app,/Termina prima il rilevamento GPS/);
assert.match(app,/const gps=state\.gps/,'La gestione GPS non deve essere eliminata');
assert.match(app,/gpsBusy\|\|!complete\|\|!state\.db/,'Salva civico mantiene le proprie protezioni');
assert.match(app,/GPS_TARGET_SAMPLES=3/);
assert.match(html,/Verifica i pin sulla mappa prima di esportare i civici/);
assert.doesNotMatch(html,/Apri <strong>Trova pin sulla mappa<\/strong> per controllare ogni ingresso/);
assert.doesNotMatch(html,/<meta name="apple-mobile-web-app-status-bar-style"/);
assert.match(html,/name="theme-color" content="#0c1b29"/);
assert.match(html,/BETA 0\.6\.27/);
assert.match(sw,/salvacivici-v0\.6\.27/);
assert.match(updates,/beforeUpdate\(\)/);
assert.match(updates,/SKIP_WAITING/);
async function simulate(draft,editOpen,mapOpen,confirmation){
 const notes=[];
 const $=id=>({ 'edit-dialog':{open:editOpen},
                   'indirizzo':{value:draft} })[id];
 const toast=t=>notes.push(t);
 const mapReview={isOpen:()=>mapOpen};
 let confirmations=0;
 const confirmAction=async()=>{confirmations++;return confirmation;};
 const f=new Function('$','toast','mapReview','confirmAction',
  'return (async function(){'+body+'})();');
 const allowed=await f($,toast,mapReview,confirmAction);
 return {allowed,notes,confirmations};
}
async function run(){
 const gpsRunning=true;
 assert.equal(gpsRunning,true); // simula app appena avviata, GPS ancora attivo
 const none=await simulate('',false,false,true);
 assert.equal(none.allowed,true,'Aggiorna deve funzionare con il GPS non ancora pronto');
 assert.equal(none.notes.length,0);
 const unsaved=await simulate('Vittoria 13',false,false,false);
 assert.equal(unsaved.allowed,false,'Non perdere indirizzo incompleto');
 assert.equal(unsaved.confirmations,1);
 const confirmed=await simulate('Vittoria 13',false,false,true);
 assert.equal(confirmed.allowed,true);
 const editing=await simulate('',true,false,true);
 assert.equal(editing.allowed,false,'Dialog modifica civico resta protetto');
 const map=await simulate('',false,true,true);
 assert.equal(map.allowed,false,'Dialog pin resta protetto');
 console.log('PASS Beta 0.6.27: aggiornamento libero dal GPS, bozza e editor protetti');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
