import test from "node:test";
import assert from "node:assert/strict";
import {analyzeMed,medDiagnostics} from "../src/services/medAnalysisService.js";
import {medBox,medModel,medContactCases} from "./fixtures/medContactCases.js";

for(const c of medContactCases()) test(c.name,()=>{
    const before=structuredClone(c.model),r=analyzeMed(c.model);
    assert.deepEqual(c.model,before,"analysis never mutates inputs");
    if(c.error) {assert.ok(r.errors.some(e=>e.code===c.error),JSON.stringify(r.errors));assert.equal(r.canApply,false);}
    else {assert.deepEqual(r.errors,[]);assert.equal(r.contacts.length,c.contacts);}
});
test("both -1 pointers are replaced reciprocally",()=>{
    const r=analyzeMed(medContactCases()[0].model);
    assert.deepEqual(r.changes.map(c=>[c.block,c.face,c.proposed]),[[1,5,2],[2,4,1]]);
    assert.equal(r.counts.freeFaces,10);
});
test("wrong and one-sided pointers do not bias geometric search",()=>{
    const m=medContactCases()[0].model;m.elements[0].med[5]=[99];
    let r=analyzeMed(m);assert.equal(r.changes.find(c=>c.block===1&&c.face===5).proposed,2);
    m.elements[0].med[5]=[2];r=analyzeMed(m);
    assert.deepEqual(r.changes.map(c=>[c.block,c.face,c.proposed]),[[2,4,1]]);
});
test("original indices include nonconductors and ignore UI filtering metadata",()=>{
    const m=medModel([medBox(),medBox({rv:0}),medBox({origin:[1,0,0]})]);
    m.elements[0].num=99;m.elements[2].num=1;m.selectedRows=[2];m.filters=["hidden"];
    const r=analyzeMed(m);assert.deepEqual(r.errors,[]);
    assert.deepEqual(r.changes.map(c=>[c.block,c.proposed]),[[1,3],[3,1]]);
});
test("REAL32 resolves a small seam gap while REAL64 retains insulation",()=>{
    const m=medModel([medBox(),medBox({origin:[1+2e-7,0,0]})],{doubleFloat:false});
    assert.equal(analyzeMed(m).contacts.length,1);
    m.general.doubleFloat=true;assert.equal(analyzeMed(m).contacts.length,0);
});
test("initial motion participates and viewer time selection does not",()=>{
    const m=medModel([medBox(),medBox({origin:[2,0,0],indMove:1})]);
    m.moves=[{angle:[[0,0,0,0],[1,0,0,0]],position:[[0,-1,0,0],[1,10,0,0]]}];
    m.viewerTimeIndex=1;
    const r=analyzeMed(m);assert.deepEqual(r.errors,[]);assert.equal(r.contacts.length,1);
});
test("rotated local tangential directions may be exchanged",()=>{
    const b=medBox({dp:[9,3,2],symVi:[[90],[0],[0]],symR0:[[1],[1],[0]]});
    const r=analyzeMed(medModel([medBox({dp:[7,2,3]}),b]));
    assert.deepEqual(r.errors,[]);assert.equal(r.contacts.length,1);
});
test("symmetry self-contact uses MED=0",()=>{
    const r=analyzeMed(medModel([medBox()],{mirrorSymmetryX:0}));
    assert.deepEqual(r.changes.map(c=>[c.face,c.proposed]),[[4,0]]);
});
test("budget exhaustion blocks all application",()=>{
    const r=analyzeMed(medContactCases()[0].model,{maxImages:1});
    assert.equal(r.canApply,false);assert.ok(r.errors.some(e=>e.code==="BUDGET"));
});
test("warped bilinear contact of opposite extruded slabs is accepted",()=>{
    const a=medBox(),b=medBox({origin:[1,0,0]});
    for(const r of [a,b]) for(const p of r.geo) p[0]+=.2*p[1]*p[2];
    const r=analyzeMed(medModel([a,b]));
    assert.deepEqual(r.errors,[]);assert.equal(r.contacts.length,1);
});
test("shared edge of warped cells is not a conductive interface",()=>{
    const a=medBox(),b=medBox({origin:[1,1,0]});
    // Warp away from the common edge while retaining a separating x plane.
    a.geo[0][0]-=.2;b.geo[7][0]+=.2;
    const r=analyzeMed(medModel([a,b]));
    assert.deepEqual(r.errors,[]);assert.equal(r.contacts.length,0);
});
test("duplicate neighbors on the same face are diagnosed",()=>{
    const r=analyzeMed(medModel([medBox(),medBox({origin:[1,0,0]}),medBox({origin:[1,0,0]})]));
    assert.ok(r.errors.some(e=>e.code==="AMBIGUOUS_CONTACT"));assert.equal(r.canApply,false);
});
test("unresolved partial contact is never reported as a free face",()=>{
    const r=analyzeMed(medContactCases().find(c=>c.name==="nested-face").model);
    assert.equal(r.faces.some(f=>f.block===1&&f.face===5),false);
    assert.equal(r.faces.some(f=>f.block===2&&f.face===4),false);
});
test("local and azimuthal physical seams have representable MED=0",()=>{
    for(const symmetry of [{symLs:4,symYl:90},{symAs:4,symYa:90}]) {
        const r=analyzeMed(medModel([medBox(symmetry)]));
        assert.deepEqual(r.errors,[]);assert.equal(r.contacts.length,4);
        assert.equal(r.faces.filter(f=>f.proposed===0).length,2);
    }
});
test("read-only diagnostics retain intentional insulation as a warning",()=>{
    const r=medDiagnostics(analyzeMed(medContactCases()[0].model));
    assert.equal(r.length,2);assert.ok(r.every(d=>d.level==="warning"&&d.property==="med"));
});
