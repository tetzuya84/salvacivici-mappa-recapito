/* node tests/update-flow.test.js — regressione update un tocco. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('updates.js','utf8');
async function simulate(waiting,allowed){
  const handlers={},button={disabled:false,textContent:'Aggiorna',addEventListener(k,fn){handlers['button:'+k]=fn}},
    banner={hidden:true};
  let redirects=0,posts=0,checks=0,notify='';
  const reg={waiting:null,installing:null,addEventListener(k,fn){handlers['reg:'+k]=fn},update(){checks++;return Promise.resolve()}};
  const nav={onLine:true,serviceWorker:{controller:{id:1},addEventListener(k,fn){handlers['sw:'+k]=fn},
    register(){return Promise.resolve(reg)},getRegistration(){return Promise.resolve(reg)}}};
  if(waiting)reg.waiting={postMessage(){posts++;nav.serviceWorker.controller={id:2};handlers['sw:controllerchange']()}};
  const win={navigator:nav,document:{visibilityState:'visible',getElementById:id=>id==='apply-update'?button:banner,addEventListener(){}},
    location:{href:'https://example.com/app/',protocol:'https:',replace(u){redirects++;this.last=u}},
    addEventListener(){},setTimeout(){}};
  vm.runInNewContext(src,{window:win,URL,Date,Promise});
  win.SCUpdates.setup({beforeUpdate:async()=>allowed,notify:v=>notify=v});
  await Promise.resolve();await Promise.resolve();
  await handlers['button:click']();
  await handlers['button:click']();
  return {redirects,posts,checks,button,banner,notify,win};
}
(async()=>{
 const waiting=await simulate(true,true);
 assert.equal(waiting.redirects,1);assert.equal(waiting.posts,1);
 assert.match(waiting.win.location.last,/_sc_reload=/);
 const activated=await simulate(false,true);
 assert.equal(activated.redirects,1);assert.equal(activated.posts,0);
 const cancelled=await simulate(true,false);
 assert.equal(cancelled.redirects,0);assert.equal(cancelled.posts,0);
 console.log('Aggiornamento con un tocco: tutti i test superati.');
})().catch(e=>{console.error(e);process.exitCode=1;});
