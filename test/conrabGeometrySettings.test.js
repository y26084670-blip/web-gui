import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { FIELD_TYPES, STORAGE_TYPES, TABS, FILES } from "../src/services/schemas/common/constants.js";
import { GEOMETRY_VALIDATION_DEFAULTS, modelGeometrySettings }
    from "../src/services/solver/geometryValidationSettings.js";
import { deserialize, serialize } from "../src/services/model/modelSerializer.js";
import { recordsToPropertyRows, propertyRowsToRecords }
    from "../src/tabulator/converters/recordColumns.js";
import { conrabValidator } from "../src/tabulator/validators/models/conrab/conrabValidator.js";

const declaration=readFileSync(new URL("../src/services/schemas/conrab.schema.js",import.meta.url),"utf8")
    .replace(/import\s+[\s\S]*?from\s+["'][^"']+["'];\s*/g,"")
    .replace("export default createSchema","createSchema");
const descriptor=runInNewContext(declaration,{
    FIELD_TYPES,STORAGE_TYPES,TABS,FILES,GEOMETRY_VALIDATION_DEFAULTS,createSchema:d=>d,
});
const schema={properties:descriptor.properties,views:descriptor.views,
    config:{storage:descriptor.storage,recordCount:descriptor.recordCount}};

test("angular setting is displayed in both configuration profiles with units and limits",()=>{
    const property=schema.properties.GEO_ANGLE;
    assert.equal(property.default,0.1);
    assert.equal(property.exclusiveMinimum,0);
    assert.equal(property.exclusiveMaximum,90);
    assert.match(property.label,/град/);
    assert.match(property.description,/15–37, 15–48, 75–68/);
    assert.doesNotMatch(property.description,/минимальный|плоскости/);
    const model=deserialize([{},{}],schema);
    const rows=recordsToPropertyRows(schema,model);
    const angle=rows.find(r=>r._property==="GEO_ANGLE");
    assert.equal(angle._record_0,0.1);
    assert.equal(angle._record_1,0.1);
    angle._record_1=0.2;
    const edited=propertyRowsToRecords(schema,rows);
    assert.equal(edited[0].GEO_ANGLE,0.1);
    assert.equal(edited[1].GEO_ANGLE,0.2);
});

test("old JSON obtains defaults and custom angles survive JSONL round-trip independently",()=>{
    const model=deserialize([{}, {GEO_ANGLE:0.25}],schema);
    assert.equal(model[0].GEO_ANGLE,0.1);
    assert.equal(model[1].GEO_ANGLE,0.25);
    model[0].GEO_ANGLE=0.05;
    const jsonl=serialize(model,schema).map(JSON.stringify).join("\n");
    assert.deepEqual(deserialize(jsonl.split("\n").map(JSON.parse),schema),model);
});

test("geometry reads exactly the profile selected by doubleFloat",()=>{
    const model={conrab:deserialize([{GEO_ANGLE:0.05},{GEO_ANGLE:0.2}],schema),general:{doubleFloat:false}};
    assert.equal(modelGeometrySettings(model).settings.GEO_ANGLE,0.05);
    model.general.doubleFloat=true;
    assert.equal(modelGeometrySettings(model).settings.GEO_ANGLE,0.2);
    assert.equal(modelGeometrySettings({conrab:[{}]}),null);
});

test("both profiles reject invalid angles without silently substituting defaults",()=>{
    for(const index of [0,1])for(const value of [0,-1,90,NaN,Infinity,"0.1",null,true,undefined]) {
        const conrab=deserialize([{},{}],schema);conrab[index].GEO_ANGLE=value;
        const messages=[];
        conrabValidator({getModel:()=>({conrab})},messages);
        assert.equal(messages.length,1);
        assert.equal(messages[0].property,"GEO_ANGLE");
        assert.equal(messages[0].row,index+1);
        const config=modelGeometrySettings({conrab,general:{doubleFloat:index===1}});
        assert.deepEqual(config.invalid,["GEO_ANGLE"]);
    }
});



test("obsolete KPY is neither loaded nor saved; GEO_ANGLE survives",()=>{
    const model=deserialize([{KPY:17,GEO_ANGLE:0.2},{KPY:"ignored",GEO_ANGLE:0.3}],schema);
    assert.equal(Object.hasOwn(schema.properties,"KPY"),false);
    for(const record of model) assert.equal(Object.hasOwn(record,"KPY"),false);
    const saved=serialize(model,schema);
    assert.deepEqual(saved.map(r=>r.GEO_ANGLE),[0.2,0.3]);
    for(const record of saved) assert.equal(Object.hasOwn(record,"KPY"),false);
});
