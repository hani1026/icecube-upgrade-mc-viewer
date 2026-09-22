/* Native MC data, original viewer controls and metre-scale geometry. */
'use strict';
const $=id=>document.getElementById(id), V=a=>new THREE.Vector3(...a);
const SUBS=['IceCube','DeepCore','Upgrade'], DET_IDS={IceCube:'det-ic',DeepCore:'det-dc',Upgrade:'det-up'};
const NU={12:'νe',14:'νμ',16:'ντ'}, LEP={11:'e',13:'μ',15:'τ'};
const COL={11:0x34c759,12:0x34c759,13:0xff9500,14:0xff9500,15:0xff2d55,16:0xff2d55};
const EARTH_R=6371000;
const state={flavor:14,interaction:1,sign:0,energy:100,zenith:60,azimuth:180,azimuthEnabled:false,view:'det'};
const THEMES={
 light:{bg:0xeef0f5,sub:{IceCube:0x7d8da8,DeepCore:0x3aa5d8,Upgrade:0xd9902b},label:'#6e6e73',strong:'#1d1d1f',vertex:0x1d1d1f,globe:0x8fb8e6,globeOp:.16,grid:0x7ea1cf,ice:0x438aaf,surface:0xc0e2ef,rock:0x857364,dust:0x977347},
 dark:{bg:0x0b0b0f,sub:{IceCube:0x5b7ea8,DeepCore:0x7fc4e6,Upgrade:0xd9a04a},label:'#98989d',strong:'#f5f5f7',vertex:0xffffff,globe:0x1e4a78,globeOp:.18,grid:0x3f6a9a,ice:0x7cbfe3,surface:0xc2e8f5,rock:0x998473,dust:0xc8a477}
};
let theme=THEMES[matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'];
let geo,catalogue,current,ranked=[],generation=0,playing=false,fraction=1,lastWall=0,tmin=0,tmax=1,cmin=0,cmax=1,actors=[];
let renderer,scene,camera,orbit,hitMesh,earth,globe,grid,earthMark,earthLabel,guideLabel,guideLine;
let geology=new THREE.Group(),geologyLabels=new THREE.Group(),truth=new THREE.Group(),guide=new THREE.Group();
const detectors={},layerMaterials=[],dummy=new THREE.Object3D(),color=new THREE.Color();
const stage=$('stage'),canvas=$('c');
const fmtE=e=>e>=100?`${Math.round(e)} GeV`:e>=10?`${e.toFixed(1)} GeV`:`${e.toFixed(2)} GeV`;
const fmtT=t=>{const a=Math.abs(t);return `t = ${t<0?'−':'+'}${a>=10000?(a/1000).toFixed(1)+' µs':Math.round(a).toLocaleString()+' ns'}`;};
const particleName=p=>[12,14,16].includes(Math.abs(p.pdg))?`${p.pdg<0?'anti-':''}${NU[Math.abs(p.pdg)]}`:`${LEP[Math.abs(p.pdg)]}${p.pdg<0?'+':'−'}`;
function setPlaying(value){playing=value;$('play').textContent=value?'❙❙':fraction>=1?'↻':'▶';$('play').setAttribute('aria-label',value?'Pause event':'Play event');}
function fail(error){$('error').hidden=false;$('error').textContent=`Unable to load MC: ${error.message}`;$('loading').hidden=true;console.error(error);}
async function getJSON(path){const response=await fetch(path);if(!response.ok)throw Error(`HTTP ${response.status}: ${path}`);return response.json();}
function clearGroup(group){const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)materials.add(m);});group.clear();geometries.forEach(g=>g.dispose());materials.forEach(m=>{m.map?.dispose();m.dispose();});}
function makeLine(a,b,hex,dashed=false,opacity=1){const mat=dashed?new THREE.LineDashedMaterial({color:hex,dashSize:40,gapSize:25,transparent:true,opacity,depthWrite:false}):new THREE.LineBasicMaterial({color:hex,transparent:true,opacity,depthWrite:false});const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(a),V(b)]),mat);line.frustumCulled=false;if(dashed)line.computeLineDistances();return line;}
function dot(hex,px=8){const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');ctx.fillStyle='#'+new THREE.Color(hex).getHexString();ctx.beginPath();ctx.arc(16,16,13,0,2*Math.PI);ctx.fill();const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false,depthWrite:false,sizeAttenuation:false}));sp.userData.pixelSize=px;sp.renderOrder=15;sizeSprite(sp);return sp;}
function label(text,hex=theme.label,px=13){const c=document.createElement('canvas'),ctx=c.getContext('2d');ctx.font='30px -apple-system, sans-serif';c.width=Math.ceil(ctx.measureText(text).width)+16;c.height=46;ctx.font='30px -apple-system, sans-serif';ctx.fillStyle=hex;ctx.textBaseline='middle';ctx.fillText(text,8,23);const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false,depthWrite:false,sizeAttenuation:false}));sp.userData.pixelSize=px*46/30;sp.userData.aspect=c.width/c.height;sp.renderOrder=20;sizeSprite(sp);return sp;}
function sizeSprite(sp){const h=sp.userData.pixelSize*2/(Math.max(stage.clientHeight,300)*2.747);sp.scale.set(h*(sp.userData.aspect||1),h,1);}

