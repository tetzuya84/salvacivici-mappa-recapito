/* Run with node tests/google-login.test.js; no network or Google credentials. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('cloud-google.js','utf8').replace(/^import .*$/mg,'');
async function attempt(behavior='success',ownerReject=false){
 const nodes=new Map(),notices=[];
 const $=id=>{if(!nodes.has(id))nodes.set(id,{id,disabled:true,textContent:'',classList:{toggle(){}},handlers:{},addEventListener(type,fn){this.handlers[type]=fn}});return nodes.get(id);};
 let signedOut=0,called=0,accepted=null;
 const auth={currentUser:null},user={uid:'uid-123',email:'example@test.invalid',refreshToken:'refresh-test',getIdToken:async()=> 'token-test'};
 const provider=class{setCustomParameters(){}};
 const window={SCCloud:{notice:(text,warning)=>notices.push({text,warning}),acceptGoogleAuth:value=>{
   if(ownerReject)throw Error('Account Google diverso da quello dell’archivio già sincronizzato.');
   accepted=value;
 }}};
 const context={window,document:{getElementById:$},initializeApp:()=>({}),getAuth:()=>auth,GoogleAuthProvider:provider,
  signInWithPopup:async()=>{
    called++;
    if(behavior==='blocked')throw Object.assign(new Error('blocked'),{code:'auth/popup-blocked'});
    if(behavior==='cancelled')throw Object.assign(new Error('cancel'),{code:'auth/popup-closed-by-user'});
    if(behavior==='disabled')throw Object.assign(new Error('disabled'),{code:'auth/operation-not-allowed'});
    auth.currentUser=user;return{user};
  },
  signOut:async()=>{signedOut++;auth.currentUser=null},
  console};
 vm.runInNewContext(code,context);
 assert.equal($('cloud-google-login').disabled,false);
 await $('cloud-google-login').handlers.click();
 await Promise.resolve();await Promise.resolve();
 return{called,accepted,signedOut,notices,last:notices.at(-1),buttonDisabled:$('cloud-google-login').disabled};
}
(async()=>{
 const a=await attempt();
 assert.equal(a.called,1);assert.equal(a.accepted.localId,'uid-123');
 assert.equal(a.accepted.refreshToken,'refresh-test');assert.equal(a.buttonDisabled,false);
 const b=await attempt('blocked');assert.equal(b.accepted,null);
 assert.match(b.last.text,/popup Google/);
 const c=await attempt('disabled');assert.match(c.last.text,/Attiva il provider Google/);
 const d=await attempt('cancelled');assert.match(d.last.text,/annullato/);
 const e=await attempt('success',true);assert.equal(e.accepted,null);
 assert.equal(e.signedOut,1);assert.match(e.last.text,/Account Google diverso/);
 console.log('Google OAuth UI: 5 scenari verificati (mock)');
})().catch(e=>{console.error(e);process.exitCode=1});
