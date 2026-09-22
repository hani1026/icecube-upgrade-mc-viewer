'use strict';
const MC = (() => {
  const validVector = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  const distance = (a,b) => Math.hypot(...a.map((v,i)=>v-b[i]));
  function segments(event) {
    const result=[];
    event.truth.forEach((p,index)=>{
      const pdg=Math.abs(p.pdg);
      if (![11,12,13,14,15,16].includes(pdg) || p.shape==='Dark' || !validVector(p.pos) || !Number.isFinite(p.time)) return;
      const children=event.truth.filter(c=>c.parent===index && validVector(c.pos) && Number.isFinite(c.time));
      // Propagated lepton children supersede the summary parent's straight track.
      if (children.some(c=>c.pdg===p.pdg && c.shape!=='Dark' && c.length>0)) return;
      if (Number.isFinite(p.length) && p.length>0 && validVector(p.dir) && p.speed>0 && Number.isFinite(p.speed)) {
        result.push({...p,index,end:p.pos.map((v,i)=>v+p.dir[i]*p.length),endTime:p.time+p.length/p.speed,provenance:'length'});
        return;
      }
      // A daughter's position is its birth site: the incoming PARENT travels here.
      // Only a single unambiguous displaced daughter vertex can supply an endpoint.
      const displaced=children.filter(c=>distance(p.pos,c.pos)>1e-6 && c.time>=p.time);
      if (!displaced.length || displaced.some(c=>distance(c.pos,displaced[0].pos)>1e-4)) return;
      const child=displaced.reduce((a,b)=>a.time<b.time?a:b);
      const length=distance(p.pos,child.pos);
      result.push({...p,index,end:[...child.pos],length,dir:child.pos.map((v,i)=>(v-p.pos[i])/length),endTime:child.time,provenance:'vertices'});
    });
    return result;
  }
  function rank(catalogue,state) {
    const targetCos=Math.cos(state.zenith*Math.PI/180);
    return catalogue.filter(e=>Math.abs(e.pdg)===state.flavor && e.interaction===state.interaction && (!state.sign || Math.sign(e.pdg)===state.sign)).map(event=>{
      const dE=(Math.log10(event.energy)-Math.log10(state.energy))/.25;
      const dZ=(event.coszen-targetCos)/.25;
      const az=event.azimuth*180/Math.PI;
      const dA=state.azimuthEnabled?Math.min(Math.abs(az-state.azimuth),360-Math.abs(az-state.azimuth))/45:0;
      return {event,score:dE*dE+dZ*dZ+dA*dA};
    }).sort((a,b)=>a.score-b.score || a.event.id.localeCompare(b.event.id));
  }
  return {validVector,distance,segments,rank};
})();
if(typeof module!=='undefined') module.exports=MC;
