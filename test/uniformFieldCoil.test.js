import test,{after} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "vite";
import {createUniformFieldCoilDefaults,uniformFieldCoilOrientation,coilAxialFactor,uniformFieldCoilParameters,prepareUniformFieldCoil,applyUniformFieldCoil} from "../src/services/generator/uniformFieldCoil.js";
import {unpackKvVertices,validateKvVertices} from "../src/services/solver/geometryKv.js";
import {expandElementSymmetry} from "../src/services/solver/symmetryExpansion.js";
import {applyMatrix4ToPoint} from "../src/services/solver/rotation3d.js";
import {mhjLayout} from "../src/services/solver/mhjLayout.js";

const server=await createServer({configFile:false,server:{middlewareMode:true},appType:"custom"});
after(()=>server.close());
const {modelService}=await server.ssrLoadModule("/src/services/modelService.js");
const {unsavedChangesService}=await server.ssrLoadModule("/src/services/unsavedChangesService.js");
const {default:elementSchema}=await server.ssrLoadModule("/src/services/schemas/elements.schema.js");
const {default:mhjSchema}=await server.ssrLoadModule("/src/services/schemas/mhj.schema.js");
const {dataService}=await server.ssrLoadModule("/src/services/dataService.js");
const {serialize,deserialize}=await server.ssrLoadModule("/src/services/model/modelSerializer.js");
const {recomputeModel}=await server.ssrLoadModule("/src/services/model/modelCompute.js");
const {elementsValidator}=await server.ssrLoadModule("/src/tabulator/validators/models/elements/elementsValidator.js");
const {mhjValidator}=await server.ssrLoadModule("/src/tabulator/validators/models/mhj/mhjValidator.js");
const params={H0:2,radius:10,length:420,direction:[2,3,4],amplitude:0,move:0};
const general={mirrorSymmetryX:-1,mirrorSymmetryY:-1};
const empty=()=>({general:{...general},elements:[],mhj:null,amps:[],moves:[]});
const createElement=()=>dataService.createDefaultRecord(elementSchema);
function close(actual,expected,tolerance=1e-11){assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);}
function setup(model=empty()) {
  modelService.clearModel();
  for(const [id,data] of Object.entries(model))modelService.setModelPart(
    id==="elements"?elementSchema:id==="mhj"?mhjSchema:{id,config:{storage:Array.isArray(data)?"records":"cluster"},properties:{}},data);
  for(const id of ["elements","mhj"])unsavedChangesService.setBaseline(id,modelService.getModel()[id]);
  return {modelService,params,elementSchema,mhjSchema,createElement};
}

// Integrate the finite current-sheet expression with Simpson's rule.
function numericalAxialFactor(z,r1,r2,L) {
  const n=2000,h=(r2-r1)/n,a=L/2;
  const f=r=>((z+a)/Math.hypot(r,z+a)-(z-a)/Math.hypot(r,z-a))/2;
  let sum=f(r1)+f(r2);
  for(let i=1;i<n;i++)sum+=(i%2?4:2)*f(r1+i*h);
  return sum*h/3;
}

test("finite winding analytics agree with independent numerical radial integration",()=>{
  for(const [r1,r2,L] of [[11,21,8],[11,21,20],[11,21,420],[2,12,30],[100,110,2200]])for(const z of [0,10,L/2,L]) {
    close(coilAxialFactor(z,r1,r2,L),numericalAxialFactor(z,r1,r2,L));
    close(coilAxialFactor(-z,r1,r2,L),coilAxialFactor(z,r1,r2,L));
  }
});

