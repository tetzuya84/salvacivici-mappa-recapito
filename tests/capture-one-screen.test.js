/* Beta 0.6.55 — il salvataggio deve essere visibile sulla pagina Salva
 * su iPhone verticale, senza nascondere i controlli GPS o rompere il pull. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const css=fs.readFileSync('styles.css','utf8');
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const tag='/* Beta 0.6.55 — Acquisizione iPhone in un\'unica schermata.';
const fit=css.split(tag)[1];
assert.ok(fit,'Manca la regola di acquisizione compatta');
assert.match(fit,/@media\s*\(max-width:639px\) and \(orientation:portrait\)/);
for(const selector of [
  '#page-capture:not([hidden])',
  '#capture-form',
  '.form-card',
  '.capture-field-group',
  '.comune-row',
  '.gps-section-heading',
  '.gps-meter-foot',
  '.gps-meter-message',
  '.map-open-button',
  '#map-review-note',
  '#save-button'
])assert.ok(fit.includes(selector),'Manca '+selector);
assert.ok(fit.includes('margin-top:auto;min-height:49px'),'Salva resta in fondo e toccabile');
assert.ok(fit.includes('min-height:44px'),'Conservare target tocco e input');
assert.match(css,/main\{[\s\S]*?overflow-y:auto;/,'Scroll di emergenza mantenuto');
assert.ok(!/overflow-y:hidden|display:none!important/.test(fit),'Non tagliare i controlli critici');
assert.ok(html.includes('id="gps-samples"')&&html.includes('id="gps-details"'));
assert.ok(html.includes('id="map-open"')&&html.includes('id="save-button" type="submit"'));
assert.match(app,/scroller\.scrollTop=0/,'Reset scroll sulle schede preservato');
console.log('PASS Beta 0.6.55: acquisizione iPhone compatta, salvataggio accessibile, GPS e pull intatti.');
