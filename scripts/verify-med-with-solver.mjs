// Run from web-gui: npm run verify:med:solver -- /path/to/solver [julia]
// Uses a read-only solver checkout, its production weak-space functions and
// the existing test fixture; no numerical solver implementation is copied.
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {createServer} from "vite";
import {analyzeMed} from "../src/services/medAnalysisService.js";
import {medContactCases,medModel,medBox} from "../test/fixtures/medContactCases.js";

const [solverRoot,julia="julia"]=process.argv.slice(2);
if(!solverRoot) throw new Error("Usage: npm run verify:med:solver -- <solver-root> [julia]");
const server=await createServer({server:{middlewareMode:true},appType:"custom"});
let schema,serialize,deserialize;
try {
    ({default:schema}=await server.ssrLoadModule("/src/services/schemas/elements.schema.js"));
    ({serialize,deserialize}=await server.ssrLoadModule("/src/services/model/modelSerializer.js"));
} finally {await server.close();}
const directory=await mkdtemp(join(tmpdir(),"med-solver-"));
// Julia input is emitted only from these checked, generated numerical fixtures.
const literal=value=>value===null ? "nothing" : typeof value==="string"
    ? JSON.stringify(value).replaceAll("$","\\$") : Array.isArray(value)
    ? `[${value.map(literal).join(",")}]` : typeof value==="object"
    ? `Dict(${Object.entries(value).map(([k,v])=>`${literal(k)}=>${literal(v)}`).join(",")})` : String(value);
const cases=[];
const candidates=medContactCases().filter(c=>!c.error);
candidates.push({name:"original-index",model:medModel([medBox(),medBox({rv:0}),medBox({origin:[1,0,0]})]),contacts:1});
candidates.push({name:"rotated-grid",model:medModel([medBox({dp:[2,2,3]}),medBox({dp:[3,3,2],symVi:[[90],[0],[0]],symR0:[[1],[1],[0]]})]),contacts:1});
for(const symmetry of [{symLs:4,symYl:90},{symAs:4,symYa:90}]) {
    candidates.push({name:symmetry.symLs?"local-seams":"axial-seams",model:medModel([medBox(symmetry)]),contacts:4});
}
const warped=[medBox(),medBox({origin:[1,0,0]})];
for(const row of warped) for(const p of row.geo) p[0]+=.2*p[1]*p[2];
candidates.push({name:"warped-contact",model:medModel(warped),contacts:1});
const moving=medModel([medBox(),medBox({origin:[2,0,0],indMove:1})]);
moving.moves=[{angle:[[0,0,0,0],[1,0,0,0]],position:[[0,-1,0,0],[1,10,0,0]]}];
candidates.push({name:"initial-motion",model:moving,contacts:1});
for(const doubleFloat of [false,true]) for(const c of candidates) {
    const model=structuredClone(c.model);model.general.doubleFloat=doubleFloat;
    const result=analyzeMed(model);assert.deepEqual(result.errors,[],c.name);
    const updated=model.elements.map((row,i)=>({...row,med:result.faces.filter(f=>f.block===i+1).length
        ? result.faces.filter(f=>f.block===i+1).sort((a,b)=>a.face-b.face).map(f=>[f.proposed]) : row.med}));
    const path=join(directory,`${c.name}-${doubleFloat?64:32}-kvs.txt`);
    await writeFile(path,JSON.stringify(serialize(updated,schema)));
    const storage=JSON.parse(await readFile(path,"utf8"));
    assert.deepEqual(deserialize(storage,schema).map(r=>r.med),updated.map(r=>r.med));
    cases.push({name:c.name,doubleFloat,general:model.general,kvs:storage,moves:model.moves,contacts:c.contacts});
}
const dataPath=join(directory,"cases.jl");
await writeFile(dataPath,`const MED_CASES = ${literal(cases)}\n`);
console.log(`Control JSON: ${directory}`);
const script=fileURLToPath(new URL("verify-med-with-solver.jl",import.meta.url));
const run=spawnSync(julia,["--startup-file=no",script,resolve(solverRoot),dataPath],{stdio:"inherit"});
if(run.error) throw run.error;
process.exitCode=run.status ?? 1;
