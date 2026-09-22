// CPU-only Three.js scene checks. Public-browser rendering is verified separately.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
process.chdir(__dirname);const THREE={...require('./vendor/three.min.js')};
THREE.WebGLRenderer=class{setPixelRatio(){} setClearColor(){} setSize(){} render(){}};
const elements=new Map();function element(id){if(!elements.has(id))elements.set(id,{clientWidth:1280,clientHeight:720,checked:true,hidden:false,value:0,addEventListener(){},setAttribute(){},querySelectorAll(){return[];}});return elements.get(id);}
const document={getElementById:element,createElement(){return{width:32,height:32,getContext(){return{measureText:t=>({width:t.length*17}),fillText(){},beginPath(){},arc(){},fill(){}};}};}};
const read=p=>JSON.parse(fs.readFileSync(p));const catalogue=read('data/catalogue.json');
const events=[12,14,16].map(pdg=>read('data/events/'+catalogue.find(e=>e.pdg===pdg&&e.interaction===1&&e.energy>50).id+'.json'));
const context=vm.createContext({THREE,MC:require('./model.js'),document,matchMedia:()=>({matches:false,addEventListener(){}}),devicePixelRatio:1,ResizeObserver:class{observe(){}},requestAnimationFrame(){},performance:{now:()=>0},console,assert,fixtures:{geo:read('data/geometry.json'),events}});
vm.runInContext(fs.readFileSync('app.js','utf8').replace('main().catch(fail);',''),context);
vm.runInContext(`geo=fixtures.geo;initScene();for(const e of fixtures.events){current=e;tmin=e.primary.time-4000;tmax=e.primary.time+10000;cmin=tmin;cmax=tmax;buildTruth();const incoming=actors.find(a=>a.kind==='incoming');assert(incoming);tmin=incoming.p.time;tmax=Math.max(e.primary.time+10000,...MC.segments(e).map(s=>s.endTime));
function at(time){fraction=(time-tmin)/(tmax-tmin);updateEvent();}
at(tmin);assert(incoming.head.visible);assert(incoming.head.position.distanceTo(V(incoming.p.pos))<1e-7);assert.equal(hitMesh.count,0);assert(actors.filter(a=>a.kind==='point').every(a=>!a.object.visible));
at((tmin+e.primary.time)/2);assert(incoming.head.visible);assert(Math.abs(incoming.head.position.distanceTo(V(e.primary.pos))-1000)<1e-7);
at(e.primary.time+1e-7);assert(!incoming.head.visible);assert(incoming.head.position.distanceTo(V(e.primary.pos))<1e-7);assert(actors.filter(a=>a.kind==='point'&&a.time===e.primary.time).every(a=>a.object.visible));
at(tmin);assert(incoming.head.visible);assert.equal(hitMesh.count,0);
for(const f of [0,.5,1]){fraction=f;updateEvent();animate(100);}assert(actors.length>0);for(const a of actors.filter(a=>a.kind==='track')){assert(a.head.position.distanceTo(V(a.p.end))<1e-7);}}applyTheme();setView('earth');orbit.radius=orbit.goal;animate(100);assert(earth.visible);assert(!geology.visible);setView('det');orbit.radius=orbit.goal;animate(100);assert(!earth.visible);assert(geology.visible);assert.equal(geologyLabels.children.length,5);console.log('PASS: real Three.js scene builds, native track endpoints, all three flavors, incoming neutrino flight / arrival / rewind, Earth/Detector and theme rebuild.');`,context);
