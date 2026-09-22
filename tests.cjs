'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');process.chdir(__dirname);
const read=p=>JSON.parse(fs.readFileSync(p));const catalogue=read('data/catalogue.json'),geometry=read('data/geometry.json'),metadata=read('data/metadata.json');
const source=fs.readFileSync('app.js','utf8');
const context=vm.createContext({});vm.runInContext(source.slice(source.indexOf('function isFiniteVector'),source.indexOf('function buildTruth')),context);
let finiteSegments=0,missingLengths=0,pulseCount=0;const ids=new Set();const counts=new Map();
for(const entry of catalogue){assert(!ids.has(entry.id));ids.add(entry.id);const event=read(`data/events/${entry.id}.json`);assert.equal(event.pulses.length,entry.pulses);assert.equal(event.primary.pdg,entry.pdg);assert.equal(event.interaction,entry.interaction);assert(Math.abs(event.primary.dir[2]+event.coszen)<1e-12);let previous=-Infinity;for(const pulse of event.pulses){assert(pulse[1]>=previous);previous=pulse[1];assert(geometry.channels[pulse[0]]);assert(pulse.every(Number.isFinite));}pulseCount+=event.pulses.length;const segments=context.trackParticles(event);for(const p of segments){assert(p.shape!=='Dark');assert(p.length>0);const displacement=p.dir.map(x=>x*p.length);assert(Math.abs(Math.hypot(...displacement)-p.length)<1e-6);assert(Number.isFinite(p.time+p.length/p.speed));finiteSegments++;}missingLengths+=event.truth.filter(p=>p.length===null).length;const key=entry.cell.join(',');counts.set(key,(counts.get(key)||0)+1);assert(counts.get(key)<=2);}
assert.equal(ids.size,metadata.events);assert.equal(counts.size,metadata.occupied_cells);assert.equal(pulseCount,metadata.selected_quality.pulses);assert.equal(missingLengths,metadata.selected_quality.truth_missing_length);assert.equal(geometry.surface_z-geometry.bedrock_z,2810);assert.equal(read('data/validation.json').events_verified,catalogue.length);
// Stored zero/unknown lengths must never become tracks; a Dark parent must not duplicate children.
const base={pdg:13,shape:'Null',pos:[0,0,0],dir:[0,0,1],time:0,speed:.299792458,length:10};
assert.equal(context.trackParticles({truth:[{...base,shape:'Dark'},{...base,parent:0},{...base,length:null},{...base,length:0}]}).length,1);
assert.equal(context.trackParticles({truth:[{...base,length:20},{...base,parent:0}]}).length,1);
console.log(JSON.stringify({status:'passed',events:ids.size,pulses:pulseCount,renderable_native_lepton_segments:finiteSegments,missing_lengths_preserved:missingLengths,occupied_cells:counts.size},null,2));