class Orbit {
 constructor(){this.target=new THREE.Vector3(0,0,localCenter());this.goalTarget=this.target.clone();this.radius=6800;this.goal=6800;this.theta=.5;this.phi=1.35;this.pointers=new Map();
  canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,[e.clientX,e.clientY]);};
  canvas.onpointerup=canvas.onpointercancel=e=>this.pointers.delete(e.pointerId);
  canvas.onpointermove=e=>{const old=this.pointers.get(e.pointerId);if(!old)return;
   if(this.pointers.size===2){const other=[...this.pointers.entries()].find(([id])=>id!==e.pointerId)[1];const d=Math.hypot(e.clientX-other[0],e.clientY-other[1]);if(d>0)this.radius*=Math.hypot(old[0]-other[0],old[1]-other[1])/d;this.goal=this.radius;}
   else if(e.shiftKey||e.buttons===2){const k=this.radius*.001;this.target.x-=(e.clientX-old[0])*k*Math.sin(this.theta);this.target.y+=(e.clientX-old[0])*k*Math.cos(this.theta);this.target.z+=(e.clientY-old[1])*k;this.goalTarget.copy(this.target);}
   else{this.theta-=(e.clientX-old[0])*.006;this.phi-=(e.clientY-old[1])*.006;}
   this.radius=Math.max(20,Math.min(9e7,this.radius));this.phi=Math.max(.05,Math.min(Math.PI-.05,this.phi));this.pointers.set(e.pointerId,[e.clientX,e.clientY]);};
  canvas.oncontextmenu=e=>e.preventDefault();canvas.addEventListener('wheel',e=>{e.preventDefault();this.radius=Math.max(20,Math.min(9e7,this.radius*Math.exp(e.deltaY*.002)));this.goal=this.radius;},{passive:false});
  canvas.ondblclick=()=>setView('focus');
 }
 flyTo(radius,target){this.goal=radius;this.goalTarget.copy(V(target));}
 update(){this.radius=Math.exp(Math.log(this.radius)+(Math.log(this.goal)-Math.log(this.radius))*.12);this.target.lerp(this.goalTarget,.12);const s=Math.sin(this.phi);camera.position.set(this.target.x+this.radius*s*Math.cos(this.theta),this.target.y+this.radius*s*Math.sin(this.theta),this.target.z+this.radius*Math.cos(this.phi));camera.up.set(0,0,1);camera.lookAt(this.target);}
}
function localCenter(){return (geo.surface_z+geo.bedrock_z-300)/2;}
function initScene(){
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,logarithmicDepthBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(theme.bg);
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,1,.1,2e8);orbit=new Orbit();scene.add(geology,truth,guide);geology.add(geologyLabels);
 for(const sub of SUBS){const group=new THREE.Group();detectors[sub]=group;scene.add(group);const modules=geo.modules.filter(m=>m[6]===sub);
  const mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:theme.sub[sub],transparent:true,opacity:.8}),modules.length);
  modules.forEach((m,i)=>{dummy.position.set(...m.slice(2,5));dummy.scale.setScalar(sub==='Upgrade'?3.8:3.4);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});group.add(mesh);
  const strings=new Map();for(const m of modules){if(!strings.has(m[0]))strings.set(m[0],[]);strings.get(m[0]).push(m);}const pts=[];for(const ms of strings.values()){ms.sort((a,b)=>a[4]-b[4]);pts.push(...ms[0].slice(2,5),...ms.at(-1).slice(2,5));}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));group.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:theme.sub[sub],transparent:true,opacity:.3})));
 }
 hitMesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),new THREE.MeshBasicMaterial({transparent:true,opacity:.95}),geo.modules.length);hitMesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(geo.modules.length*3),3);hitMesh.frustumCulled=false;hitMesh.count=0;scene.add(hitMesh);
 buildEarth();buildGeology();new ResizeObserver(resize).observe(stage);resize();requestAnimationFrame(animate);
}
function buildEarth(){earth=new THREE.Group();earth.position.z=geo.surface_z-EARTH_R;scene.add(earth);
 globe=new THREE.Mesh(new THREE.SphereGeometry(EARTH_R,96,64),new THREE.MeshBasicMaterial({color:theme.globe,transparent:true,opacity:theme.globeOp,depthWrite:false}));earth.add(globe);
 const pts=[],r=EARTH_R*1.001;
 for(let lat=-60;lat<=60;lat+=30){const rr=r*Math.cos(lat*Math.PI/180),z=r*Math.sin(lat*Math.PI/180);for(let i=0;i<180;i++){const a=i*Math.PI/90,b=(i+1)*Math.PI/90;pts.push(rr*Math.cos(a),rr*Math.sin(a),z,rr*Math.cos(b),rr*Math.sin(b),z);}}
 for(let lon=0;lon<180;lon+=45){const a=lon*Math.PI/180;for(let i=0;i<180;i++){const t=i*Math.PI/90,u=(i+1)*Math.PI/90;pts.push(r*Math.cos(t)*Math.cos(a),r*Math.cos(t)*Math.sin(a),r*Math.sin(t),r*Math.cos(u)*Math.cos(a),r*Math.cos(u)*Math.sin(a),r*Math.sin(u));}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));grid=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:theme.grid,transparent:true,opacity:.35,depthWrite:false}));earth.add(grid);
 earthMark=dot(0x0a84ff,7);earthMark.position.set(0,0,geo.surface_z);scene.add(earthMark);earthLabel=label('IceCube · South Pole',theme.strong);earthLabel.position.copy(earthMark.position);earthLabel.center.set(.5,-.4);scene.add(earthLabel);
}
function layerMaterial(role,opacity,edges=false){const mat=edges?new THREE.LineBasicMaterial({color:theme[role],transparent:true,opacity,depthWrite:false}):new THREE.MeshBasicMaterial({color:theme[role],transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide});layerMaterials.push({mat,role,opacity});return mat;}
function buildGeology(){const width=2200;
 for(const [top,bottom,role,opacity] of [[geo.surface_z,geo.bedrock_z,'ice',.055],[geo.surface_z-2000,geo.surface_z-2100,'dust',.14],[geo.bedrock_z,geo.bedrock_z-300,'rock',.48]]){
  const g=new THREE.BoxGeometry(width,width,top-bottom),mesh=new THREE.Mesh(g,layerMaterial(role,opacity));mesh.position.z=(top+bottom)/2;mesh.renderOrder=-1;geology.add(mesh);const edges=new THREE.LineSegments(new THREE.EdgesGeometry(g),layerMaterial(role,.3,true));edges.position.copy(mesh.position);geology.add(edges);
 }
 for(const [z,role,opacity] of [[geo.surface_z,'surface',.16],[geo.bedrock_z,'rock',.28]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width),layerMaterial(role,opacity));m.position.z=z;m.renderOrder=-1;geology.add(m);}
 buildGeologyLabels();
}
function buildGeologyLabels(){clearGroup(geologyLabels);const offset=2200/Math.sqrt(2)+100;geologyLabels.add(makeLine([0,-offset,geo.surface_z],[0,-offset,geo.bedrock_z],theme.label,false,.5));
 for(const [text,z] of [['Surface',geo.surface_z],['Ice · 2.81 km',(geo.surface_z+geo.bedrock_z)/2],['Dust',geo.surface_z-2050],['Bedrock',geo.bedrock_z]]){const s=label(text,theme.strong,12);s.position.set(0,-offset-70,z);s.center.set(1,.5);s.userData.dust=text==='Dust';geologyLabels.add(s);}
}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();scene.traverse(o=>{if(o.userData.pixelSize)sizeSprite(o);});}
function setView(mode){state.view=mode;syncSegment('seg-view',mode==='earth'?'earth':'det');if(mode==='focus'&&current)orbit.flyTo(900,current.primary.pos);else orbit.flyTo(mode==='earth'?3.7e7:6800,[0,0,localCenter()]);}
function applyTheme(){theme=THEMES[matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'];renderer.setClearColor(theme.bg);globe.material.color.setHex(theme.globe);grid.material.color.setHex(theme.grid);for(const sub of SUBS)detectors[sub].children.forEach(c=>c.material.color.setHex(theme.sub[sub]));layerMaterials.forEach(({mat,role})=>mat.color.setHex(theme[role]));buildGeologyLabels();scene.remove(earthLabel);earthLabel.material.map.dispose();earthLabel.material.dispose();earthLabel=label('IceCube · South Pole',theme.strong);earthLabel.position.copy(earthMark.position);earthLabel.center.set(.5,-.4);scene.add(earthLabel);if(current){buildTruth();updateEvent();}}

function buildTruth(){clearGroup(truth);clearGroup(guide);actors=[];const p=current.primary,dir=V(p.dir),vertex=V(p.pos),back=dir.clone().negate(),o=vertex.clone().sub(new THREE.Vector3(0,0,geo.surface_z-EARTH_R));const b=o.dot(back),c=o.lengthSq()-EARTH_R**2;const guideLength=Math.max(1500,-b+Math.sqrt(Math.max(0,b*b-c))+20000);
 guideLine=makeLine(vertex.clone().addScaledVector(back,guideLength).toArray(),p.pos,COL[Math.abs(p.pdg)],true,.8);guide.add(guideLine);
 guideLabel=label(particleName(p)+' direction','#'+new THREE.Color(COL[Math.abs(p.pdg)]).getHexString(),13);guideLabel.center.set(-.2,-.2);guide.add(guideLabel);
 const incoming=MC.incoming(p);if(incoming){const hex=COL[Math.abs(p.pdg)],path=makeLine(incoming.pos,incoming.pos,hex,true),head=dot(hex,12),name=label(particleName(p),'#'+new THREE.Color(hex).getHexString(),15);name.center.set(-.4,-.25);guide.add(path,head,name);actors.push({kind:'incoming',p:incoming,path,head,name});}
 const vertexDot=dot(theme.vertex,5);vertexDot.position.copy(vertex);truth.add(vertexDot);actors.push({kind:'point',object:vertexDot,time:p.time});
 const segments=MC.segments(current);
 for(const segment of segments){const hex=COL[Math.abs(segment.pdg)],path=makeLine(segment.pos,segment.pos,hex,[12,14,16].includes(Math.abs(segment.pdg)));const head=dot(hex,9),name=label(particleName(segment),'#'+new THREE.Color(hex).getHexString(),14);name.center.set(-.35,-.2);truth.add(path,head,name);actors.push({kind:'track',p:segment,path,head,name});}
 // Birth markers keep e/tau visible even when their stored path length is absent.
 current.truth.forEach((q,index)=>{
  if(![11,13,15].includes(Math.abs(q.pdg))||q.shape==='Dark'||!MC.validVector(q.pos)||!Number.isFinite(q.time)||segments.some(s=>s.index===index))return;
  const head=dot(COL[Math.abs(q.pdg)],9),name=label(particleName(q),'#'+new THREE.Color(COL[Math.abs(q.pdg)]).getHexString(),14);head.position.copy(V(q.pos));name.position.copy(V(q.pos));name.center.set(-.35,-.2);truth.add(head,name);actors.push({kind:'point',object:head,time:q.time},{kind:'point',object:name,time:q.time});
 });
 // Hadronic showers are points, never invented metre-scale shower tracks.
 const sites=new Set();for(const q of current.truth){if(q.shape!=='Cascade'||[11,13,15].includes(Math.abs(q.pdg))||!MC.validVector(q.pos))continue;const key=q.pos.join(',');if(sites.has(key))continue;sites.add(key);const marker=dot(theme.vertex,4);marker.position.copy(V(q.pos));truth.add(marker);actors.push({kind:'point',object:marker,time:q.time});}
 truth.visible=$('opt-truth').checked;
}
function updateEvent(){if(!current)return;const time=tmin+fraction*(tmax-tmin),charges=new Float64Array(geo.modules.length),first=new Float64Array(geo.modules.length);first.fill(Infinity);let count=0;
 for(const pulse of current.pulses){if(pulse[1]>time)break;const m=geo.channels[pulse[0]][0];charges[m]+=pulse[2];first[m]=Math.min(first[m],pulse[1]);count++;}
 let index=0;for(let i=0;i<charges.length;i++){const m=geo.modules[i];if(!Number.isFinite(first[i])||!$(DET_IDS[m[6]]).checked)continue;dummy.position.set(...m.slice(2,5));dummy.scale.setScalar(9+13*Math.log10(1+Math.max(0,charges[i])));dummy.updateMatrix();hitMesh.setMatrixAt(index,dummy.matrix);color.setHSL(.68*Math.max(0,Math.min(1,(first[i]-cmin)/(cmax-cmin))),.95,.55);hitMesh.setColorAt(index,color);index++;}
 hitMesh.count=index;hitMesh.instanceMatrix.needsUpdate=true;hitMesh.instanceColor.needsUpdate=true;
 for(const a of actors){if(a.kind==='point'){a.object.visible=time>=a.time;continue;}const p=a.p;const f=p.endTime>p.time?Math.max(0,Math.min(1,(time-p.time)/(p.endTime-p.time))):time>=p.time?1:0;const end=V(p.pos).lerp(V(p.end),f);a.path.visible=time>=p.time&&f>0;a.path.geometry.attributes.position.setXYZ(1,end.x,end.y,end.z);a.path.geometry.attributes.position.needsUpdate=true;if(a.path.material.isLineDashedMaterial)a.path.computeLineDistances();const later=actors.some(b=>b.kind==='track'&&b.p.pdg===p.pdg&&b.p.time>p.time&&b.p.time<=time);a.head.visible=a.name.visible=time>=p.time&&!later&&(a.kind!=='incoming'||time<p.endTime);if(a.kind==='incoming'){a.path.visible=a.path.visible&&time<p.endTime;}a.head.position.copy(end);a.name.position.copy(end);}
 $('tslider').value=Math.round(fraction*1000);$('tlabel').textContent=fmtT(time-current.primary.time);$('tlabel').title=`${count} / ${current.pulses.length} recorded pulses`;
}
function animate(wall){requestAnimationFrame(animate);if(playing&&current){fraction=Math.min(1,fraction+Math.max(0,wall-lastWall)/10000);if(fraction>=1)setPlaying(false);updateEvent();}lastWall=wall;orbit.update();
 const far=Math.max(0,Math.min(1,(orbit.radius-18000)/32000)),near=1-far;
 earth.visible=far>.001;globe.material.opacity=theme.globeOp*far;grid.material.opacity=.35*far;earthMark.visible=earthLabel.visible=far>.1;
 geology.visible=$('opt-ice').checked&&near>.001;layerMaterials.forEach(({mat,role,opacity})=>mat.opacity=opacity*near*(role==='dust'&&!$('opt-dust').checked?0:1));geologyLabels.visible=orbit.radius>=2500;geologyLabels.rotation.z=orbit.theta;geologyLabels.children.forEach(c=>c.visible=!c.userData.dust||$('opt-dust').checked);
 truth.visible=$('opt-truth').checked&&near>.1;guide.visible=$('opt-guide').checked;
 if(current){const p=current.primary;guideLabel.visible=tmin+fraction*(tmax-tmin)>=p.time;guideLabel.position.copy(V(p.pos)).addScaledVector(V(p.dir),-Math.min(orbit.radius*.09,1e6));guideLine.material.dashSize=orbit.radius*.012;guideLine.material.gapSize=orbit.radius*.008;}
 renderer.render(scene,camera);
}

function syncSegment(id,value){$(id).querySelectorAll('button[data-v]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===String(value))));}
function bindSegment(id,callback){$(id).querySelectorAll('button[data-v]').forEach(button=>button.onclick=()=>{syncSegment(id,button.dataset.v);callback(button.dataset.v);});}
function updateTargets(){$('e-val').textContent=fmtE(state.energy);$('z-val').textContent=`${state.zenith.toFixed(0)}°`;$('az-val').textContent=state.azimuthEnabled?`${state.azimuth}°`:'Any';$('az-slider').disabled=!state.azimuthEnabled;}
let selectionTimer;
function requestSelection(){// Invalidate an in-flight older request before the debounce expires.
 generation++;clearTimeout(selectionTimer);updateTargets();$('loading').hidden=false;$('loading').textContent='Selecting MC…';selectionTimer=setTimeout(()=>chooseEvent(false),130);
}
async function chooseEvent(another=false){ranked=MC.rank(catalogue,state);if(!ranked.length){$('loading').hidden=true;return;}let choice=ranked[0].event;
 if(another){const near=ranked.slice(0,8).filter(x=>x.score<=ranked[0].score+2 && x.event.id!==current?.id);if(near.length)choice=near[Math.floor(Math.random()*near.length)].event;}
 await loadEvent(choice);
}
async function loadEvent(entry){const request=++generation;setPlaying(false);$('loading').hidden=false;try{const event=await getJSON(`data/events/${entry.id}.json`);if(request!==generation)return;current=event;
 const segments=MC.segments(event),incoming=MC.incoming(event.primary),times=[incoming?incoming.time:event.primary.time,event.primary.time,...event.pulses.map(p=>p[1]),...segments.flatMap(s=>[s.time,s.endTime])];tmin=Math.min(...times);tmax=Math.max(...times);if(tmax<=tmin)tmax=tmin+1;
 const pulseTimes=event.pulses.map(p=>p[1]);cmin=pulseTimes[Math.floor(pulseTimes.length*.02)];cmax=Math.max(cmin+200,pulseTimes[Math.min(pulseTimes.length-1,Math.floor(pulseTimes.length*.98))]);$('time-colors').title=`Pulse time colors: ${fmtT(cmin-event.primary.time)} → ${fmtT(cmax-event.primary.time)} (2–98% range)`;
 buildTruth();fraction=matchMedia('(prefers-reduced-motion: reduce)').matches?1:0;updateEvent();setPlaying(fraction<1);lastWall=performance.now();if(state.view==='focus')orbit.flyTo(900,event.primary.pos);
 const modules=new Set(event.pulses.map(p=>geo.channels[p[0]][0]));const charge=event.pulses.reduce((s,p)=>s+p[2],0);$('s-hits').textContent=`${modules.size} sensors · ${Math.round(charge).toLocaleString()} p.e.`;$('s-what').textContent=`${particleName(event.primary)} ${event.interaction===1?'CC':'NC'} · ${fmtE(event.primary.energy)} · ${(event.zenith*180/Math.PI).toFixed(1)}°`;
 $('s-match').textContent='Closest recorded event to slider settings';updateDetails();$('error').hidden=true;
 }catch(error){if(request===generation)fail(error);}finally{if(request===generation)$('loading').hidden=true;}}
function eventURL(){const url=new URL(location.href);url.hash=`event=${current.id}`;return url.href;}
function updateDetails(){const p=current.primary,segments=MC.segments(current),leptons=current.truth.filter(q=>[11,15].includes(Math.abs(q.pdg))&&q.parent!==null&&[12,16].includes(Math.abs(current.truth[q.parent].pdg)));const rows=[['Event',current.id],['Source',current.source],['Primary',`${particleName(p)} · ${fmtE(p.energy)}`],['Direction',`zenith ${(current.zenith*180/Math.PI).toFixed(3)}°, azimuth ${(current.azimuth*180/Math.PI).toFixed(3)}°`],['Vertex',p.pos.map(x=>x.toFixed(6)).join(', ')+' m'],['Pulse series',`${current.pulses.length} SplitInIcePulses`],['Incoming ν','Last 2 km extrapolated from MC direction at c; arrives at t = 0'],['Paths',`${segments.filter(s=>s.provenance==='length').length} stored lengths; ${segments.filter(s=>s.provenance==='vertices').length} vertex connections`],['Ice thickness',`${geo.surface_z-geo.bedrock_z} m (GCD)`]];
 for(const q of leptons){const parent=current.truth[q.parent];rows.push([`${particleName(parent)} → ${particleName(q)}`,`Δr = ${MC.distance(parent.pos,q.pos).toPrecision(6)} m; Δt = ${(q.time-parent.time).toPrecision(6)} ns`]);}
 const table=document.createElement('table');for(const [key,value] of rows){const tr=table.insertRow(),th=document.createElement('th');th.textContent=key;tr.append(th);tr.insertCell().textContent=value;}$('detail-content').replaceChildren(table);
 $('truth-description').textContent=leptons.length?'This event stores the neutrino and its electron/tau child at the same interaction site when Δr = 0. The colored e/τ birth marker is kept there; no spatial separation or missing track length is invented.':'Particle heads and labels follow the stored segments. Decay daughters appear at their own recorded birth locations and times.';
 $('event-download').href=`data/events/${current.id}.json`;$('event-link').href=eventURL();
}
function bindUI(){bindSegment('seg-view',setView);bindSegment('seg-particle',v=>{state.flavor=+v;requestSelection();});bindSegment('seg-int',v=>{state.interaction=+v;requestSelection();});bindSegment('seg-sign',v=>{state.sign=+v;requestSelection();});
 $('e-slider').oninput=e=>{state.energy=Math.min(500,10**(+e.target.value/1000));requestSelection();};$('z-slider').oninput=e=>{state.zenith=+e.target.value;requestSelection();};$('az-slider').oninput=e=>{state.azimuth=+e.target.value;requestSelection();};$('az-enabled').onchange=e=>{state.azimuthEnabled=e.target.checked;requestSelection();};
 for(const sub of SUBS)$(DET_IDS[sub]).onchange=e=>{detectors[sub].visible=e.target.checked;updateEvent();};$('opt-truth').onchange=()=>updateEvent();$('new-ev').onclick=()=>{clearTimeout(selectionTimer);chooseEvent(true);};$('focus-event').onclick=()=>setView('focus');
 $('play').onclick=()=>{if(!current)return;if(fraction>=1)fraction=0;setPlaying(!playing);lastWall=performance.now();updateEvent();};$('tslider').oninput=e=>{fraction=+e.target.value/1000;setPlaying(false);updateEvent();};
 $('details').onclick=()=>{if(current)$('detail-dialog').showModal();};$('close-details').onclick=()=>$('detail-dialog').close();$('share').onclick=async()=>{if(!current)return;try{await navigator.clipboard.writeText(eventURL());$('share').textContent='Copied';setTimeout(()=>$('share').textContent='Copy link',1800);}catch{$('detail-dialog').showModal();$('event-link').focus();}};
 matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
}
async function main(){[geo,catalogue]=await Promise.all(['geometry','catalogue'].map(n=>getJSON(`data/${n}.json`)));$('library-count').title=`${catalogue.length.toLocaleString()} real MC events`;initScene();bindUI();
 const id=new URLSearchParams(location.hash.slice(1)).get('event'),entry=catalogue.find(e=>e.id===id);
 if(entry){state.flavor=Math.abs(entry.pdg);state.interaction=entry.interaction;state.sign=Math.sign(entry.pdg);state.energy=entry.energy;state.zenith=Math.acos(entry.coszen)*180/Math.PI;$('e-slider').value=Math.log10(state.energy)*1000;$('z-slider').value=state.zenith;syncSegment('seg-particle',state.flavor);syncSegment('seg-int',state.interaction);syncSegment('seg-sign',state.sign);updateTargets();await loadEvent(entry);}else{updateTargets();await chooseEvent();}
}
main().catch(fail);
