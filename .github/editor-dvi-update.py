"""Temporary, assertion-checked patch; removed before the correction is merged."""
import datetime
import json
import os
import pathlib
import re
import sys

BASE = '55fe8efdb35e7ebc05c74a7712c10ea5045ef1f0'
STAMP = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3))).strftime('%Y-%m-%d %H:%M UTC+3')

def replace(path, old, new, count=1):
    p = pathlib.Path(path)
    text = p.read_text(encoding='utf-8')
    assert text.count(old) == count, (path, old[:100], text.count(old), count)
    p.write_text(text.replace(old, new), encoding='utf-8')

def dated(path):
    p = pathlib.Path(path)
    text, count = re.subn(r'^Обновлено:.*$', 'Обновлено: '+STAMP+'.', p.read_text(encoding='utf-8'), count=1, flags=re.M)
    assert count == 1, path
    p.write_text(text, encoding='utf-8')

def apply():
    g = 'src/services/generator/uniformFieldCoil.js'
    replace(g, 'export const COIL_SEGMENTS=72;', 'export const COIL_DEFAULT_DVI=20;')
    replace(g, 'length:100,opening:360,', 'length:100,opening:COIL_DEFAULT_DVI,')
    replace(g, 'params.opening===undefined?360:params.opening', 'params.opening===undefined?COIL_DEFAULT_DVI:params.opening')
    replace(g, '  const segments=Math.ceil(opening/(360/COIL_SEGMENTS)),sectorAngle=opening/segments;', '''  // opening is dvi of ONE base sector, not the total winding aperture.
  // Preserve the entered angle exactly in geo.dvi and sym.yl; never refit it.
  const segments=Math.floor(360/opening),sectorAngle=opening;
  if(!Number.isSafeInteger(segments)||segments<1||segments>2147483647)
    fail("Раскрытие задаёт недопустимое число локальных образов (целое Int32).");
  const coveredAngle=segments*sectorAngle;''')
    replace(g, 'length,opening,segments,sectorAngle,j0,axis,angles,amplitude,move,', 'length,opening,segments,sectorAngle,coveredAngle,j0,axis,angles,amplitude,move,')
    replace(g, '  const v=[...previous,...Array.from({length:segments},()=>[0,-j0,0])];', '''  const layout=mhjLayout(nextElements);
  const coilRows=layout.items.find(item=>item.kvIndex===insertAt);
  // The new coil is the final prescribed-source element. Derive its actual
  // range from the common discretization/symmetry layout, not a fixed row count.
  if(!coilRows||coilRows.start!==previous.length||coilRows.count!==segments
    ||layout.rows!==previous.length+coilRows.count)
    fail("Не удалось согласовать диапазон заданных источников катушки с её дискретизацией.");
  const v=[...previous,...Array.from({length:coilRows.count},()=>[0,-j0,0])];''')

    ui = 'src/components/elements/UniformFieldCoilDialog.jsx'
    replace(ui, '<label>Раскрытие, град <input type="number" min="0" max="360" step="any"', '<label>Раскрытие, град <input title="dvi базового сектора; также угол локальной симметрии" type="number" min="0" max="360" step="any"')
    replace(ui, '· раскрытие {number(values().opening)}°', '· dvi = {number(values().opening)}° · охват {number(values().coveredAngle)}°')
    replace(ui, '<Show when={values().opening<360}><p class="coil-sector-notice" role="note">Создаётся сектор. Ток и оценка ниже относятся к полной катушке 360° с теми же размерами, а не к фактическому полю отдельного сектора.</p></Show>', '<Show when={values().coveredAngle<360-1e-9}><p class="coil-sector-notice" role="note">Число образов = floor(360 / dvi). Остаток {number(360-values().coveredAngle)}° не заполняется; введённый dvi не изменяется. Ток и аналитическая оценка относятся к полной катушке 360°.</p></Show>')

    t = 'test/uniformFieldCoil.test.js'
    replace(t, 'full coil has 72 contiguous valid sectors', 'default coil has 18 contiguous valid sectors')
    replace(t, 'assert.equal(instances.length,72)', 'assert.equal(instances.length,18)')
    replace(t, 'assert.equal(mhjLayout(r.elements).rows,72)', 'assert.equal(mhjLayout(r.elements).rows,18)')
    replace(t, 'assert.equal(stored[0].sym.ls,72)', 'assert.equal(stored[0].sym.ls,18)')
    replace(t, 'assert.equal(r.mhj[0].v.length,73)', 'assert.equal(r.mhj[0].v.length,19)')
    replace(t, 'new coil defaults use L=100, full opening and a Russian name without shared arrays', 'new coil defaults use L=100, dvi=20 and a Russian name without shared arrays')
    replace(t, 'assert.equal(p.opening,360)', 'assert.equal(p.opening,20)')
    replace(t, 'for(const opening of [360,180,90,17,5,2.5])', 'for(const opening of [20,10,30,17,5,2.5,11.3,90,120])')
    replace(t, 'n=Math.ceil(opening/5)', 'n=Math.floor(360/opening)')
    replace(t, 'assert.equal(record.symLs,n);close(record.symLs*record.symYl,opening);\n    assert.ok(record.symYl>0&&record.symYl<=5);', 'assert.equal(record.symLs,n);assert.equal(record.symYl,opening);\n    assert.equal(result.values.coveredAngle,n*opening);\n    assert.ok(result.values.coveredAngle<=360);\n    assert.ok(360-result.values.coveredAngle<opening+1e-10);')
    replace(t, '[null,"",0,-1,360.01,361,NaN,Infinity,-Infinity]', '[null,"",0,-1,360.01,361,NaN,Infinity,-Infinity,1e-200,360/2147483648]')
    with pathlib.Path(t).open('a', encoding='utf-8') as f:
        f.write('''

test("dvi is the unchanged base-sector and local-symmetry angle with truncated image count",()=>{
  for(const [opening,n] of [[20,18],[10,36],[30,12],[17,21],[11.3,31]]) {
    const r=prepareUniformFieldCoil(empty(),{...params,opening},createElement),e=r.elements[0];
    assert.equal(e.geo.flat()[8],opening);assert.equal(e.symYl,opening);assert.equal(e.symLs,n);
    assert.equal(r.mhj[0].v.length,n);assert.equal(r.values.coveredAngle,n*opening);
    const stored=serialize(r.elements,elementSchema)[0];
    assert.equal(stored.geo[8],opening);assert.equal(stored.sym.yl,opening);assert.equal(stored.sym.ls,n);
  }
  const r=prepareUniformFieldCoil(empty(),{...params,opening:17},createElement);
  assert.equal(r.values.coveredAngle,357);assert.equal(360-r.values.coveredAngle,3);
});

test("new coil fills precisely its MHJ range after discretized existing sources",()=>{
  const magnet={...createElement(),name:"magnet",targ:1,dp:[[2],[3],[1]],symLs:2};
  const oldCoil={...createElement(),name:"existing coil",targ:2,dp:[[1],[2],[1]],symLs:3};
  const virtual={...createElement(),name:"virtual",targ:3};
  const elements=[magnet,oldCoil,virtual],count=mhjLayout(elements).rows;
  assert.equal(count,18);
  const previous=Array.from({length:count},(_,i)=>[i+1,100+i,-i]);
  const model={...empty(),elements,mhj:[{v:previous}]},snapshot=structuredClone(model);
  for(const [opening,n] of [[20,18],[10,36],[30,12],[17,21]]) {
    const r=prepareUniformFieldCoil(model,{...params,opening},createElement);
    const layout=mhjLayout(r.elements),range=layout.items.find(item=>item.kvIndex===r.recordIndex);
    assert.equal(r.recordIndex,2);assert.equal(r.elements[3],virtual);
    assert.equal(range.start,count);assert.equal(range.count,n);assert.equal(layout.rows,count+n);
    assert.deepEqual(r.mhj[0].v.slice(0,count),previous);
    assert.ok(r.mhj[0].v.slice(count).every(v=>v[0]===0&&v[1]===-r.values.j0&&v[2]===0));
    assert.deepEqual(model,snapshot);
  }
});

test("changing dvi between additions preserves old coil rows and grouped Undo/Redo",()=>{
  const args=setup();applyUniformFieldCoil({...args,params:{...params,opening:20}});
  const first=structuredClone(modelService.getModel());assert.equal(first.mhj[0].v.length,18);
  const second=applyUniformFieldCoil({...args,params:{...params,H0:3,opening:10}});
  const both=structuredClone(modelService.getModel());
  assert.equal(both.elements[1].symLs,36);assert.equal(both.mhj[0].v.length,54);
  assert.deepEqual(both.mhj[0].v.slice(0,18),first.mhj[0].v);
  assert.ok(both.mhj[0].v.slice(18).every(v=>v[0]===0&&v[1]===-second.values.j0&&v[2]===0));
  assert.equal(modelService.undo("mhj"),true);assert.deepEqual(modelService.getModel(),first);
  assert.equal(modelService.redo("elements"),true);assert.deepEqual(modelService.getModel(),both);
});
''')

    b = 'scripts/check-editor-features-browser.mjs'
    replace(b, "coil default L=100, opening=360, Russian name", "coil default L=100, dvi=20, Russian name")
    replace(b, "inputValue()==='360'", "inputValue()==='20'")
    replace(b, "  await coil.getByLabel('Раскрытие, град',{exact:true}).fill('90');\n  check('sector warning distinguishes full-coil analytic field',await coil.locator('.coil-sector-notice').isVisible());", """  check('default dvi=20 does not warn about an incomplete winding',!await coil.locator('.coil-sector-notice').isVisible());
  for(const [dvi,n] of [[10,36],[30,12],[17,21]]) {
    await coil.getByLabel('Раскрытие, град',{exact:true}).fill(String(dvi));
    check(`dvi=${dvi} previews ${n} local images without modifying the model`,(await coil.innerText()).includes(`локальных образов: ${n}`)&&(await current()).elements.length===0);
  }
  check('dvi=17 warns about the unfilled 3-degree remainder',await coil.locator('.coil-sector-notice').isVisible()&&(await coil.locator('.coil-sector-notice').innerText()).includes('Остаток 3°'));
  await coil.getByLabel('Раскрытие, град',{exact:true}).fill('20');
  check('dvi=20 restores full coverage without a sector warning',!await coil.locator('.coil-sector-notice').isVisible());""")
    replace(b, "'coil-sector.png'", "'coil-dvi.png'")
    replace(b, "check('coil sector creates 18 local copies and 18 current rows',model.elements[0].symLs===18&&model.elements[0].symYl===5&&model.mhj[0].v.length===18);", "check('dvi=20 creates the unchanged 20-degree sector, 18 images and 18 Jy rows',model.elements[0].geo.flat()[8]===20&&model.elements[0].symLs===18&&model.elements[0].symYl===20&&model.mhj[0].v.length===18&&model.mhj[0].v.every(v=>v[0]===0&&v[1]<0&&v[2]===0));")
    anchor = "  await coil.getByRole('button',{name:'Закрыть',exact:true}).click();"
    addition = """  // Changing the generator parameter must not rewrite previously added coils.
  let previousRows=model.mhj[0].v,expectedElements=1;
  for(const [dvi,n] of [[30,12],[10,36]]) {
    await coil.getByLabel('Раскрытие, град',{exact:true}).fill(String(dvi));
    await coil.getByRole('button',{name:'Добавить катушку',exact:true}).click();
    expectedElements+=1;await page.waitForFunction(n=>editorFixture.model().elements.length===n,expectedElements);
    const next=await current(),record=next.elements.at(-1),rows=next.mhj[0].v;
    check(`dvi=${dvi} adds exactly ${n} current rows and preserves all earlier sources`,record.symLs===n&&record.symYl===dvi&&record.geo.flat()[8]===dvi&&rows.length===previousRows.length+n&&JSON.stringify(rows.slice(0,previousRows.length))===JSON.stringify(previousRows)&&rows.slice(previousRows.length).every(v=>v[0]===0&&v[1]<0&&v[2]===0));
    previousRows=rows;
  }
"""
    replace(b, anchor, addition+anchor)

    geo = 'docs/AI_GEOMETRY_GENERATION.md'
    replace(geo, '## Генератор катушки однородного поля — 4.45.0', '## Генератор катушки однородного поля — 4.45.1')
    replace(geo, '''Раскрытие φ — конечное 0<φ≤360° (отсутствующее поле совместимо с 360°).
N=ceil(φ/5°), Δφ=φ/N≤5°. Одна запись geoType=1, targ=2, dp=(1,1,1),
auto=true описывает сектор Δφ:''', '''Раскрытие — непосредственно dvi одного базового сектора, а не общий угол
обмотки. По умолчанию dvi=20.0°; отсутствующее поле генератора также даёт 20°.
N=floor(360.0/dvi), Δφ=dvi: угол не делится и не подгоняется к полному обороту.
Вход — конечное 0<dvi≤360°; N должен быть положительным целым Int32.
Одна запись geoType=1, targ=2, dp=(1,1,1), auto=true описывает сектор dvi:''')
    replace(geo, 'Полный оборот сохраняет прежние symLs=72 и symYl=5°.', 'При dvi=20°: symLs=18, symYl=20°. При dvi=10°: 36 и 10°; при 30°: 12 и 30°.\nПри dvi=17°: 21 образ, охват 357°, остаток 3° не заполняется.')
    replace(geo, 'Начальный сектор расположен у положительной Z. MHJ содержит N строк', 'Начальный сектор расположен у положительной Z. Диапазон нового элемента\nопределяет общий mhjLayout по фактическому разбиению и симметриям. При штатных\ndp=(1,1,1), AS=PS=1 он содержит ровно N строк, не N+1. MHJ содержит в нём N векторов')
    replace(geo, 'вокруг оси катушки принят нулевым; для неполного раскрытия это однозначно\nфиксирует положение начального сектора.', 'вокруг оси катушки принят нулевым и фиксирует положение начального сектора.')
    replace(geo, '''Неполное раскрытие меняет геометрию и число токовых образов, но не калибровку
j0=H0/K(0) полной обмотки. Аналитика H(0), H(R) и δR для φ<360° является
справкой о соответствующей полной катушке, а не обещанием H0 или однородности
поля отдельного сектора. UI показывает это ограничение явно.''', '''Изменение dvi в панели пересчитывает число образов и размер диапазона токов
для следующего добавления. Уже добавленные или сохранённые элементы и их MHJ
автоматически не пересоздаются. Геометрия и источники публикуются одной
группой Undo/Redo; прежние источники остаются неизменными.

j0=H0/K(0) и аналитика H(0), H(R), δR относятся к непрерывной полной обмотке.
При N*dvi<360° UI сообщает об остатке 360°−N*dvi и границе аналитики; ток
не масштабируется на 360/(N*dvi). При dvi=20° полный оборот не вызывает
предупреждения о неполной катушке. Аппроксимация крупным сектором по-прежнему
имеет геометрическую погрешность; точность поля проверяется решателем.''')

    u = 'docs/AI_UI_CONTRACTS.md'
    replace(u, '## Инструмент катушки — 4.45.0', '## Инструмент катушки — 4.45.1')
    replace(u, '''Начальное имя — «Катушка однородного поля». После L расположен ввод раскрытия:
конечное значение 0<φ≤360°, по умолчанию 360°. Число локальных образов
N=ceil(φ/5°); при полном обороте прежние 72. Геометрия и MHJ всегда используют
одинаковое N.''', '''Начальное имя — «Катушка однородного поля». После L расположен ввод раскрытия:
это dvi базового сектора, по умолчанию 20.0°, а не общий охват катушки.
Геометрия сохраняет введённый dvi; «Локальная симметрия: угол» равен dvi,
«Образы локальной симметрии» — floor(360.0/dvi). Дополнительной подгонки угла нет.
Диапазон MHJ определяется mhjLayout; при штатном разбиении он содержит ровно
это число строк (0,−j0,0). При правке dvi пересчитываются число образов и охват
для следующего добавления, но уже созданные катушки не изменяются.''')
    replace(u, '''При φ<360° показано явное предупреждение: j0 и аналитическая таблица относятся
к полной катушке с такими же размерами и током, не к полю изолированного сектора.
Переход к сектору не умножает ток на 360/φ.''', '''Предупреждение показано только при фактическом остатке 360°−N*dvi (с отсечением
шума округления 1e−9° в отображении). Например, 17° создаёт 21 образ и оставляет
3°; 20° создаёт 18 образов без предупреждения. j0 и аналитика относятся к
непрерывной полной катушке. Ток не масштабируется для компенсации остатка.''')

    h = 'docs/user-guide/index.html'
    replace(h, 'версия GUI <strong>4.45.0</strong>', 'версия GUI <strong>4.45.1</strong>')
    replace(h, 'инструмент создаёт катушку или её явно заданный сектор без достраивания зеркалами.', 'инструмент создаёт катушку образами локальной симметрии без достраивания зеркалами.')
    replace(h, 'Следующее поле «Раскрытие, град» задаёт 0&lt;φ≤360°; 360° означает полную катушку.', 'Следующее поле «Раскрытие, град» задаёт <code>dvi</code> одного базового сектора, по умолчанию <strong>20.0°</strong>. Такой же угол записывается в «Локальная симметрия: угол», а число образов равно целой части <code>360.0/dvi</code>: для 20° — 18, для 10° — 36, для 30° — 12.')
    replace(h, 'Геометрия и заданные токи добавляются вместе;', 'На вкладке «Заданные источники» проверьте соответствующий катушке диапазон: при штатном разбиении число строк равно числу локальных образов, все векторы имеют вид (0, −j0, 0). Изменение dvi меняет этот диапазон при следующем добавлении; ранее созданные катушки не пересоздаются. Геометрия и заданные токи добавляются вместе;')
    replace(h, 'Полная обмотка состоит из 72 секторов. Для неполного раскрытия число частей равно ceil(φ/5°). <strong>Для отдельного сектора ток и аналитическая таблица относятся к соответствующей полной обмотке, а не к фактическому полю сектора.</strong>', 'В геометрии сохраняется введённый dvi, без подгонки. Например, 17° даёт 21 образ, охват 357° и незаполненный остаток 3°; панель сообщает об этом. При 20° создаётся полный оборот из 18 секторов. <strong>Ток и аналитическая таблица относятся к непрерывной полной обмотке, а не компенсируют оставленный угловой промежуток.</strong>')

    replace('README.md', 'Подготовленная версия: **4.45.0**.', 'Текущая версия: **4.45.1**.')
    replace('README.md', 'L=100 мм по умолчанию и позволяет задать раскрытие сектора; начальное название\nкатушки — русское. Аналитика неполной обмотки явно относится к полной катушке.', 'L=100 мм по умолчанию. «Раскрытие» задаёт dvi базового сектора (20.0°);\nугол локальной симметрии равен dvi, число образов — floor(360/dvi). Геометрия\nи соответствующий диапазон заданных токов создаются согласованно. Начальное\nназвание катушки — русское. При остатке угла панель показывает предупреждение.')
    replace('docs/AI_FILES.md', 'Начальные значения, единое вычисление углов `symVi`, раскрытие и согласованные геометрия/MHJ.', 'Начальные значения, углы `symVi`, dvi=20°, floor(360/dvi) и диапазон геометрии/MHJ через mhjLayout.')
    replace('docs/AI_FILES.md', 'Поле раскрытия, индикаторы углов и граница аналитики сектора.', 'Поле dvi, индикаторы углов, число образов и предупреждение об угловом остатке.')
    r = 'docs/resume.md'
    p = pathlib.Path(r);text=p.read_text(encoding='utf-8')
    start=text.index('Подготовлена версия **4.45.0**');end=text.index('В main включена версия **4.44.3**',start)
    text=text[:start]+'''Текущая версия **4.45.1**: «Раскрытие» — dvi базового сектора (20.0°),
угол локальной симметрии равен dvi, число образов — floor(360/dvi).
Источники формируются в соответствующем диапазоне MHJ; чужие строки сохранены.
[Контракт](AI_GEOMETRY_GENERATION.md#uniform-field-coil) ·
[Проверка](AI_VERIFICATION.md#verification-coil-dvi-4451).

Версия **4.45.0** включена в main ([PR 65](https://github.com/y26084670-blip/web-gui/pull/65)):
углы катушки, L=100 мм, Ctrl+A, Ctrl+S и генератор ФММ μ=const.

'''+text[end:]
    p.write_text(text,encoding='utf-8')
    for path in [g,ui,t,b]:
        assert pathlib.Path(path).exists()
    for path in ['README.md',r,'docs/AI_FILES.md',geo,u]:dated(path)
    for path,count in [('package.json',1),('package-lock.json',2)]:
        replace(path, '"version": "4.45.0"', '"version": "4.45.1"',count)


