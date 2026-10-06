import test from 'node:test';
import assert from 'node:assert/strict';
import { installModelSaveShortcut } from '../src/services/modelSaveShortcut.js';

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(onSave, isEnabled=()=>true, onError=()=>{}) {
  let listener, removed=0;
  const target={addEventListener(type,fn,capture){assert.equal(type,'keydown');assert.equal(capture,true);listener=fn;},
    removeEventListener(type,fn,capture){assert.equal(type,'keydown');assert.equal(fn,listener);assert.equal(capture,true);removed++;}};
  const dispose=installModelSaveShortcut({target,onSave,isEnabled,onError});
  return {dispose,removed:()=>removed,event(overrides={}){
    let prevented=0,stopped=0;
    const event={code:'KeyS',key:'ы',ctrlKey:true,preventDefault(){prevented++;},stopPropagation(){stopped++;},...overrides};
    listener(event);return {prevented,stopped};
  }};
}
test('Ctrl+S captures every focus target using physical key code, including Cyrillic layout',async()=>{
  let count=0;const f=fixture(()=>{count++;});
  for(const target of [{tagName:'INPUT'},{tagName:'TEXTAREA'},{tagName:'SELECT'},{tagName:'CANVAS'},{isContentEditable:true},{}]) {
    assert.deepEqual(f.event({target}),{prevented:1,stopped:1});await tick();
  }
  assert.equal(count,6);f.dispose();assert.equal(f.removed(),1);
  f.event();assert.equal(count,6);
});
test('first tab, composing input and modifier conflicts keep native behavior',()=>{
  let count=0,enabled=false;const f=fixture(()=>{count++;},()=>enabled);
  assert.equal(f.event().prevented,0);enabled=true;
  for(const extra of [{ctrlKey:false},{code:'KeyA'},{code:'',key:'s'},{isComposing:true},{altKey:true},{metaKey:true},{shiftKey:true}])assert.equal(f.event(extra).prevented,0);
  assert.equal(count,0);f.dispose();
});
test('repeat and overlapping key presses do not start concurrent saves but prevent browser Save As',async()=>{
  let release,count=0;const f=fixture(()=>{count++;return new Promise(resolve=>{release=resolve;});});
  assert.equal(f.event({repeat:true}).prevented,1);assert.equal(count,0);
  f.event();f.event();f.event({repeat:true});assert.equal(count,1);
  release();await tick();f.event();assert.equal(count,2);release();f.dispose();
});
test('both synchronous errors and rejected saves release the lock and report failure',async()=>{
  let count=0;const errors=[];
  const f=fixture(()=>{count++;if(count===1)throw Error('sync');if(count===2)return Promise.reject(Error('async'));},()=>true,e=>errors.push(e.message));
  f.event();await tick();f.event();await tick();f.event();await tick();
  assert.deepEqual(errors,['sync','async']);assert.equal(count,3);f.dispose();
});
