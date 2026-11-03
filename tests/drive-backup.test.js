/* Beta 0.6.41 — test senza rete: copie tecniche append-only, Mappa + Archivio, nessun Foglio Google. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('drive-backup.js','utf8');
const nodes=new Map(),backups=[],content=new Map(),requests=[];
let online=false,serial=0,published=[];
function element(id){
 if(!nodes.has(id))nodes.set(id,{id,hidden:false,textContent:'',handlers:{},classList:{toggle(){}},
   addEventListener(type,fn){this.handlers[type]=fn}});
 return nodes.get(id);
}
function response(body,status=200){return{ok:status>=200&&status<300,status,json:async()=>body};}
async function fakeFetch(input,options={}){
 const address=String(input),u=new URL(address),verb=options.method||'GET';
 requests.push({url:address,method:verb});
 if(address.includes('/upload/drive/v3/files')){
   assert.equal(verb,'POST');
   assert.ok(!options.body.includes('application/vnd.google-apps.spreadsheet'));
   const meta=JSON.parse(options.body.split('Content-Type: application/json; charset=UTF-8\r\n\r\n')[1].split('\r\n--')[0]);
   const snapshot=JSON.parse(options.body.split('Content-Type: application/json\r\n\r\n')[1].split('\r\n--')[0]);
   assert.equal(meta.mimeType,'application/json');
   const id='file-'+(backups.length+1);
   content.set(id,snapshot);
   backups.push({id,name:meta.name,mimeType:meta.mimeType,createdTime:new Date(2026,10,3,20,20,backups.length).toISOString()});
   return response({id,name:meta.name});
 }
 if(u.pathname.endsWith('/files')&&verb==='GET'){
   const q=u.searchParams.get('q')||'';
   if(q.includes("mimeType = 'application/vnd.google-apps.folder'"))
     return response({files:[{id:'folder-1',name:'SalvaCivici - Backup app'}]});
   if(q.includes("name contains 'SalvaCivici_auto_'"))
     return response({files:backups});
 }
 if(u.searchParams.get('alt')==='media'){
   const id=u.pathname.split('/').at(-1);
   assert.ok(content.has(id),'only a known backup can be read');
   return response(content.get(id));
 }
 throw Error('Unexpected Drive request: '+address);
}
const uid='test-owner',email='example@invalid.test';
const root={SC:{isRecord:r=>r&&typeof r.id==='string'&&typeof r.civico==='string'&&Number.isFinite(r.lat)},
 SCCloudMerge:{same:(a,b)=>JSON.stringify(a)===JSON.stringify(b)},
 SCCloud:{getIdentity:()=>({uid,email}),refreshAuthUi(){}}};
const navigator={get onLine(){return online}};
vm.runInNewContext(source,{window:root,document:{getElementById:element},navigator,fetch:fakeFetch,
 URL,URLSearchParams,TextEncoder,crypto:{randomUUID:()=>String(++serial)+'-12345678-1234-1234-123456789abc'},
 console,setTimeout,Date});
(async()=>{
 root.SCDrive.init({getRecords:async()=>[],getMapRecords:async()=>published,
   addRecoveredRecords:async()=>{},confirmAction:async()=>true});
 assert.equal(root.SCDrive.authorize({uid,email,accessToken:'test-token'}),true);
 online=true;
 const one={id:'a',via:'Gerole',civico:'22',comune:'Redondesco',lat:45.16,lon:10.49};
 const two={id:'b',via:'Kennedy',civico:'51',comune:'Acquanegra sul Chiese',lat:45.17,lon:10.43};
 published=[one,two];
 const first=await root.SCDrive.backupAfterSync([]);
 assert.equal(first.ok,true,'Mappa non vuota deve consentire backup anche se Archivio è vuoto');
 assert.equal(first.count,2);
 assert.equal(backups.length,1);
 const old=JSON.stringify(content.get('file-1'));
 const newer={...two,lat:45.18};
 const second=await root.SCDrive.backupAfterSync([newer]);
 assert.equal(second.ok,true);
 assert.equal(second.count,2);
 assert.equal(backups.length,2,'backup append-only');
 assert.equal(content.get('file-2').records.find(r=>r.id==='b').lat,45.18,'modifica Archivio prevale');
 assert.equal(JSON.stringify(content.get('file-1')),old,'backup precedente non sovrascritto');
 const third=await root.SCDrive.backupAfterSync([newer]);
 assert.equal(third.unchanged,true,'snapshot invariato non genera duplicati');
 assert.equal(backups.length,2);
 published=[one];
 const unsafe=await root.SCDrive.backupAfterSync([]);
 assert.equal(unsafe.reason,'remote-only','niente backup che omette civici della copia precedente');
 assert.equal(backups.length,2);
 assert.equal(requests.filter(r=>r.method==='POST').length,2,'solo due backup tecnici');
 assert.ok(!requests.some(r=>/sheets.googleapis|spreadsheet/i.test(r.url)),'mai generare Fogli modificabili');
 console.log('PASS Beta 0.6.41: Mappa+Archivio, backup append-only, no Sheets, guardia anti-perdita.');
})().catch(e=>{console.error(e);process.exitCode=1});
