/* Beta 0.6.39 — run: node tests/google-login.test.js. No network or credentials. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const script=fs.readFileSync('cloud-google.js','utf8').replace(/^import .*$/mg,'');
async function attempt(mode,existingUid=null,ownerReject=false){
  const elements=new Map(),notices=[],scopes=[];
  const node=id=>{
    if(!elements.has(id))elements.set(id,{
      disabled:true,textContent:'',handlers:{},classList:{toggle(){}},
      addEventListener(type,fn){this.handlers[type]=fn}
    });
    return elements.get(id);
  };
  let signedOut=0,loginCalls=0,authorized=0,forcedPicker=false,accepted=null;
  let acceptedUid=existingUid;
  const auth={currentUser:existingUid?{uid:existingUid,email:'test@invalid.example'}:null};
  class GoogleProvider{
    addScope(scope){scopes.push(scope)}
    setCustomParameters(options){if(options.prompt==='select_account')forcedPicker=true}
  }
  GoogleProvider.credentialFromResult=()=>({accessToken:'test-drive-token'});
  const app={SCCloud:{
    getIdentity:()=>acceptedUid?{uid:acceptedUid,email:'test@invalid.example'}:null,
    notice:(message,warning)=>notices.push({message,warning}),
    acceptGoogleAuth:credentials=>{
      if(ownerReject)throw Error('Account Google diverso dalla sessione dell’archivio.');
      accepted=credentials;acceptedUid=credentials.localId;
    }
  },SCDrive:{authorize:()=>{authorized++;return true}}};
  const ctx={window:app,document:{getElementById:node},initializeApp:()=>({}),
    getAuth:()=>auth,GoogleAuthProvider:GoogleProvider,
    signInWithPopup:async()=>{
      loginCalls++;
      if(mode==='cancel')throw Object.assign(Error('cancelled'),{code:'auth/popup-closed-by-user'});
      if(mode==='blocked')throw Object.assign(Error('blocked'),{code:'auth/popup-blocked'});
      if(mode==='disabled')throw Object.assign(Error('disabled'),{code:'auth/operation-not-allowed'});
      const user={uid:mode==='wrong'?'other-account':existingUid||'own-account',
        email:'test@invalid.example',refreshToken:'mock-refresh',getIdToken:async()=> 'mock-id'};
      auth.currentUser=user;return{user};
    },
    signOut:async()=>{signedOut++;auth.currentUser=null},console
  };
  vm.runInNewContext(script,ctx);
  await node('cloud-google-login').handlers.click();
  return {signedOut,loginCalls,authorized,forcedPicker,accepted,
    currentUid:auth.currentUser?.uid,disabled:node('cloud-google-login').disabled,
    notice:notices.at(-1),scopes};
}
(async()=>{
  const success=await attempt('success');
  assert.equal(success.loginCalls,1);
  assert.equal(success.accepted.localId,'own-account');
  assert.equal(success.accepted.refreshToken,'mock-refresh');
  assert.equal(success.authorized,1);
  assert.equal(success.forcedPicker,false);
  assert.equal(success.signedOut,0);
  assert.equal(success.disabled,false);
  assert.ok(success.scopes.includes('https://www.googleapis.com/auth/drive.file'));
  for(const mode of ['cancel','blocked','disabled']){
    const failed=await attempt(mode,'own-account');
    assert.equal(failed.signedOut,0,mode+' must not log out a previous session');
    assert.equal(failed.currentUid,'own-account',mode+' must keep old UID');
    assert.equal(failed.authorized,0);
  }
  const renewal=await attempt('success','own-account');
  assert.equal(renewal.signedOut,0);
  assert.equal(renewal.authorized,1);
  const wrong=await attempt('wrong','own-account',true);
  assert.equal(wrong.signedOut,1,'unexpected account must be signed out');
  assert.equal(wrong.authorized,0);
  assert.equal(wrong.accepted,null);
  console.log('PASS Beta 0.6.39: 6 Google login/Drive scenarios.');
})().catch(e=>{console.error(e);process.exitCode=1});
