import test from "node:test";
import assert from "node:assert/strict";
import { validateElementReferences, validateRegionReferences } from "../src/services/modelReferenceValidation.js";
import { elementsValidator } from "../src/tabulator/validators/models/elements/elementsValidator.js";
import { regionsValidator } from "../src/tabulator/validators/models/regions/regionsValidator.js";

function validate(model) {
    const diagnostics=[];
    validateElementReferences(model,diagnostics);
    validateRegionReferences(model,diagnostics);
    return diagnostics;
}

test("absent and empty time tables are allowed only without their references",()=>{
    for (const table of [undefined,null,[]]) {
        const model={elements:[{targ:1,indAmp:0,indMove:0}],regions:[{indMove:0}],amps:table,moves:table};
        assert.deepEqual(validate(model),[]);
        model.elements[0].indAmp=1;model.elements[0].indMove=1;model.regions[0].indMove=1;
        const diagnostics=validate(model);
        assert.deepEqual(diagnostics.map(d=>[d.tab.id,d.row,d.property]),[
            ["elements",1,"indMove"],["elements",1,"indAmp"],["regions",1,"indMove"]]);
        assert.ok(diagnostics.every(d=>d.level==="error"&&d.message.includes("отсутствует")));
    }
});

test("references use the editable snapshot and original record numbers without mutations",()=>{
    const model={elements:[{targ:0},{targ:2,indAmp:2,indMove:2}],regions:[{indMove:2}],amps:[{},{}],moves:[{},{}]};
    const before=structuredClone(model);
    assert.deepEqual(validate(model),[]);assert.deepEqual(model,before);
    model.amps.pop();model.moves.pop();
    assert.deepEqual(validate(model).map(d=>[d.tab.id,d.row,d.property]),[
        ["elements",2,"indMove"],["elements",2,"indAmp"],["regions",1,"indMove"]]);
    model.amps.push({});model.moves.push({});
    assert.deepEqual(validate(model),[]);
});

test("all four virtual direction codes are valid without any amplitudes",()=>{
    for(let indAmp=0;indAmp<=3;indAmp++) {
        assert.deepEqual(validate({elements:[{targ:3,indAmp,indMove:0}]}),[]);
    }
    for(const indAmp of [-4,-3,-2,-1,4,-1.5,1.5,NaN,Infinity,"1",null]) {
        const [diagnostic]=validate({elements:[{targ:3,indAmp}]});
        assert.equal(diagnostic.property,"indAmp");assert.equal(diagnostic.level,"error");
        assert.match(diagnostic.message,/0 до 3/);
    }
});

test("only prescribed sources use amplitude references; virtual objects still use motion",()=>{
    for(const targ of [1,2]) assert.equal(validate({elements:[{targ,indAmp:1}]}).length,1);
    assert.deepEqual(validate({elements:[{targ:0,indAmp:1}]}),[]);
    assert.equal(validate({elements:[{targ:3,indAmp:3,indMove:1}]}).length,1);
});

test("invalid time indices and missing entries inside a table are errors",()=>{
    for(const invalid of [-1,.5,NaN,Infinity,"1",null]) {
        assert.equal(validate({elements:[{targ:2,indAmp:invalid,indMove:invalid}],regions:[{indMove:invalid}],amps:[{}],moves:[{}]}).length,3);
    }
    assert.equal(validate({elements:[{targ:1,indAmp:1,indMove:1}],amps:[null],moves:[null]}).length,2);
});

test("standard element and region validators include reference errors exactly once",()=>{
    const model={elements:[{targ:1,indAmp:1,indMove:-1},{targ:3,indAmp:4}],regions:[{indMove:2}],moves:[],amps:[]};
    const diagnostics=[],service={getModel:()=>model};
    elementsValidator(service,diagnostics);regionsValidator(service,diagnostics);
    const refs=diagnostics.filter(d=>["indAmp","indMove"].includes(d.property));
    assert.equal(refs.length,4);
    assert.ok(refs.every(d=>d.level==="error"));
});
