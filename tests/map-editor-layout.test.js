/* Beta 0.6.21 — struttura dell'editor e stacking del footer su iOS. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('styles.css','utf8');
const d=html.slice(html.indexOf('<dialog id="map-review-dialog"'),html.indexOf('</dialog>',html.indexOf('<dialog id="map-review-dialog"')));
const scroller=d.indexOf('<div class="map-review-scroll">');
const footer=d.indexOf('<div class="map-review-footer"');
assert.ok(scroller>0&&footer>scroller,'Finestra divisa in contenuto e footer indipendente');
assert.ok(d.indexOf('id="map-review-canvas"')>scroller&&d.indexOf('id="map-review-canvas"')<footer,'Mappa soltanto nello scroller');
for(const id of ['map-review-reset','map-review-confirm','map-review-cancel']){
 const i=d.indexOf('id="'+id+'"');
 assert.ok(i>footer, id+' deve stare nel footer sempre visibile');
 assert.equal(d.split('id="'+id+'"').length,2,'Il bottone deve essere unico');
}
const styles=css.slice(css.indexOf('/* Beta 0.6.21'));
assert.match(styles,/\.map-review-pane\s*\{[^}]*overflow:hidden;/);
assert.match(styles,/\.map-review-scroll\s*\{[^}]*overflow-y:auto;/);
assert.match(styles,/\.map-review-footer\s*\{[^}]*flex:0 0 auto;/);
assert.match(styles,/\.map-review-map-wrap\s*\{[^}]*contain:paint;overflow:hidden;/);
assert.match(styles,/safe-area-inset-bottom/);
assert.match(styles,/\.overview-edit-pin/);
assert.match(html,/id="overview-edit-pin"[^>]*hidden/);
assert.match(html,/BETA 0\.6\.21/);
console.log('Beta 0.6.21: footer salvataggio sempre visibile e mappa confinata, PASS.');
