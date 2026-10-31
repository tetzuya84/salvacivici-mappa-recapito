/* Beta 0.6.27 — non usare il meta deprecato statusbar; preservare stile. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const readme=fs.readFileSync('README.md','utf8');
const idx=html.indexOf('class="status-bar-color-anchor"');
const shell=html.indexOf('class="app-shell is-capture"');
assert.ok(idx>html.indexOf('<body>')&&idx<shell,'Elemento reale prima della shell');
assert.equal((html.match(/class="status-bar-color-anchor"/g)||[]).length,1);
assert.match(html,/class="status-bar-color-anchor" aria-hidden="true"/);
const style=css.slice(css.lastIndexOf('/* Beta 0.6.25'));
assert.match(style,/@supports \(-webkit-touch-callout: none\)/);
assert.match(style,/\.status-bar-color-anchor\s*\{/);
for(const item of ['position:fixed;','top:0;','left:0;','width:100%;','height:8px;','background:#0c1b29;','z-index:2002;','pointer-events:none;'])
 assert.ok(style.includes(item),'stile essenziale '+item);
const previous=css.slice(css.lastIndexOf('/* Beta 0.6.24'),css.lastIndexOf('/* Beta 0.6.25'));
assert.match(previous,/min-height:calc\(58px \+ env\(safe-area-inset-top\)\)/);
assert.match(previous,/width:40px;height:40px;/);
const header=html.slice(html.indexOf('<header class="topbar"'),html.indexOf('</header>'));
assert.ok(!header.includes('BETA'));
assert.match(html,/SalvaCivici · BETA 0\.6\.27/);
assert.doesNotMatch(html,/<meta\s+name="apple-mobile-web-app-status-bar-style"/,"WebKit: rimuovere il meta deprecato");
assert.match(html,/viewport-fit=cover/);
assert.match(sw,/salvacivici-v0\.6\.27/);
assert.ok(readme.includes('Beta **0.6.27**:'));
assert.ok(html.includes('id="capture-form"') && html.includes('id="map-review-dialog"') && html.includes('id="page-map"'));
console.log('PASS Beta 0.6.27: meta WebKit deprecato rimosso, layout e dati intatti');