def tap(path):
    text=pathlib.Path(path).read_text(encoding='utf-8')
    result={key:int(re.search(r'^# '+key+r' (\d+)$',text,re.M).group(1)) for key in ['tests','pass','fail']}
    result['failures']=re.findall(r'^not ok \d+ - (.+)$',text,re.M)
    assert len(result['failures'])==result['fail'],result
    return result


def record():
    out=pathlib.Path(os.environ['CHECK_OUTPUT'])
    baseline=tap(out/'baseline-tests.log');current=tap(out/'full-tests.log');focused=tap(out/'focused-tests.log')
    assert focused['fail']==0 and focused['tests']>=47,focused
    assert not (set(current['failures'])-set(baseline['failures'])),(baseline,current)
    assert current['fail']<=baseline['fail'] and current['tests']>=baseline['tests']+3
    result=json.loads((out/'results.json').read_text())
    assert result['errors']==[] and result['passed']>=38 and len(result['checks'])==result['passed'],result
    result.update(version='4.45.1',baseCommit=BASE,inputCommit=os.environ['GITHUB_SHA'],workflow='https://github.com/'+os.environ['GITHUB_REPOSITORY']+'/actions/runs/'+os.environ['GITHUB_RUN_ID'],tests={'baseline':baseline,'current':current,'focused':focused})
    evidence=pathlib.Path('docs/verification/editor-4451-browser.json')
    assert not evidence.exists()
    evidence.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (out/'editor-4451-browser.json').write_bytes(evidence.read_bytes())
    v='docs/AI_VERIFICATION.md';p=pathlib.Path(v);text=p.read_text(encoding='utf-8')
    head='<a id="verification-editor-445"></a>'
    section=f'''<a id="verification-coil-dvi-4451"></a>
## Раскрытие как dvi базового сектора — 4.45.1

Проверено {STAMP}, Node.js 24/Linux; база main `{BASE}` (4.45.0).
Исправлена трактовка поля: dvi=20° по умолчанию; geo.dvi=symYl=dvi;
symLs=floor(360/dvi). Диапазон источников определяется mhjLayout и заполняется
(0,−j0,0); прежние источники не изменяются. При dvi=17° охват 357°, без подгонки.

Профильные тесты: **{focused['pass']}/{focused['tests']}**; проверены углы и
сериализация, разные dvi, сохранение источников дискретизированных элементов,
последовательное добавление катушек и групповые Undo/Redo. Команда:

```sh
node --test --test-reporter=tap test/uniformFieldCoil.test.js test/geometryCameraView.test.js test/constantMuFmm.test.js test/modelSaveShortcut.test.js test/fmmTableInput.test.js
```

Полный набор: база **{baseline['pass']}/{baseline['tests']}, {baseline['fail']} сбоев**;
исправление **{current['pass']}/{current['tests']}, {current['fail']} сбоев**. Новых
имён сбоев нет; общий набор по-прежнему не полностью зелёный.

Браузерная приёмка actual App/Tabulator/WebGL и Chromium OPFS: **{result['passed']}/{result['passed']}**,
необработанных ошибок нет. Проверены ввод dvi 10/30/17/20, число образов,
отсутствие мутации при предпросмотре, добавление катушек 20/30/10° с диапазонами
18/12/36 строк и сохранением чужих токов; прежние Ctrl+A/Ctrl+S и μ=const также
повторно проверены. Сборки release/Pages и SHA-256 ресурсов успешны.

[Фактический запуск]({result['workflow']}); полный перечень и границы проверки —
`verification/editor-4451-browser.json`. ОС-диалог и разрешения Windows,
установленный Clark и физическая погрешность поля не проверялись.
Результаты 4.45.0 ниже оставлены историческими, не выданы за новый прогон.

'''
    assert text.count(head)==1;p.write_text(text.replace(head,section+head),encoding='utf-8');dated(v)
    history='docs/AI_HISTORY.md';p=pathlib.Path(history);text=p.read_text(encoding='utf-8')
    pr=os.environ['DVI_PR_NUMBER'];url='https://github.com/y26084670-blip/web-gui/pull/'+pr
    old='Последнее функциональное изменение: приложение 4.44.3, [PR 64](https://github.com/y26084670-blip/web-gui/pull/64),\nmerge commit `e4e51b4b467f9aa013c3d1548fe3577f6c0a56b8`.'
    assert old in text;text=text.replace(old,f'Последнее исправление: приложение 4.45.1, [PR {pr}]({url}).')
    entry=f'''### {STAMP} — dvi базового сектора катушки, 4.45.1

[PR {pr}]({url}) исправляет трактовку «Раскрытия» после PR 65:
dvi=20°, symYl=dvi, symLs=floor(360/dvi); источники заполняются по mhjLayout.
Профильные тесты {focused['pass']}/{focused['tests']}, браузер {result['passed']}/{result['passed']};
release/Pages/assets успешны. Полный набор {current['pass']}/{current['tests']},
{current['fail']} прежних сбоев, новых нет. Windows file picker и установленный
Clark не проверены. [Контракт](AI_GEOMETRY_GENERATION.md#uniform-field-coil),
[свидетельства](AI_VERIFICATION.md#verification-coil-dvi-4451).

'''
    marker='## Основные этапы\n\n';assert text.count(marker)==1;p.write_text(text.replace(marker,marker+entry),encoding='utf-8');dated(history)
    for path in ['.github/editor-dvi-update.py','.github/workflows/editor-dvi-check.yml']:
        pathlib.Path(path).unlink()

if __name__=='__main__':
    {'apply':apply,'record':record}[sys.argv[1]]()
