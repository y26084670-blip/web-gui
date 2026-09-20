import test, {after} from "node:test";
import assert from "node:assert/strict";
import {createServer} from "vite";
import {analyzeMed} from "../src/services/medAnalysisService.js";
import {applyMedResult,createMedRequest,medRequestIsCurrent} from "../src/services/medAutofillService.js";
import {medBox,medModel} from "./fixtures/medContactCases.js";

// Load the real application model and serializer (including existing extension-
// less imports) through its Vite module loader. No history or model mocks.
const server=await createServer({server:{middlewareMode:true},appType:"custom"});
after(()=>server.close());
const {modelService}=await server.ssrLoadModule("/src/services/modelService.js");
const {unsavedChangesService}=await server.ssrLoadModule("/src/services/unsavedChangesService.js");
const {default:schema}=await server.ssrLoadModule("/src/services/schemas/elements.schema.js");
const {serialize,deserialize}=await server.ssrLoadModule("/src/services/model/modelSerializer.js");
function setup(elements=[medBox(),medBox({origin:[1,0,0]})]) {
    modelService.clearModel();
    modelService.setModelPart({id:"general",config:{storage:"cluster"},properties:{}},medModel([]).general);
    modelService.setModelPart(schema,elements);
    unsavedChangesService.setBaseline("elements",modelService.getModel().elements);
    const taskKey={};const request=createMedRequest(modelService.getModel(),taskKey);
    return {taskKey,request,result:analyzeMed(request.snapshot),modelService,schema};
}
test("one application supports Undo/Redo and dirty tracking",()=>{
    const args=setup(),before=structuredClone(modelService.getModel().elements);
    assert.equal(applyMedResult(args),true);
    const after=structuredClone(modelService.getModel().elements);
    assert.equal(after[0].med[5][0],2);assert.equal(after[1].med[4][0],1);
    assert.equal(unsavedChangesService.hasDirty(),true);
    assert.equal(modelService.undo("elements"),true);
    assert.deepEqual(modelService.getModel().elements,before);
    assert.equal(modelService.canUndo("elements"),false);
    assert.equal(unsavedChangesService.hasDirty(),false);
    assert.equal(modelService.redo("elements"),true);
    assert.deepEqual(modelService.getModel().elements,after);
});
test("stale snapshots and different tasks cannot be applied",()=>{
    const args=setup();
    assert.equal(medRequestIsCurrent(args.request,args.request.snapshot,{}),false);
    modelService.setModelPart(schema,[...modelService.getModel().elements]);
    assert.throws(()=>applyMedResult(args),/устарел/u);
    assert.equal(modelService.canUndo("elements"),false);
});
test("geometric error causes no partial writes",()=>{
    const args=setup([medBox(),medBox({origin:[1,0,0]}),medBox({origin:[1,.5,0]})]);
    const before=modelService.getModel();
    assert.throws(()=>applyMedResult(args),/ошибки/u);
    assert.equal(modelService.getModel(),before);assert.equal(modelService.canUndo("elements"),false);
});
test("reanalysis after apply is a no-op with no new revision or history item",()=>{
    const args=setup();applyMedResult(args);
    const snapshot=modelService.getModel();
    const result=analyzeMed(snapshot);
    assert.equal(result.changes.length,0);
    assert.equal(applyMedResult({...args,request:createMedRequest(snapshot,args.taskKey),result}),false);
    assert.equal(modelService.getModel(),snapshot);
    modelService.undo("elements");assert.equal(modelService.canUndo("elements"),false);
});
test("native JSON round trip preserves flat MED and original numbering",()=>{
    const args=setup([medBox(),medBox({rv:0}),medBox({origin:[1,0,0]})]);applyMedResult(args);
    const storage=JSON.parse(JSON.stringify(serialize(modelService.getModel().elements,schema)));
    assert.deepEqual(storage[0].med,[-1,-1,-1,-1,-1,3]);
    assert.deepEqual(storage[2].med,[-1,-1,-1,-1,1,-1]);
    const reread=deserialize(storage,schema);
    assert.deepEqual(reread[0].med,modelService.getModel().elements[0].med);
    assert.equal(analyzeMed({...modelService.getModel(),elements:reread}).changes.length,0);
});
