/* Beta 0.6.57 — popup per la revisione del pin su iPhone. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');
const js=fs.readFileSync('map-review.js','utf8');
const part=html.split('<dialog id="map-review-dialog"')[1]?.split('</dialog>')[0];
assert.ok(part,'Popup mancante');
assert.ok(part.includes('Trascina il pin o tocca l’ingresso.'));
assert.ok(!part.includes('Zoom e rotazione con due dita'));
assert.ok(part.includes('class="map-review-about"')&&part.includes('Info cartografia'));
assert.ok(part.includes('Cartografia © OpenStreetMap')&&part.includes('© Esri'));
for(const id of ['map-review-canvas','map-review-gps-status','map-review-basemap',
'map-review-compass','map-review-status','map-review-coordinates',
'map-review-reset','map-review-confirm','map-review-cancel','map-review-close']){
 assert.ok(part.includes('id="'+id+'"'),'Controllo essenziale mancante: '+id);
}
const fit=css.split('/* Beta 0.6.56 — anteprima pin con più superficie cartografica:')[1];
assert.ok(fit,'Nuovo layout mancante');
for(const selector of ['.map-review-pane','.map-review-scroll','.map-review-map-wrap',
'.map-review-canvas','.map-review-footer','.map-review-about'])
 assert.ok(fit.includes(selector),'Manca '+selector);
assert.match(fit,/\.map-review-map-wrap\s*\{[^}]*flex:1 1 auto/s);
assert.match(fit,/\.map-review-canvas\s*\{[^}]*height:100%/s);
assert.match(fit,/\.map-review-footer\s*\{[^}]*flex:none/s);
assert.ok(!fit.includes('display:none'),'Nessun comando nascosto');
assert.ok(js.includes('Posizione corretta di '));
assert.ok(js.includes('Caricamento mappa…'));
assert.match(html,/BETA 0\.6\.57/);
console.log('PASS Beta 0.6.57: popup compatto, mappa elastica, tasti e copyright preservati.');
