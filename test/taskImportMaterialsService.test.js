import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import { collectUsedFmmNames, importUsedTaskMaterials, importUsedFmmMaterials } from "../src/services/taskImportMaterialsService.js";
import { createDefaultLibraryService } from "../src/services/defaultLibraryService.js";
import { createTaskMaterialLibraryService, MaterialBatchWriteError } from "../src/services/taskMaterialLibraryService.js";
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
const emptyBase = { loadRecords: async () => [] };
const run=(f,options={})=>importUsedTaskMaterials(f.root,[enabled(f.path)],{notifyChanged:()=>{},baseLibraryService:emptyBase,...options});

function baseFixture(names, { corrupt = false } = {}) {
 const files = new Map(), calls = [];
 const records = names.map(name => {
  // Форматирование, CRLF и дополнительное поле должны сохраниться при копировании.
  const data = { tabl:[0,1,0,2], hip:0, comment:`Базовая ${name}`, extra:"сохранить" };
  const content = bytes(JSON.stringify(data, null, 2).replaceAll("\n", "\r\n") + "\r\n");
  const fileName = `${name}.txt`;
  files.set(fileName, content);
  return { kind:"FMM", name, fileName, relativePath:`xapLibFMM/${fileName}`,
   byteSize:content.length, sha256:createHash("sha256").update(content).digest("hex"),
   summary:{comment:data.comment,detailCount:2}, data };
 });
 const index = { schemaVersion:1, source:{fileCount:records.length,byteSize:records.reduce((n,r)=>n+r.byteSize,0)},
  libraries:{FMM:{kind:"FMM",directory:"xapLibFMM",title:"ФММ",records},
   HTC:{kind:"HTC",directory:"xapLibHTC",title:"ВТСП",records:[]}} };
 const baseLibraryService = createDefaultLibraryService({cryptoImpl:webcrypto,baseUrl:"/web-gui/",
  fetchImpl:async url => {
   calls.push(url);
   let content = url.endsWith("library-index.json") ? bytes(JSON.stringify(index))
    : new Uint8Array(files.get(decodeURIComponent(url.split("?")[0].split("/").at(-1))));
   if (corrupt && !url.endsWith("library-index.json")) content[0] ^= 1;
   return {ok:true,status:200,text:async()=>new TextDecoder().decode(content),
    arrayBuffer:async()=>content.buffer.slice(content.byteOffset,content.byteOffset+content.byteLength)};
  }});
 return {files,calls,records,options:{baseLibraryService,
  libraryService:createTaskMaterialLibraryService({libraryService:baseLibraryService,cryptoImpl:webcrypto}),notifyChanged:()=>{}}};
}

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
 const r=await importUsedTaskMaterials(f.root,[enabled(f.path),enabled(second.path)],{notifyChanged:()=>{},baseLibraryService:emptyBase});
 assert.equal(r.imported,2);assert.equal(r.messages.filter(m=>m.text.includes("не найдена")).length,1);
 assert.ok(r.messages.every(m=>m.level==='info'));assert.ok(second.input.directories.has("xapLibFMM"));
});

test("все имена отсутствуют — не создаёт библиотеку и не выдаёт ошибку",async()=>{
 const f=await fixture({kvs:[{model:0,xapName:"Absent"}]});const r=await run(f);
 assert.equal(r.imported,0);assert.equal(r.messages[0].level,"info");assert.equal(f.input.directories.size,0);
});

