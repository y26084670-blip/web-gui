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

test("only the five historical pairs and two required edges are checked", () => {
    for (const scale of [1e-320,1e-150,1e-9,1,1e9,1e150]) {
        const result=validateKvVerticesDetailed(scaled(box(),scale));
        assert.equal(result.valid,true);
        assert.deepEqual(Object.keys(result.checks).sort(),[
            "edge13","edge15","parallel13And24","parallel15And26",
            "parallel15And37","parallel15And48","parallel75And68"].sort());
        assert.equal(Object.keys(result.measurements).length,7);
    }
});

const pairs = [
    ["parallel13And24",3,[0,0,1]],
    ["parallel15And26",5,[0,1,0]],
    ["parallel15And37",6,[1,0,0]],
    ["parallel15And48",7,[1,0,0]],
    ["parallel75And68",7,[0,0,1]],
];
for(const [key,index,axis] of pairs) {
    test(`${key}: angular bounds and scale invariance`,()=>{
        for(const angle of [0.05,0.1,0.100001,0.2]) {
            const v=box();v[index]=add(v[index],axis.map(x=>x*Math.tan(angle*DEG)));
            for(const scale of [1e-100,1e-6,1,1e6,1e100]) {
                const result=validateKvVerticesDetailed(scaled(v,scale));
                const metric=result.measurements[key];
                assert.ok(Math.abs(metric.value-angle)<1e-12);
                assert.equal(metric.unit,"°");
                assert.equal(result.checks[key],angle<=0.1);
            }
        }
    });
}

test("15 remains the reference when 26 differs within tolerance or collapses",()=>{
    const d=Math.tan(.08*DEG),v=box();
    v[5][1]+=d;v[6][1]-=d;
    assert.equal(validateKvVertices(v),true); // 26/37 differ by 0.16°, each differs from 15 by 0.08°
    const bad=box();bad[4][1]-=d;bad[6][1]+=d;
    assert.equal(validateKvVerticesDetailed(bad).checks.parallel15And37,false);
    const collapsed=box();collapsed[5]=[...collapsed[1]];collapsed[6][0]+=.1;
    assert.equal(validateKvVerticesDetailed(collapsed).checks.parallel15And37,false);
});

test("only 13 and 15 must not collapse to a point",()=>{
    for(const [name,index] of [["13",2],["15",4]]) {
        const v=box();v[index]=[...v[0]];
        const r=validateKvVerticesDetailed(v);
        assert.equal(r.valid,false);assert.equal(r.checks[`edge${name}`],false);
        assert.equal(r.measurements[`edge${name}`].limit,0);
    }
    const pyramid=unpackKvVertices([3,2,0,4,2,1,1],4).vertices;
    const wedge=box();wedge[6]=[...wedge[2]];wedge[7]=[...wedge[3]];
    const collapsed75And68=box([1,0,0],[0,0,1],[0,0,2]);
    collapsed75And68[6]=[...collapsed75And68[4]];collapsed75And68[7]=[...collapsed75And68[5]];
    for(const v of [pyramid,wedge,box([0,0,0]),collapsed75And68]) {
        const r=validateKvVerticesDetailed(v);assert.equal(r.valid,true);
        assert.ok(Object.values(r.measurements).every(m=>Number.isFinite(m.value)));
    }
    const r=validateKvVerticesDetailed(pyramid);
    assert.equal(r.checks.parallel13And24,true);
    assert.equal(Object.hasOwn(r.measurements,"parallel13And24"),false);
});

test("no orientation, volume or minimum independent-angle condition is added",()=>{
    const folded=box();folded[6][2]=-1;folded[7][2]=-1;
    for(const v of [box([-1,0,0]),box([1,0,0],[0,1,0],[1,0,1e-8]),
        box([1,0,0],[1,1e-8,0]),box([1,0,0],[0,1,0],[1,1,0]),folded]) {
        assert.equal(validateKvVertices(v),true);
    }
});

test("nonzero lengths have no physical or coordinate-scale minimum",()=>{
    const v=box([1,0,0],[0,1e-4,0]);
    const shifted=v.map(([x,y,z])=>[x,y+1e12,z]);
    assert.equal(validateKvVertices(shifted),true);
    assert.equal(validateKvVertices(box([1e-9,0,0])),true);
});

test("custom angular bounds come from configuration",()=>{
    const v=box();v[3][2]=Math.tan(.15*DEG);
    assert.equal(validateKvVertices(v),false);
    assert.equal(validateKvVertices(v,{GEO_ANGLE:0.2}),true);
    for(const value of [null,NaN,Infinity,0,-1,90,"0.1"])
        assert.equal(validateKvVerticesDetailed(box(),{GEO_ANGLE:value}).invalidSettings,true);
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
    assert.equal(pyramid.valid,true);
    assert.equal(Object.hasOwn(pyramid.checks,"edge26"),false);
});
