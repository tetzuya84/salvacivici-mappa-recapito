const assert = require('node:assert/strict');
const core = require('../core.js');
const a={comune:'Piubega',via:'Via Roma',civico:'73/A'};
assert.equal(core.isSameCivic(a,{comune:'piubega',via:'VIA ROMA',civico:'73a'}),true);
assert.equal(core.isSameCivic(a,{comune:'Piubega',via:'Via Roma',civico:'74'}),false);
assert.equal(core.isSameCivic(a,{comune:'Redondesco',via:'Via Roma',civico:'73/A'}),false);
assert.ok(core.metersBetween({lat:45.123456789,lon:10.123456789},{lat:45.1234567885,lon:10.1234567895})<.1);
assert.equal(core.metersBetween({lat:0,lon:0},{lat:0,lon:0}),0);
const data=core.csv([{...a,lat:45.123456789,lon:10.123456789,accuracy:5,createdAt:'2026-10-28T10:51:00.000Z'}]);
assert.match(data,/"Latitudine"/);
assert.match(data,/45\.123456789/);
assert.match(data,/"73\/A"/);
assert.ok(core.isRecord({id:'test',...a,lat:45.1234567,lon:10.1234567,createdAt:'2026-10-28T10:51:00Z'}));
assert.equal(core.isRecord({id:'test',...a,lat:999,lon:10.1234567,createdAt:'x'}),false);
const x={lat:45.18,lon:10.42,accuracy:16,timestamp:100};
const y={lat:45.18001,lon:10.42001,accuracy:6,timestamp:101};
const z={lat:45.18002,lon:10.42002,accuracy:11,timestamp:102};
assert.strictEqual(core.bestGpsSample([x,y,z]),y);
assert.strictEqual(core.bestGpsSample([x,{...x,accuracy:16,timestamp:101}]).timestamp,101);
assert.strictEqual(core.bestGpsSample([]),null);
assert.strictEqual(core.bestGpsSample([x,{...y,accuracy:-1}]),x);
assert.strictEqual(core.bestGpsSample([x,{...y,lat:Infinity}]),x);
assert.equal(core.gpsSpread([x]),0);
assert.ok(core.gpsSpread([x,y,z])>0);
assert.ok(core.gpsSpread([x,y,z])<5);
assert.equal(core.validGpsSample(y),true);
assert.equal(core.validGpsSample({...y,timestamp:NaN}),false);
assert.equal(core.isFreshGps(y,115,30),true);
assert.equal(core.isFreshGps(y,135,30),false);
assert.equal(core.isFreshGps({...y,timestamp:NaN},115,30),false);
assert.equal(core.isFreshGps(y,115,-1),false);
assert.equal(core.isFreshGps({...y,timestamp:150},115,30),false);
const cases=[
 ['Via Roma 73/A','Via Roma','73/A'],
 ['Strada Campagnola, 51','Strada Campagnola','51'],
 ['Via XX Settembre 10','Via XX Settembre','10'],
 ['Via 24 Maggio 4','Via 24 Maggio','4'],
 ['Via Roma SNC','Via Roma','SNC'],
 ['Via Roma 14 bis','Via Roma','14 bis']
];
for(const [input,via,civico] of cases)assert.deepEqual(core.splitAddress(input),{via,civico});
assert.equal(core.splitAddress('Via Roma'),null);
assert.equal(core.splitAddress(''),null);
const polygon={name:'Comune Test',bbox:[9.9,44.9,10.1,45.1],geometry:{type:'Polygon',coordinates:[[[9.9,44.9],[10.1,44.9],[10.1,45.1],[9.9,45.1],[9.9,44.9]]]}};
assert.equal(core.getComune(45,10,[polygon]),'Comune Test');
assert.equal(core.getComune(46,10,[polygon]),'');
assert.equal(core.getComune(45,11,[polygon]),'');
console.log('35 test logici superati (GPS, civici, comune da confini).');
