import test from "node:test";
import assert from "node:assert/strict";
import { unpackKvVertices, validateKvVertices, validateKvVerticesDetailed }
    from "../src/services/solver/geometryKv.js";

const DEG = Math.PI / 180;
const add = (a,b) => a.map((x,i)=>x+b[i]);
function box(a=[1,0,0], b=[0,1,0], c=[0,0,1]) {
    return [[0,0,0],a,b,add(a,b),c,add(a,c),add(b,c),add(add(a,b),c)];
}
const scaled = (v,k) => v.map(row=>row.map(x=>x*k));
const failures = r => Object.keys(r.checks).filter(k=>!r.checks[k]);

test("angular validation accepts a rectangular element in all resolvable scales", () => {
    for (const scale of [1e-150,1e-9,1,1e9,1e150]) {
        const result=validateKvVerticesDetailed(scaled(box(),scale));
        assert.equal(result.valid,true);
        assert.equal(Object.keys(result.measurements).length,16);
        assert.equal(result.measurements.outOfPlane15.value,90);
        assert.equal(result.measurements.basis12And24.value,90);
    }
});

test("thin orthogonal elements retain a right angle", () => {
    for(const a of [[1e-9,0,0],[1e9,0,0]]) {
        const result=validateKvVerticesDetailed(box(a));
        assert.equal(result.valid,true);
        assert.equal(result.measurements.outOfPlane15.value,90);
    }
});

const pairs = [
    ["parallel13And24", d=>{const v=box();v[3]=[1,1,d];return v;}],
    ["parallel57And68", d=>[
        [0,0,-1],[1,0,-1],[0,1,-1],[1,1,-1],
        [0,0,0],[1,0,0],[0,1,0],[1,1,d]]],
    ["parallel15And26", d=>{const v=box();v[4]=[0,d,1];return v;}],
    ["parallel37And26", d=>[
        [0,-1,0],[1,-1,0],[0,0,0],[1,d,0],
        [0,-1,1],[1,-1,1],[0,d,1],[1,d,1]]],
    ["parallel48And26", d=>[
        [0,-1,0],[1,-1,0],[0,d,0],[1,0,0],
        [0,-1,1],[1,-1,1],[0,d,1],[1,d,1]]],
];
for(const [key,make] of pairs) {
    test(`${key}: degrees, inclusive boundary and scale invariance`,()=>{
        for(const angle of [0.05,0.1,0.100001,0.2]) {
            const source=make(Math.tan(angle*DEG));
            for(const scale of [1e-100,1e-6,1,1e6,1e100]) {
                const result=validateKvVerticesDetailed(scaled(source,scale));
                const metric=result.measurements[key];
                assert.ok(Math.abs(metric.value-angle)<1e-12);
                assert.equal(metric.unit,"°");
                assert.equal(metric.limit,0.1);
                assert.equal(result.checks[key],angle<=0.1);
                assert.deepEqual(failures(result),failures(validateKvVerticesDetailed(source)));
            }
        }
    });
}

test("parallel and antiparallel directions have the same angular deviation",()=>{
    const v=box();v[3]=[1,-1,0];
    assert.equal(validateKvVerticesDetailed(v).checks.parallel13And24,true);
});

test("signed plane angle separates orientation and near-degeneracy",()=>{
    for(const beta of [-90,-0.1,0,0.05,0.1,0.100001,45,90]) {
        const v=box([1,0,0],[0,1,0],[Math.cos(beta*DEG),0,Math.sin(beta*DEG)]);
        const result=validateKvVerticesDetailed(v);
        assert.ok(Math.abs(result.measurements.outOfPlane15.value-beta)<1e-12);
        assert.equal(result.checks.outOfPlane15,beta>=0.1);
    }
});

test("the supporting plane must have independent directions",()=>{
    for(const alpha of [0,0.05,0.1,0.2]) {
        const result=validateKvVerticesDetailed(box([1,0,0],[Math.cos(alpha*DEG),Math.sin(alpha*DEG),0]));
        assert.equal(result.checks.basis12And24,alpha>=0.1);
        assert.equal(Object.hasOwn(result.measurements,"outOfPlane15"),alpha>=0.1);
    }
});

