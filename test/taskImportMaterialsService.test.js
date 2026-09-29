import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { collectUsedFmmNames, importUsedTaskMaterials, importUsedFmmMaterials } from "../src/services/taskImportMaterialsService.js";
import { buildXapRecord, concatenateBuffers } from "./fixtures/materialImportFixtures.js";
function notFound(name) {
    const error = new Error(`Не найдено: ${name}`);
    error.name = "NotFoundError";
    return error;
}

class MemoryFileHandle {
    constructor(bytes = new Uint8Array(), { failWrite = false } = {}) {
        this.kind = "file";
        this.bytes = new Uint8Array(bytes);
        this.writeCount = 0;
        this.failWrite = failWrite;
    }

    async getFile() {
        const bytes = new Uint8Array(this.bytes);
        return {
            async text() { return new TextDecoder().decode(bytes); },
            async arrayBuffer() {
                return bytes.buffer.slice(
                    bytes.byteOffset,
                    bytes.byteOffset + bytes.byteLength,
                );
            },
        };
    }

    async createWritable() {
        const handle = this;
        let nextBytes = null;
        return {
            async write(bytes) {
                if (handle.failWrite) {
                    throw new Error("имитация сбоя записи");
                }
                nextBytes = new Uint8Array(bytes);
            },
            async close() {
                handle.bytes = nextBytes ?? new Uint8Array();
                handle.writeCount += 1;
            },
            async abort() {
                nextBytes = null;
            },
        };
    }
}

class MemoryDirectoryHandle {
    constructor() {
        this.kind = "directory";
        this.directories = new Map();
        this.files = new Map();
    }

    async getDirectoryHandle(name, { create = false } = {}) {
        if (!this.directories.has(name)) {
            if (!create) throw notFound(name);
            this.directories.set(name, new MemoryDirectoryHandle());
        }
        return this.directories.get(name);
    }

    async getFileHandle(name, { create = false } = {}) {
        if (!this.files.has(name)) {
            if (!create) throw notFound(name);
            this.files.set(name, new MemoryFileHandle());
        }
        return this.files.get(name);
    }

    async *entries() {
        for (const entry of this.directories) yield entry;
        for (const entry of this.files) yield entry;
    }

    async removeEntry(name) {
        if (!this.files.delete(name) && !this.directories.delete(name)) {
            throw notFound(name);
        }
    }
}


const bytes = text => new TextEncoder().encode(text);
const enabled = path => ({path, enabled:true});
async function fixture({name="Task", kvs=[{model:0,xapName:"Steel"}], library=buildXapRecord({name:"Steel"}), root=new MemoryDirectoryHandle()}={}) {
  const project=await root.getDirectoryHandle("Project",{create:true});
  const task=await project.getDirectoryHandle(name,{create:true});
  const input=await task.getDirectoryHandle("input3XX",{create:true});
  input.files.set("kvs.txt",new MemoryFileHandle(bytes("\ufeff"+kvs.map(x=>JSON.stringify(x)).join("\r\n"))));
  input.files.set("_nogo.e3d",new MemoryFileHandle());
  if(library!==null)task.files.set("xap.lib",new MemoryFileHandle(library));
  return {root,task,input,path:"Project/"+name};
}
const run=(f,options={})=>importUsedTaskMaterials(f.root,[enabled(f.path)],{notifyChanged:()=>{},...options});

test("уникальные имена ФММ; регистр/пробелы/NFC, все назначения, без ВТСП",()=>{
 assert.deepEqual(collectUsedFmmNames([
  {model:0,xapName:" Steel ",targ:1},{model:1,xapName:"steel",take:false},
  {model:1,xapName:"Другое"},{model:2,xapName:"HTS"},{model:0,xapName:""},
  {model:0,xapName:"Ё"},{model:1,xapName:"Е\u0308"}
 ]),["Steel","Другое","Ё"]);
});

