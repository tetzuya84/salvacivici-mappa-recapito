/* Beta 0.6.22 — test regressione richieste EXIF (IMG_4609, 4608, 4605). */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');
const app=fs.readFileSync('app.js','utf8');
const map=fs.readFileSync('map-overview.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const start=html.indexOf('<section id="page-map"');
const end=html.indexOf('<section id="page-data"',start);
const area=html.slice(start,end);
const mapContainer=area.indexOf('<div class="overview-map-wrap"');
const containerEnd=area.indexOf('</div>',area.indexOf('id="overview-canvas"'));// Leaflet canvas div close
const mapEnd=area.indexOf('</div>',area.indexOf('id="overview-locate"'));
const edit=area.indexOf('id="overview-edit-pin"');
const status=area.indexOf('id="overview-location-status"');
const detail=area.indexOf('id="overview-detail"');
assert.ok(mapContainer>=0 && containerEnd<mapEnd && mapEnd<edit && edit<status && status<detail,
 'Il pulsante Modifica pin deve stare immediatamente sotto il div della mappa, non dentro');
assert.equal((area.match(/id="overview-edit-pin"/g)||[]).length,1);
assert.ok(!area.includes('id="overview-verify"'),'Nessuna doppia Modifica pin nella scheda civico');
assert.ok(!map.includes("overview-verify"),'Nessun listener verso elemento eliminato');
assert.match(map,/editPinButton\.addEventListener\('click',editSelected\)/);
assert.match(area,/<a id="overview-apple"[^>]*aria-label="Naviga con Apple Mappe"[^>]*>Naviga<\/a>/);
assert.ok(!area.includes('Seleziona un numero, controlla il pin'));
assert.ok(!html.includes('id="gps-coordinates"'));
assert.ok(!html.includes('id="gps-lat"')&&!html.includes('id="gps-lon"'));
assert.ok(!app.includes("gps-coordinates")&&!app.includes("gps-lat")&&!app.includes("gps-lon"));
assert.ok(!css.includes(".gps-more"));
assert.match(css,/\.overview-actions\{display:block;\}/);
assert.match(css,/\.overview-actions \.primary\{display:flex;width:100%;/);
assert.match(css,/\.app-shell #page-map \.overview-edit-pin\{[^}]*position:relative;display:flex;/);
assert.ok(!css.includes('position:absolute;right:12px;bottom:12px;z-index:1100;\n  appearance:none;border:2px solid #fff'));
assert.match(sw,/salvacivici-v0\.6\.22/);
// GPS data and 3 sample checks must remain: only an optional UI section has been removed.
assert.match(app,/gpsValidated&&gps\.sampleCount>=GPS_TARGET_SAMPLES/);
assert.match(app,/SC\.isFreshGps\(state\.gps,Date\.now\(\),GPS_MAX_SAVE_AGE_MS\)/);
assert.match(app,/SC\.applyVerifiedPosition\(base,selectedPosition\)/);
console.log('Beta 0.6.22: EXIF captions & DOM, CSS, GPS unchanged: PASS');
