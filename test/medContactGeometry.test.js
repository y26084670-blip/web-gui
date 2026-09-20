import test from "node:test";
import assert from "node:assert/strict";
import {medBox} from "./fixtures/medContactCases.js";
import {physicalHex,vertexPermutation,faceOverlapArea,matchingGrids,volumesOverlap,medTolerance} from "../src/services/solver/medContactGeometry.js";

test("bijection handles reversed order and rejects a repeated nearest vertex",()=>{
    const p=[[0,0,0],[1,0,0],[1,1,0],[0,1,0]];
    assert.deepEqual(vertexPermutation(p,[...p].reverse(),1e-12),[3,2,1,0]);
    assert.equal(vertexPermutation(p,[p[0],p[0],p[2],p[3]],1e-12),null);
});
test("polygon clipping detects interior overlap without common vertices",()=>{
    const a=physicalHex(medBox().geo,1e-12).faces[5];
    const b=physicalHex(medBox({origin:[1,.25,.25],size:[1,.5,.5]}).geo,1e-12).faces[4];
    assert.equal(faceOverlapArea(a,b,1e-12),.25);
});
test("edge and vertex intersection has zero volume and zero interface area",()=>{
    const a=physicalHex(medBox().geo,1e-12);
    for(const origin of [[1,1,0],[1,1,1]]) {
        const b=physicalHex(medBox({origin}).geo,1e-12);
        assert.equal(volumesOverlap(a,b,1e-12),false);
        assert.equal(faceOverlapArea(a.faces[5],b.faces[4],1e-12),0);
    }
});
test("face grid compares tangential directions but not normal subdivisions",()=>{
    const a=physicalHex(medBox().geo,1e-12).faces[5];
    const b=physicalHex(medBox({origin:[1,0,0]}).geo,1e-12).faces[4];
    assert.equal(matchingGrids(a,[7,2,3],b,[9,2,3],1e-12),true);
    assert.equal(matchingGrids(a,[7,2,3],b,[9,3,2],1e-12),false);
});
test("REAL tolerance follows the input precision and coordinate scale",()=>{
    assert.equal(medTolerance(10,false),160*2**-23);
    assert.equal(medTolerance(10,true),1280*Number.EPSILON);
    assert.ok(medTolerance(0,true)>0);
});