test("entered length controls geometry and current; R does not overwrite L and error compares H(R) with H(0)",()=>{
  for(const length of [8,20,80,420,900])for(const radius of [10,25]) {
    const r=prepareUniformFieldCoil(empty(),{...params,length,radius},createElement),p=r.values;
    assert.equal(p.length,length);
    const {vertices,err}=unpackKvVertices(r.elements[0].geo.flat(),1);
    assert.equal(err,0);assert.equal(validateKvVertices(vertices),true);
    assert.equal(Math.min(...vertices.map(v=>v[0])),-length/2);
    assert.equal(Math.max(...vertices.map(v=>v[0])),length/2);
    const k0=numericalAxialFactor(0,p.r1,p.r2,length),kR=numericalAxialFactor(radius,p.r1,p.r2,length);
    close(p.j0,params.H0/k0);close(p.field0,params.H0);close(p.fieldR,p.j0*kR);
    close(p.relativeDeviation,100*(kR/k0-1));close(p.nonuniformity,Math.abs(p.relativeDeviation));
    assert.ok(r.mhj[0].v.every(v=>v[0]===0&&v[1]===-p.j0&&v[2]===0));
  }
  const short=uniformFieldCoilParameters({...params,length:80},empty());
  const long=uniformFieldCoilParameters({...params,length:420},empty());
  assert.ok(short.j0>long.j0);assert.ok(short.nonuniformity>long.nonuniformity);
});

test("missing, empty, nonpositive and nonfinite lengths cannot create geometry or source history",()=>{
  for(const length of [undefined,null,"",0,-1,NaN,Infinity,-Infinity,"invalid"]) {
    const args=setup(),before=modelService.getModel();
    assert.throws(()=>applyUniformFieldCoil({...args,params:{...params,length}}),error=>error.level==="ERROR"&&/Длина L/.test(error.message));
    assert.equal(modelService.getModel(),before);assert.equal(modelService.canUndo("elements"),false);
    assert.equal(modelService.canUndo("mhj"),false);assert.equal(unsavedChangesService.hasDirty(),false);
  }
});

test("current corrects the finite coil field at 0; relative error is H(R) versus H(0)",()=>{
  const p=uniformFieldCoilParameters(params,empty());
  assert.equal(p.r1,11);assert.equal(p.r2,21);assert.equal(p.length,420);
  assert.ok(p.j0>params.H0/10);close(p.field0,params.H0);
  close(p.relativeDeviation,(p.fieldR-p.field0)/p.field0*100);
  assert.ok(p.relativeDeviation<0);assert.equal(p.nonuniformity,-p.relativeDeviation);
  const zero=uniformFieldCoilParameters({...params,H0:0},empty());
  assert.equal(zero.field0,0);assert.equal(zero.fieldR,0);assert.equal(zero.nonuniformity,null);
});

test("default coil has 18 contiguous valid sectors and the prescribed current circulates around the requested axis",()=>{
  for(const direction of [[1,0,0],[-1,0,0],[0,0,1],[2,3,4]]) {
    const r=prepareUniformFieldCoil(empty(),{...params,direction},createElement),e=r.elements[0];
    assert.equal(e.geo.length,8);assert.ok(e.geo.every(row=>row.length===3));
    const geometry=unpackKvVertices(e.geo.flat(),e.geoType);
    assert.equal(geometry.err,0);assert.equal(validateKvVertices(geometry.vertices),true);
    const instances=expandElementSymmetry(e,general);assert.equal(instances.length,18);
    assert.equal(e.auto,true);assert.equal(mhjLayout(r.elements).rows,18);
    const radius=(r.values.r1+r.values.r2)/2,axis=r.values.axis;
    for(const instance of instances) {
      const point=applyMatrix4ToPoint(instance.matrix,[0,0,radius]);
      const current=applyMatrix4ToPoint(instance.matrix,r.mhj[0].v[instance.ls]);
      close(point.reduce((sum,x,i)=>sum+x*axis[i],0),0);
      const cross=[point[1]*current[2]-point[2]*current[1],point[2]*current[0]-point[0]*current[2],point[0]*current[1]-point[1]*current[0]];
      cross.forEach((x,i)=>close(x,axis[i]*radius*r.values.j0));
    }
    const first=geometry.vertices.map(v=>applyMatrix4ToPoint(instances[0].matrix,v));
    const last=geometry.vertices.map(v=>applyMatrix4ToPoint(instances.at(-1).matrix,v));
    assert.equal(first.filter(a=>last.some(b=>Math.hypot(...a.map((v,i)=>v-b[i]))<1e-10)).length,4);
  }
});

