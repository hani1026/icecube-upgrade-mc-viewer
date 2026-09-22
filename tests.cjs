'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
process.chdir(__dirname);const MC=require('./model.js');const read=p=>JSON.parse(fs.readFileSync(p));
const catalogue=read('data/catalogue.json'),geometry=read('data/geometry.json'),metadata=read('data/metadata.json');
let native=0,vertices=0,pulses=0;const ids=new Set();
for(const entry of catalogue){assert(!ids.has(entry.id));ids.add(entry.id);const path=`data/events/${entry.id}.json`;assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'),entry.sha256);const e=read(path);assert.equal(e.pulses.length,entry.pulses);assert(Math.abs(e.primary.dir[2]+e.coszen)<1e-12);pulses+=e.pulses.length;
 const incoming=MC.incoming(e.primary);assert(incoming);assert.equal(incoming.provenance,'direction-extrapolation');assert.equal(incoming.endTime,e.primary.time);assert(MC.distance(incoming.end,e.primary.pos)<1e-10);assert(Math.abs(MC.distance(incoming.pos,incoming.end)-2000)<1e-9);assert(Math.abs((incoming.endTime-incoming.time)*incoming.speed-2000)<1e-9);assert(incoming.dir.every((v,i)=>(incoming.end[i]-incoming.pos[i])*v>=0));

 for(const s of MC.segments(e)){assert(s.length>0);assert(s.endTime>=s.time);assert(s.shape!=='Dark');assert(Math.abs(MC.distance(s.pos,s.end)-s.length)<1e-6);if(s.provenance==='length'){native++;assert.equal(s.length,e.truth[s.index].length);}else{vertices++;assert(e.truth.some(c=>c.parent===s.index && MC.distance(c.pos,s.end)<1e-4));}}
}
assert.equal(ids.size,metadata.events);assert.equal(pulses,metadata.selected_quality.pulses);assert.equal(geometry.surface_z-geometry.bedrock_z,2810);
const state={flavor:14,interaction:1,sign:0,energy:100,zenith:60,azimuth:180,azimuthEnabled:false};
for(const flavor of [12,14,16])for(const sign of [-1,1])for(const interaction of [1,2])for(const energy of [1,10,100,500])for(const zenith of [0,90,180]){const result=MC.rank(catalogue,{...state,flavor,sign,interaction,energy,zenith});assert(result.length);assert(result.every(x=>Math.abs(x.event.pdg)===flavor&&Math.sign(x.event.pdg)===sign&&x.event.interaction===interaction));assert(result.every((x,i)=>i===0||x.score>=result[i-1].score));}
// Selecting a stored event's exact energy/direction recovers it, even at 0/360 degrees.
const e=catalogue[0];assert(MC.rank(catalogue,{...state,flavor:Math.abs(e.pdg),sign:Math.sign(e.pdg),interaction:e.interaction,energy:e.energy,zenith:Math.acos(e.coszen)*180/Math.PI,azimuth:e.azimuth*180/Math.PI,azimuthEnabled:true})[0].score<1e-20);
const base={pdg:15,parent:null,shape:'StartingTrack',pos:[0,0,0],dir:[0,0,1],time:0,length:null,speed:.299792458};
assert.equal(MC.segments({truth:[base,{...base,parent:0,pdg:11}]}).length,0,'coincident vertices must not become a track');
const tau=MC.segments({truth:[base,{...base,parent:0,pdg:11,pos:[0,0,.001],time:1}]}).at(0);assert.equal(tau.pdg,15);assert.equal(tau.length,.001);assert.equal(tau.endTime,1);
const nu=MC.segments({truth:[{...base,pdg:16},{...base,parent:0,pos:[0,0,2],time:10}]}).at(0);assert.equal(nu.pdg,16,'incoming neutrino-to-tau vertex connection belongs to the neutrino');assert.equal(nu.length,2);
assert.equal(MC.segments({truth:[base,{...base,parent:0,pdg:11,pos:[0,0,1],time:1},{...base,parent:0,pdg:12,pos:[0,0,2],time:2}]}).length,0,'ambiguous endpoint must not be invented');
const mu={...base,pdg:13,length:10};assert.equal(MC.segments({truth:[{...mu,shape:'Dark'},{...mu,parent:0}]}).length,1);assert.equal(MC.segments({truth:[mu,{...mu,parent:0}]}).length,1);
console.log(JSON.stringify({status:'passed',events:ids.size,pulses,native_length_segments:native,vertex_connection_segments:vertices,slider_combinations:144},null,2));
