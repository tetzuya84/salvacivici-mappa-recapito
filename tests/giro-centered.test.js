/* SalvaCivici Beta 0.6.60 — centratura della scheda Giro su iPhone. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const css=fs.readFileSync('styles.css','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const panel=html.split('<section id="page-giro"')[1]?.split('<section id="page-data"')[0]||'';
const style=css.split('/* Beta 0.6.60 — Giro allineato allo stile centrato')[1];
assert.ok(style,'Regole dedicate assenti');
assert.match(style,/\.app-shell #page-giro \.giro-head\s*\{[^}]*text-align:center/s);
assert.match(style,/#page-giro \.giro-head > div\s*\{[^}]*text-align:center/s);
assert.match(style,/#page-giro #giro-count\s*\{[^}]*flex:0 0 100%[^}]*margin-right:0/s);
assert.match(style,/#page-giro \.giro-selection-actions\s*\{[^}]*justify-content:center/s);
assert.match(style,/#page-giro \.giro-main-actions button\s*\{[^}]*justify-content:center/s);
const essential=['.giro-status','.giro-label','#giro-search','#giro-count','.giro-preview h2','.giro-preview .giro-hint','.giro-next','.giro-route-coverage'];
const group=style.split('text-align:center;').slice(1,2).join('');
for(const key of essential)assert.ok(style.includes('#page-giro '+key),'Centratura mancante: '+key);
for(const key of ['.giro-stop-row','.giro-itinerary','.giro-itinerary li'])
 assert.ok(style.includes('#page-giro '+key),'Riga dell’elenco allineata a sinistra: '+key);
assert.match(style,/#page-giro \.giro-itinerary li\s*\{\s*text-align:left/s);
for(const id of ['giro-stops','giro-itinerary','giro-recalc','giro-preview','giro-search','giro-select-all','giro-clear','giro-apple','giro-google'])
 assert.ok(panel.includes('id="'+id+'"'),'Controllo Giro conservato: '+id);
assert.ok(!style.includes('touch-action:none'),'Lo scroll della scheda non viene bloccato');
assert.match(css,/#page-giro \.giro-drag-handle\{[\s\S]*?touch-action:none/);
assert.match(html,/BETA 0\.6\.60/);
assert.match(sw,/salvacivici-v0\.6\.60/);
console.log('PASS Beta 0.6.60: Giro centrato come altre schede, righe leggibili, controlli intatti.');