test("только используемые, перезапись, сохранение посторонних, JSON и повтор без изменений",async()=>{
 const f=await fixture({kvs:[{model:0,xapName:"Steel"},{model:1,xapName:"Steel"}],
  library:concatenateBuffers(buildXapRecord({name:"Steel"}),buildXapRecord({name:"Unused"}))});
 const lib=await f.input.getDirectoryHandle("xapLibFMM",{create:true});
 lib.files.set("Steel.txt",new MemoryFileHandle(bytes("old")));
 lib.files.set("Other.txt",new MemoryFileHandle(bytes("keep")));
 const r=await run(f);assert.equal(r.imported,1);assert.ok(r.messages.every(m=>m.level==='info'));
 assert.deepEqual([...lib.files.keys()],["Steel.txt","Other.txt"]);
 assert.equal(await (await lib.files.get("Other.txt").getFile()).text(),"keep");
 const data=JSON.parse(await (await lib.files.get("Steel.txt").getFile()).text());
 assert.equal(data.tabl.length,24);assert.equal(data.tabl[0],.25);assert.equal(data.tabl[12],10);assert.equal(data.hip,.125);
 assert.equal(lib.files.get("Steel.txt").writeCount,1);await run(f);assert.equal(lib.files.get("Steel.txt").writeCount,1);
 assert.ok(f.input.files.has("_nogo.e3d"));
});

test("отсутствующие имена — только информация, найденные и следующие задания записаны",async()=>{
 const f=await fixture({kvs:[{model:0,xapName:"Absent"},{model:1,xapName:"Steel"},{model:0,xapName:"Absent"}]});
 const second=await fixture({root:f.root,name:"Second"});
 const r=await importUsedTaskMaterials(f.root,[enabled(f.path),enabled(second.path)],{notifyChanged:()=>{}});
 assert.equal(r.imported,2);assert.equal(r.messages.filter(m=>m.text.includes("не найдена")).length,1);
 assert.ok(r.messages.every(m=>m.level==='info'));assert.ok(second.input.directories.has("xapLibFMM"));
});

test("все имена отсутствуют — не создаёт библиотеку и не выдаёт ошибку",async()=>{
 const f=await fixture({kvs:[{model:0,xapName:"Absent"}]});const r=await run(f);
 assert.equal(r.imported,0);assert.equal(r.messages[0].level,"info");assert.equal(f.input.directories.size,0);
});

test("нет XAP.lib или ссылок ФММ — без записи; отключённые и повторные строки списка",async()=>{
 const f=await fixture({library:null});assert.deepEqual(await run(f),{imported:0,messages:[]});
 const g=await fixture({kvs:[{model:2,xapName:"HTS"}],library:new ArrayBuffer(0)});assert.equal((await run(g)).messages[0].level,"info");
 const h=await fixture();const r=await importUsedTaskMaterials(h.root,[{path:h.path,enabled:false},enabled(h.path),enabled(h.path)],{notifyChanged:()=>{}});
 assert.equal(r.imported,1);assert.equal(r.messages.length,1);
});

test("повреждённая/неоднозначная библиотека — ошибка задания до записи, продолжение списка",async()=>{
 for(const library of [new Uint8Array([1,2,3]),concatenateBuffers(buildXapRecord({name:"Steel"}),buildXapRecord({name:"steel"}))]){
  const f=await fixture({library});const second=await fixture({root:f.root,name:"Second"});
  const r=await importUsedTaskMaterials(f.root,[enabled(f.path),enabled(second.path)],{notifyChanged:()=>{}});
  assert.equal(r.imported,1);assert.equal(r.messages[0].level,"error");assert.equal(f.input.directories.size,0);
 }
});

test("сбой записи не прекращает обработку остальных заданий",async()=>{
 const f=await fixture();const lib=await f.input.getDirectoryHandle("xapLibFMM",{create:true});
 lib.files.set("Steel.txt",new MemoryFileHandle(bytes("old"),{failWrite:true}));
 const second=await fixture({root:f.root,name:"Second"});const r=await importUsedTaskMaterials(f.root,[enabled(f.path),enabled(second.path)],{notifyChanged:()=>{}});
 assert.equal(r.imported,1);assert.equal(r.messages[0].level,"error");assert.ok(second.input.directories.has("xapLibFMM"));
});