test("native schema round trip preserves winding geometry, amplitude, motion and MHJ order",()=>{
  const model=empty();model.amps=[{}];model.moves=[{}];
  const r=prepareUniformFieldCoil(model,{...params,amplitude:1,move:1},createElement);
  const stored=JSON.parse(JSON.stringify(serialize(r.elements,elementSchema)));
  assert.equal(stored[0].geo.length,24);assert.equal(stored[0].sym.ls,18);
  assert.equal(stored[0].indAmp,1);assert.equal(stored[0].indMove,1);assert.ok(!("indMov" in stored[0]));
  assert.deepEqual(recomputeModel(elementSchema,deserialize(stored,elementSchema)).model,recomputeModel(elementSchema,r.elements).model);
  assert.deepEqual(deserialize(JSON.parse(JSON.stringify(serialize(r.mhj,mhjSchema))),mhjSchema),r.mhj);
  const service={getModel:()=>({...model,elements:r.elements,mhj:r.mhj})},messages=[];
  elementsValidator(service,messages);mhjValidator(service,messages);
  assert.deepEqual(messages.filter(d=>d.level==="error"),[]);
});

test("coil inserts before virtual elements without altering earlier sources or records",()=>{
  const source={...createElement(),name:"previous",targ:1};
  const virtual={...createElement(),name:"virtual",targ:3};
  const model={...empty(),elements:[source,virtual],mhj:[{v:[[3,4,5]]}]},before=structuredClone(model);
  const r=prepareUniformFieldCoil(model,params,createElement);
  assert.equal(r.recordIndex,1);assert.equal(r.elements[0],source);assert.equal(r.elements[2],virtual);
  assert.deepEqual(r.mhj[0].v[0],[3,4,5]);assert.equal(r.mhj[0].v.length,19);
  assert.deepEqual(model,before);
});

test("atomic addition and Undo/Redo from either participating tab preserve dirty state",()=>{
  const args=setup(),before=structuredClone(modelService.getModel());applyUniformFieldCoil(args);
  const result=structuredClone(modelService.getModel());
  assert.equal(unsavedChangesService.isDirty("elements"),true);assert.equal(unsavedChangesService.isDirty("mhj"),true);
  assert.equal(modelService.undo("mhj"),true);assert.deepEqual(modelService.getModel(),before);
  assert.equal(unsavedChangesService.hasDirty(),false);
  assert.equal(modelService.redo("elements"),true);assert.deepEqual(modelService.getModel(),result);
  modelService.setModelPart(mhjSchema,[{v:result.mhj[0].v.map(v=>v.map(x=>2*x))}],{recordHistory:true});
  assert.equal(modelService.undo("elements"),false);
  assert.equal(modelService.undo("mhj"),true);assert.equal(modelService.undo("elements"),true);
  assert.deepEqual(modelService.getModel(),before);
});

test("mirror symmetry, locked structure and invalid references fail before publishing or recording",()=>{
  for(const change of [
    ...["mirrorSymmetryX","mirrorSymmetryY"].flatMap(key=>[0,1].map(value=>({general:{...general,[key]:value}}))),
    {jweakLocal:{status:"ready"}},
  ]) {
    const args=setup({...empty(),...change}),before=modelService.getModel();
    assert.throws(()=>applyUniformFieldCoil(args),error=>error.level==="ERROR");
    assert.equal(modelService.getModel(),before);assert.equal(modelService.canUndo("elements"),false);
    assert.equal(modelService.canUndo("mhj"),false);assert.equal(unsavedChangesService.hasDirty(),false);
  }
  for(const change of [{amplitude:1},{move:-1},{radius:0},{direction:[0,0,0]},{H0:NaN}])
    assert.throws(()=>prepareUniformFieldCoil(empty(),{...params,...change},createElement));
  assert.throws(()=>prepareUniformFieldCoil({...empty(),mhj:[{v:[[1,2,3]]}]},params,createElement),/MHJ/);
});