test("нет ФММ в обоих источниках или ссылок — без записи; отключённые и повторные строки списка",async()=>{
 const f=await fixture({library:null});const missing=await run(f);
 assert.equal(missing.imported,0);assert.match(missing.messages[0].text,/не найдена.*базовой библиотеке/);
 assert.equal(f.input.directories.size,0);
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
 const options={notifyChanged:()=>revisions++,baseLibraryService:emptyBase};
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

test("пустые ссылки не читают ни XAP, ни базовую библиотеку",async()=>{
 for (const library of [null,new Uint8Array([1,2,3])]) {
  const f=await fixture({library});
  const r=await importUsedFmmMaterials(f.task,[],{baseLibraryService:{loadRecords:()=>assert.fail("Не нужен поиск")}});
  assert.equal(r.imported,0);assert.match(r.messages[0].text,/характеристик ФММ нет/);
  assert.equal(f.input.directories.size,0);
 }
});

test("без XAP копирует только используемый готовый файл, включая регистр/NFC; повтор без записи",async()=>{
 const f=await fixture({library:null,kvs:[{model:0,xapName:" е\u0308 "},{model:1,xapName:"Ё"},{model:2,xapName:"Unused"}]});
 const base=baseFixture(["Ё","Unused"]);
 const lib=await f.input.getDirectoryHandle("xapLibFMM",{create:true});
 lib.files.set("Ё.txt",new MemoryFileHandle(bytes("old")));
 lib.files.set("Keep.txt",new MemoryFileHandle(bytes("keep")));
 const result=await run(f,base.options);
 assert.equal(result.imported,1);assert.ok(result.messages.every(m=>m.level==="info"));
 assert.deepEqual(lib.files.get("Ё.txt").bytes,base.files.get("Ё.txt"));
 assert.equal(createHash("sha256").update(lib.files.get("Ё.txt").bytes).digest("hex"),base.records[0].sha256);
 assert.equal(lib.files.get("Ё.txt").writeCount,1);
 assert.deepEqual([...lib.files.keys()],["Ё.txt","Keep.txt"]);
 assert.equal(await (await lib.files.get("Keep.txt").getFile()).text(),"keep");
 const again=await importUsedFmmMaterials(f.task,[{model:0,xapName:"Ё"}],base.options);
 assert.equal(again.writeResult.unchanged,1);assert.equal(lib.files.get("Ё.txt").writeCount,1);
 assert.ok(base.calls.every(url=>!url.includes("Unused.txt")));
 assert.ok(f.input.files.has("_nogo.e3d"));
});

test("локальная XAP приоритетна; недостающее имя копируется из базы, остальные — info",async()=>{
 const f=await fixture();const base=baseFixture(["Steel","BaseOnly","Unused"]);
 const lib=await f.input.getDirectoryHandle("xapLibFMM",{create:true});
 lib.files.set("BaseOnly.txt",new MemoryFileHandle(bytes("old")));
 let revisions=0;
 const elements=[{model:0,xapName:"Steel"},{model:1,xapName:"baseonly"},
  {model:0,xapName:"Missing"},{model:1,xapName:"missing"}];
 const result=await importUsedFmmMaterials(f.task,elements,{...base.options,notifyChanged:()=>revisions++});
 assert.equal(result.imported,2);assert.equal(result.writeResult.created,1);assert.equal(result.writeResult.replaced,1);
 assert.equal(result.writeResult.results.length,2);assert.equal(revisions,1);
 assert.equal(JSON.parse(await (await lib.files.get("Steel.txt").getFile()).text()).hip,.125);
 assert.deepEqual(lib.files.get("BaseOnly.txt").bytes,base.files.get("BaseOnly.txt"));
 assert.equal(result.messages.filter(m=>m.text.includes("не найдена")).length,1);
 assert.ok(base.calls.every(url=>!url.includes("Steel.txt")&&!url.includes("Unused.txt")));
 assert.equal(lib.files.has("Missing.txt"),false);
});

test("если все имена найдены локально, базовая библиотека не требуется",async()=>{
 const f=await fixture();assert.equal((await run(f,{baseLibraryService:{
  loadRecords:()=>assert.fail("Локальная XAP достаточна"),
 }})).imported,1);
});

test("повреждённая локальная XAP не подменяется базой; неоднозначное базовое имя — ошибка до записи",async()=>{
 const f=await fixture({library:new Uint8Array([1,2,3])});
 await assert.rejects(()=>importUsedFmmMaterials(f.task,[{model:0,xapName:"Steel"}],{
  baseLibraryService:{loadRecords:()=>assert.fail("Повреждение не является отсутствием")},
 }));
 assert.equal(f.input.directories.size,0);
 const g=await fixture({library:null});
 await assert.rejects(()=>importUsedFmmMaterials(g.task,[{model:0,xapName:"Ё"}],{
  baseLibraryService:{loadRecords:async()=>[{name:"Ё"},{name:"Е\u0308"}]},
 }),/Неоднозначное имя в базовой библиотеке/);
 assert.equal(g.input.directories.size,0);
});

test("ошибка SHA базового файла не пишет смешанный пакет и не прерывает список",async()=>{
 const f=await fixture({kvs:[{model:0,xapName:"Steel"},{model:1,xapName:"BaseOnly"}]});
 const second=await fixture({root:f.root,name:"Second"});const base=baseFixture(["BaseOnly"],{corrupt:true});
 const r=await importUsedTaskMaterials(f.root,[enabled(f.path),enabled(second.path)],base.options);
 assert.equal(r.imported,1);assert.equal(r.messages[0].level,"error");assert.match(r.messages[0].text,/SHA-256/);
 assert.equal(f.input.directories.size,0);assert.ok(second.input.directories.has("xapLibFMM"));
});

test("смена контекста при поиске базы и между копированием и legacy останавливает новые записи",async()=>{
 const f=await fixture({library:null});const base=baseFixture(["Steel"]);let current=true;
 const load=base.options.baseLibraryService.loadRecords;
 const r=await run(f,{...base.options,isCurrent:()=>current,baseLibraryService:{loadRecords:async kind=>{
  const records=await load(kind);current=false;return records;
 }}});
 assert.equal(r.imported,0);assert.equal(f.input.directories.size,0);
 const g=await fixture();const mixed=baseFixture(["BaseOnly"]);current=true;let revisions=0;
 const writer=mixed.options.libraryService;
 const partial=await importUsedFmmMaterials(g.task,[{model:0,xapName:"Steel"},{model:1,xapName:"BaseOnly"}],{
  ...mixed.options,isCurrent:()=>current,notifyChanged:()=>revisions++,libraryService:{
   copyMaterials:async request=>{const result=await writer.copyMaterials(request);current=false;return result;},
   writeImportedBatch:()=>assert.fail("После смены контекста новый пакет не запускается"),
  }});
 assert.equal(partial.imported,1);assert.equal(revisions,1);
 assert.deepEqual([...g.input.directories.get("xapLibFMM").files.keys()],["BaseOnly.txt"]);
});

test("частичная запись учитывает оба источника и оставшиеся файлы",async()=>{
 for (const failedName of ["BaseOnly","Steel"]) {
  const f=await fixture();const base=baseFixture(["BaseOnly"]);
  const lib=await f.input.getDirectoryHandle("xapLibFMM",{create:true});
  lib.files.set(`${failedName}.txt`,new MemoryFileHandle(bytes("old"),{failWrite:true}));let revisions=0;
  await assert.rejects(()=>importUsedFmmMaterials(f.task,[{model:0,xapName:"Steel"},{model:1,xapName:"BaseOnly"}],{
   ...base.options,notifyChanged:()=>revisions++,
  }),error=>{
   assert.ok(error instanceof MaterialBatchWriteError);
   assert.equal(error.failed.fileName,`${failedName}.txt`);
   assert.equal(error.written.length,failedName==="Steel"?1:0);
   assert.deepEqual(error.remaining.map(file=>file.fileName),failedName==="Steel"?[]:["Steel.txt"]);
   return true;
  });
  assert.equal(revisions,1);
 }
});