test("смена контекста до записи и небезопасный путь не изменяют файлы",async()=>{
 const f=await fixture();let current=true;const original=f.task.files.get("xap.lib").getFile.bind(f.task.files.get("xap.lib"));
 f.task.files.get("xap.lib").getFile=async()=>{current=false;return original();};
 await run(f,{isCurrent:()=>current});assert.equal(f.input.directories.size,0);
 const r=await importUsedTaskMaterials(f.root,[enabled("Project/../Task")]);assert.equal(r.messages[0].level,"error");
});

test("обычная стандартная XAP.lib также допускается для автопереноса",async()=>{
 const standard=readFileSync(new URL("../public/examples/clark.projects/2026 Тесты 204/COMSOL 3D тест силы, mu const/XAP.lib",import.meta.url));
 const {parseXapLibrary}=await import("../src/services/materialImport/xapLibImporter.js");
 const records=parseXapLibrary(standard);const f=await fixture({library:standard,kvs:[{model:0,xapName:records[0].name}]});
 assert.equal((await run(f)).imported,1);
});


test("ручной импорт использует текущие элементы вместо kvs и заменяет только нужные", async () => {
 const f = await fixture({kvs:[{model:0,xapName:"SavedOnly"}],
  library:concatenateBuffers(buildXapRecord({name:"Steel"}),buildXapRecord({name:"SavedOnly"}))});
 const lib=await f.input.getDirectoryHandle("xapLibFMM",{create:true});
 lib.files.set("Steel.txt",new MemoryFileHandle(bytes("old")));
 lib.files.set("Other.txt",new MemoryFileHandle(bytes("keep")));
 const elements=[{model:0,xapName:"Steel"},{model:1,xapName:"steel"},
  {model:0,xapName:"Missing"},{model:0,xapName:"Missing"},{model:2,xapName:"HTS"}];
 const before=JSON.stringify(elements);
 let revisions=0;
 const options={notifyChanged:()=>revisions++};
 const r=await importUsedFmmMaterials(f.task,elements,options);
 assert.equal(r.imported,1);assert.equal(r.messages.filter(m=>m.text.includes("не найдена")).length,1);
 assert.ok(r.messages.every(m=>m.level==="info"));assert.equal(revisions,1);
 assert.deepEqual([...lib.files.keys()],["Steel.txt","Other.txt"]);
 assert.equal(JSON.stringify(elements),before);
 assert.equal(r.writeResult.results[0].status,"replaced");
 const again=await importUsedFmmMaterials(f.task,elements,options);
 assert.equal(again.writeResult.results[0].status,"unchanged");
 assert.equal(lib.files.get("Steel.txt").writeCount,1);
});

test("снимок ссылок до ожидания; смена задания запрещает запись",async()=>{
 const f=await fixture();const elements=[{model:0,xapName:"Steel"}];
 const pending=importUsedFmmMaterials(f.task,elements,{notifyChanged:()=>{}});
 elements[0].xapName="ChangedLater";
 assert.equal((await pending).imported,1);
 const g=await fixture();let current=true;
 const file=g.task.files.get("xap.lib"), original=file.getFile.bind(file);
 file.getFile=async()=>{current=false;return original();};
 assert.equal((await importUsedFmmMaterials(g.task,[{model:0,xapName:"Steel"}],
  {isCurrent:()=>current,notifyChanged:()=>{}})).imported,0);
 assert.equal(g.input.directories.size,0);
});

test("ручной импорт сообщает об отсутствии XAP и не пишет при пустом списке",async()=>{
 const f=await fixture({library:null});
 await assert.rejects(()=>importUsedFmmMaterials(f.task,[]),/отсутствует XAP/);
 const g=await fixture();const r=await importUsedFmmMaterials(g.task,[],{notifyChanged:()=>{}});
 assert.equal(r.imported,0);assert.match(r.messages[0].text,/характеристик ФММ нет/);
 assert.equal(g.input.directories.size,0);
});