test("failure preparing another model part leaves all data and history untouched",()=>{
  setup();const before=modelService.getModel();
  assert.throws(()=>modelService.setModelParts([{schema:elementSchema,data:[]},{schema:{...elementSchema,id:"broken"},data:{}}],{recordHistory:true}));
  assert.equal(modelService.getModel(),before);assert.equal(modelService.canUndo("elements"),false);
});


test("new coil defaults use L=100, dvi=20 and a Russian name without shared arrays",()=>{
  const p=createUniformFieldCoilDefaults(),second=createUniformFieldCoilDefaults();
  assert.equal(p.length,100);assert.equal(p.opening,20);assert.equal(p.name,"Катушка однородного поля");
  p.direction[0]=3;assert.deepEqual(second.direction,[1,0,0]);
  const result=prepareUniformFieldCoil(empty(),second,createElement);
  assert.equal(result.elements[0].name,"Катушка однородного поля");
});

test("displayed symVi angles reproduce arbitrary axis directions, including poles and large magnitudes",()=>{
  for(const direction of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[2,3,4],[-2,-3,4],[1e308,1e308,1e308],[1e-300,-2e-300,3e-300]]) {
    const orientation=uniformFieldCoilOrientation(direction);
    const result=prepareUniformFieldCoil(empty(),{...params,direction},createElement),record=result.elements[0];
    assert.deepEqual(record.symVi.flat(),orientation.angles);
    const [,b,c]=orientation.angles.map(v=>v*Math.PI/180);
    const rotated=[Math.cos(b)*Math.cos(c),Math.cos(b)*Math.sin(c),-Math.sin(b)];
    rotated.forEach((v,i)=>close(v,orientation.axis[i]));
    assert.ok(orientation.angles.every(v=>Number.isFinite(v)&&!Object.is(v,-0)));
  }
  assert.deepEqual(uniformFieldCoilOrientation([0,0,1]).angles,[0,-90,0]);
  assert.deepEqual(uniformFieldCoilOrientation([0,0,-1]).angles,[0,90,0]);
  for(const direction of [[0,0,0],[1,NaN,0],[1,Infinity,0],[1,2],[],null])assert.throws(()=>uniformFieldCoilOrientation(direction));
});

test("sector opening determines contiguous local copies, valid geometry and matching source rows",()=>{
  for(const opening of [20,10,30,17,5,2.5,11.3,90,120]) {
    const result=prepareUniformFieldCoil(empty(),{...params,opening},createElement),record=result.elements[0],n=Math.floor(360/opening);
    assert.equal(record.symLs,n);assert.equal(record.symYl,opening);
    assert.equal(result.values.coveredAngle,n*opening);
    assert.ok(result.values.coveredAngle<=360);
    assert.ok(360-result.values.coveredAngle<opening+1e-10);
    assert.equal(record.geo.flat()[8],record.symYl);
    const {vertices,err}=unpackKvVertices(record.geo.flat(),1);
    assert.equal(err,0);assert.equal(validateKvVertices(vertices),true);
    assert.equal(mhjLayout(result.elements).rows,n);assert.equal(result.mhj[0].v.length,n);
    assert.ok(result.mhj[0].v.every(v=>v[0]===0&&v[1]===-result.values.j0&&v[2]===0));
    const roundtrip=deserialize(serialize(result.elements,elementSchema),elementSchema)[0];
    assert.equal(roundtrip.symLs,n);assert.deepEqual(roundtrip.symVi,record.symVi);
    assert.deepEqual(roundtrip.geo,record.geo);
    close(result.values.j0,uniformFieldCoilParameters(params,empty()).j0);
  }
});