test("custom angular bounds come from configuration",()=>{
    const v=pairs[0][1](Math.tan(0.15*DEG));
    assert.equal(validateKvVertices(v),false);
    assert.equal(validateKvVertices(v,{GEO_ANGLE:0.2}),true);
    for(const value of [null,NaN,Infinity,0,-1,90,"0.1"]) {
        const r=validateKvVerticesDetailed(box(),{GEO_ANGLE:value});
        assert.equal(r.invalidSettings,true);
        assert.equal(r.valid,false);
    }
});

test("every normalized edge is checked before computing angles",()=>{
    for(const [name,i,j] of [["12",0,1],["13",0,2],["24",1,3],["57",4,6],
        ["68",5,7],["15",0,4],["26",1,5],["37",2,6],["48",3,7]]) {
        const v=box();v[j]=[...v[i]];
        const result=validateKvVerticesDetailed(v);
        assert.equal(result.checks[`edge${name}`],false);
        assert.equal(result.valid,false);
        assert.ok(Object.values(result.measurements).every(m=>Number.isFinite(m.value)));
    }
});

test("coordinate resolution is checked without a fixed physical size floor",()=>{
    const tiny=box([1e-4,0,0]);
    assert.equal(validateKvVertices(tiny),true);
    const shifted=tiny.map(([x,y,z])=>[x+1e12,y,z]);
    assert.equal(validateKvVerticesDetailed(shifted).checks.edge12,false);
    assert.equal(validateKvVerticesDetailed(shifted).checks.edge13,true);
});

test("malformed coordinates and configuration do not enter normalization",()=>{
    const bad=box();bad[0][0]=Infinity;
    for(const v of [[],new Array(8),bad,box().map(r=>[...r,0])]) {
        const result=validateKvVerticesDetailed(v);
        assert.equal(result.malformed,true);
        assert.equal(result.valid,false);
    }
    assert.equal(validateKvVerticesDetailed(box(),null).invalidSettings,true);
});

test("reported legacy Float32 geometry is accepted by the default angle",()=>{
    const v=[
        [13,0,24.500778198242188],[13,-2.5132100582122803,24.37150001525879],
        [13,0,27.500699996948242],[13,-2.5132100582122803,27.386499404907227],
        [10,0,24.500699996948242],[10,-2.5132100582122803,24.37150001525879],
        [10,0,27.500699996948242],[10,-2.5132100582122803,27.386499404907227],
    ];
    assert.equal(validateKvVertices(v),true);
});

test("KV unpack keeps solver error flags while constructing vertices", () => {
    const cases = [
        { geoType: 2, valid: [2, 3, 4], invalid: [0, 3, 4] },
        { geoType: 3, valid: [2, 3, 4, 2, 3], invalid: [0, 3, 4, 2, 3] },
        { geoType: 4, valid: [3, 2, 0, 4, 2, 1, 1], invalid: [0, 2, 0, 4, 2, 1, 1] },
    ];

    for (const { geoType, valid, invalid } of cases) {
        const validResult = unpackKvVertices(valid, geoType);
        const invalidResult = unpackKvVertices(invalid, geoType);

        assert.equal(validResult.err, 0, `valid geoType ${geoType}`);
        assert.equal(invalidResult.err, 1, `invalid geoType ${geoType}`);
        assert.equal(validResult.vertices.length, 8);
        assert.equal(invalidResult.vertices.length, 8);
    }
});


test("all supported geometry types are checked after unpack",()=>{
    for(const [type,parameters] of [
        [0,box().flat()],[1,[0,1,1,1,1,2,0,2,30]],
        [2,[2,3,4]],[3,[2,3,4,2,3]],
    ]) assert.equal(validateKvVertices(unpackKvVertices(parameters,type).vertices),true);
    const pyramid=validateKvVerticesDetailed(unpackKvVertices([3,2,0,4,2,1,1],4).vertices);
    assert.equal(pyramid.valid,false);
    assert.equal(pyramid.checks.edge26,false);
});
