/* Beta 0.6.18 — controlli statici di stacking CSS e protezione layout. */
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const css=fs.readFileSync('styles.css','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const section=css.slice(css.lastIndexOf('/* Beta 0.6.18'));
assert.ok(section.length>400,'Sezione fix CSS presente');
assert.match(section,/\.app-shell \.topbar,[\s\S]*?position:sticky;[\s\S]*?z-index:2000;/);
assert.match(section,/\.app-shell \.tabbar,[\s\S]*?position:fixed;[\s\S]*?z-index:2000;[\s\S]*?background:#fff;/);
assert.match(section,/\.app-shell #page-map[\s\S]*?isolation:isolate;/);
assert.match(section,/\.overview-map-wrap[\s\S]*?contain:paint;[\s\S]*?overflow:hidden;/);
assert.ok(!section.includes('body{overflow:hidden')&&!section.includes('.app-shell{overflow:hidden'));
assert.match(html,/BETA 0\.6\.18/);
assert.match(sw,/salvacivici-v0\.6\.18/);
assert.match(html,/data-tab="map"/);
assert.match(html,/data-tab="records"/);
console.log('Beta 0.6.18: barre fisse e isolamento mappa verificati.');