test("invalid openings are rejected atomically without altering model, sources or undo history",()=>{
  for(const opening of [null,"",0,-1,360.01,361,NaN,Infinity,-Infinity,1e-200,360/2147483648]) {
    const args=setup(),before=modelService.getModel();
    assert.throws(()=>applyUniformFieldCoil({...args,params:{...params,opening}}),/Раскрытие/);
    assert.equal(modelService.getModel(),before);assert.equal(modelService.canUndo("elements"),false);
    assert.equal(modelService.canUndo("mhj"),false);assert.equal(unsavedChangesService.hasDirty(),false);
  }
});


test("dvi is the unchanged base-sector and local-symmetry angle with truncated image count",()=>{
  for(const [opening,n] of [[20,18],[10,36],[30,12],[17,21],[11.3,31]]) {
    const r=prepareUniformFieldCoil(empty(),{...params,opening},createElement),e=r.elements[0];
    assert.equal(e.geo.flat()[8],opening);assert.equal(e.symYl,opening);assert.equal(e.symLs,n);
    assert.equal(r.mhj[0].v.length,n);assert.equal(r.values.coveredAngle,n*opening);
    const stored=serialize(r.elements,elementSchema)[0];
    assert.equal(stored.geo[8],opening);assert.equal(stored.sym.yl,opening);assert.equal(stored.sym.ls,n);
  }
  const r=prepareUniformFieldCoil(empty(),{...params,opening:17},createElement);
  assert.equal(r.values.coveredAngle,357);assert.equal(360-r.values.coveredAngle,3);
});

test("new coil fills precisely its MHJ range after discretized existing sources",()=>{
  const magnet={...createElement(),name:"magnet",targ:1,dp:[[2],[3],[1]],symLs:2};
  const oldCoil={...createElement(),name:"existing coil",targ:2,dp:[[1],[2],[1]],symLs:3};
  const virtual={...createElement(),name:"virtual",targ:3};
  const elements=[magnet,oldCoil,virtual],count=mhjLayout(elements).rows;
  assert.equal(count,18);
  const previous=Array.from({length:count},(_,i)=>[i+1,100+i,-i]);
  const model={...empty(),elements,mhj:[{v:previous}]},snapshot=structuredClone(model);
  for(const [opening,n] of [[20,18],[10,36],[30,12],[17,21]]) {
    const r=prepareUniformFieldCoil(model,{...params,opening},createElement);
    const layout=mhjLayout(r.elements),range=layout.items.find(item=>item.kvIndex===r.recordIndex);
    assert.equal(r.recordIndex,2);assert.equal(r.elements[3],virtual);
    assert.equal(range.start,count);assert.equal(range.count,n);assert.equal(layout.rows,count+n);
    assert.deepEqual(r.mhj[0].v.slice(0,count),previous);
    assert.ok(r.mhj[0].v.slice(count).every(v=>v[0]===0&&v[1]===-r.values.j0&&v[2]===0));
    assert.deepEqual(model,snapshot);
  }
});

test("changing dvi between additions preserves old coil rows and grouped Undo/Redo",()=>{
  const args=setup();applyUniformFieldCoil({...args,params:{...params,opening:20}});
  const first=structuredClone(modelService.getModel());assert.equal(first.mhj[0].v.length,18);
  const second=applyUniformFieldCoil({...args,params:{...params,H0:3,opening:10}});
  const both=structuredClone(modelService.getModel());
  assert.equal(both.elements[1].symLs,36);assert.equal(both.mhj[0].v.length,54);
  assert.deepEqual(both.mhj[0].v.slice(0,18),first.mhj[0].v);
  assert.ok(both.mhj[0].v.slice(18).every(v=>v[0]===0&&v[1]===-second.values.j0&&v[2]===0));
  assert.equal(modelService.undo("mhj"),true);assert.deepEqual(modelService.getModel(),first);
  assert.equal(modelService.redo("elements"),true);assert.deepEqual(modelService.getModel(),both);
});
