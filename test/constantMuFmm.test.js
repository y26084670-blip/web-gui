import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createConstantMuFmm, saveConstantMuFmm, matchesConstantMuRecord } from '../src/services/materials/constantMuFmm.js';
import { createFmmMaterialFile } from '../src/services/materialImport/xapLibImporter.js';
import { createTaskMaterialLibraryService } from '../src/services/taskMaterialLibraryService.js';

function missing() {
  return Object.assign(new Error("missing"), { name: "NotFoundError" });
}
class MemoryDirectory {
  kind = "directory";
  directories = new Map();
  files = new Map();
  async getDirectoryHandle(name, { create = false } = {}) {
    if (!this.directories.has(name)) {
      if (!create) throw missing();
      this.directories.set(name, new MemoryDirectory());
    }
    return this.directories.get(name);
  }
  async getFileHandle(name, { create = false } = {}) {
    if (!this.files.has(name)) {
      if (!create) throw missing();
      this.files.set(name, new MemoryFile());
    }
    return this.files.get(name);
  }
  async *entries() { yield* this.files; yield* this.directories; }
  async removeEntry(name) { if (!this.files.delete(name)) throw missing(); }
}
class MemoryFile {
  kind = "file";
  bytes = new Uint8Array();
  fail = false;
  async getFile() { return { arrayBuffer: async () => this.bytes.slice().buffer }; }
  async createWritable() {
    let next;
    return {
      write: async bytes => { if (this.fail) throw new Error("write failed"); next = new Uint8Array(bytes); },
      close: async () => { this.bytes = next; },
      abort: async () => {},
    };
  }
}

async function setup() {
  const taskHandle=new MemoryDirectory();
  await taskHandle.getDirectoryHandle('input3XX',{create:true});
  const service=createTaskMaterialLibraryService({cryptoImpl:webcrypto});
  return {taskHandle,service};
}
const payload=file=>JSON.parse(new TextDecoder().decode(file.bytes));
test('constant mu generation has exactly 12 distinct uniform H nodes with both endpoints and native column-major serialization',()=>{
  for(const mu of [1,0.5,1234,1234.567]) {
    const r=createConstantMuFmm({mu,hMax:22});
    assert.equal(r.tabl.length,12);assert.equal(r.hip,mu-1);
    r.tabl.forEach(([h,m],i)=>{assert.equal(h,i*2);assert.equal(m,(mu-1)*h===0?0:(mu-1)*h);});
    const file=createFmmMaterialFile(r);
    assert.deepEqual(file.data.tabl,[...r.tabl.map(v=>v[0]),...r.tabl.map(v=>v[1])]);
    assert.equal(file.data.hip,mu-1);assert.equal(file.fileName,r.name+'.txt');
  }
});
test('filenames have a dot and exactly two decimal places; rounding never changes the material law',()=>{
  for(const [mu,name] of [[1234,'1234.00'],[1.5,'1.50'],[1234.567,'1234.57'],[0.004,'0.00'],[1e21,'1000000000000000000000.00']]) {
    const r=createConstantMuFmm({mu,hMax:1});assert.equal(r.name,name);assert.equal(r.tabl[11][1],mu-1);
  }
});
test('invalid parameters, overflow and indistinguishable H nodes cannot generate a characteristic',()=>{
  for(const value of [undefined,null,'',0,-1,NaN,Infinity,-Infinity,'bad']) {
    assert.throws(()=>createConstantMuFmm({mu:value,hMax:1}));
    assert.throws(()=>createConstantMuFmm({mu:2,hMax:value}));
  }
  assert.throws(()=>createConstantMuFmm({mu:1e308,hMax:1e308}),/диапазон/);
  assert.throws(()=>createConstantMuFmm({mu:1,hMax:Number.MIN_VALUE}),/12 различных/);
});
test('Create is pure, explicit Save writes the standard local file and repeated Save replaces only that file',async()=>{
  const args=await setup(),r=createConstantMuFmm({mu:1234,hMax:22});
  const input=await args.taskHandle.getDirectoryHandle('input3XX');assert.equal(input.directories.size,0);
  const saved=await saveConstantMuFmm({...args,record:r});
  assert.match(saved._taskLibraryRecord.sha256,/^[a-f0-9]{64}$/);assert.equal(saved._taskLibraryRecord.relativePath,'input3XX/xapLibFMM/1234.00.txt');
  assert.equal(r._taskLibraryRecord,undefined);
  const dir=await input.getDirectoryHandle('xapLibFMM');const file=dir.files.get('1234.00.txt');
  const before=file.bytes.slice();
  await saveConstantMuFmm({...args,record:createConstantMuFmm({mu:2,hMax:10})});
  const other=dir.files.get('2.00.txt').bytes.slice();
  const updated=await saveConstantMuFmm({...args,record:createConstantMuFmm({mu:1234,hMax:44})});
  assert.equal(dir.files.size,2);assert.notDeepEqual(file.bytes,before);assert.deepEqual(dir.files.get('2.00.txt').bytes,other);
  assert.equal(payload(file).tabl[11],44);assert.equal(payload(file).tabl[23],1233*44);
  assert.notEqual(updated._taskLibraryRecord.sha256,saved._taskLibraryRecord.sha256);
  const loaded=await args.service.loadMaterials({taskHandle:args.taskHandle,kind:'FMM'});
  assert.equal(loaded.length,2);assert.deepEqual(loaded.find(v=>v.name==='1234.00').data,payload(file));
});
test('write failures retain the old file and original in-memory characteristic',async()=>{
  const args=await setup(),r=createConstantMuFmm({mu:2,hMax:10});await saveConstantMuFmm({...args,record:r});
  const dir=await (await args.taskHandle.getDirectoryHandle('input3XX')).getDirectoryHandle('xapLibFMM');
  const file=dir.files.get('2.00.txt'),before=file.bytes.slice();file.fail=true;
  await assert.rejects(saveConstantMuFmm({...args,record:createConstantMuFmm({mu:2,hMax:20})}),error=>error.name==='MaterialBatchWriteError'&&error.cause?.message==='write failed');
  assert.deepEqual(file.bytes,before);assert.equal(r.tabl[11][0],10);
});
test('unsaved-target checks match both edited names and original filenames without matching unrelated rows',()=>{
  assert.equal(matchesConstantMuRecord({name:'1234.00'},'1234.00'),true);
  assert.equal(matchesConstantMuRecord({name:'Renamed',_taskLibraryRecord:{fileName:'1234.00.txt'}},'1234.00'),true);
  assert.equal(matchesConstantMuRecord({name:'234.00'},'1234.00'),false);
});


test('overwrite authorization is bound to the observed SHA; a concurrent external change aborts Save',async()=>{
  const args=await setup(),record=createConstantMuFmm({mu:3,hMax:10});
  await saveConstantMuFmm({...args,record});
  const dir=await (await args.taskHandle.getDirectoryHandle('input3XX')).getDirectoryHandle('xapLibFMM');
  const file=dir.files.get('3.00.txt');
  let calls=0,external;
  const guarded={async writeImportedBatch(options){
    calls++;
    if(calls===2){external=new TextEncoder().encode(JSON.stringify({...payload(file),comment:'external change'}));file.bytes=external.slice();}
    return args.service.writeImportedBatch(options);
  }};
  await assert.rejects(saveConstantMuFmm({...args,service:guarded,record:createConstantMuFmm({mu:3,hMax:20})}),{name:'MaterialBatchConflictError'});
  assert.equal(calls,2);assert.deepEqual(file.bytes,external);
});
