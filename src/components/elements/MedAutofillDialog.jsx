import { For, Show } from "solid-js";
import { FloatingWindow } from "../window/FloatingWindow.jsx";
import { MED_FACE_NAMES } from "../../services/medAnalysisService.js";
import "./MedAutofillDialog.css";

export function MedAutofillDialog(props) {
  const link = (block,face) => <button type="button" class="med-element-link"
    disabled={props.stale} title="Перейти к исходной записи элемента и полю MED"
    onClick={()=>props.onNavigate(block,face)}>
    ШГ {block}{face===undefined?"":` · ${MED_FACE_NAMES[face]}`}
  </button>;
  const proposed = side => props.result?.faces.find(f=>f.block===side.block&&f.face===side.face)?.proposed ?? "—";
  return <FloatingWindow open={props.open} title="Автозаполнение MED" initialWidth={980} initialHeight={640}
    minWidth={560} minHeight={360} storageKey="web-gui:med-autofill" onClose={props.onClose}>
    <div class="med-autofill">
      <p>Все проводящие элементы задания и их физические образы, начальная конфигурация t = 0.
        Полный согласованный контакт считается проводящим, включая прежние MED = −1 / −1.</p>
      <div class="med-toolbar">
        <button type="button" onClick={props.onAnalyze} title="Повторить полный анализ текущих исходных данных">{props.busy?"Начать анализ заново":"Повторить анализ"}</button>
        <button type="button" disabled={props.busy||props.stale||!props.result?.canApply}
          onClick={props.onApply} title="Применить все предлагаемые MED одной операцией с поддержкой Undo/Redo">Применить</button>
        <button type="button" onClick={props.onClose} title="Закрыть окно без применения новых предложений">Закрыть</button>
      </div>
      <Show when={props.busy}><p role="status">Анализ контактов…</p></Show>
      <Show when={props.stale}><p class="med-error" role="alert">Исходные данные изменены. Результат устарел — повторите анализ.</p></Show>
      <Show when={props.error}><p class="med-error" role="alert">{props.error}</p></Show>
      <Show when={props.notice}><p role="status">{props.notice}</p></Show>
      <Show when={props.result}>{result => <>
        <p class="med-counts">Физических контактов: {result().counts.contacts} · Свободных граней исходных записей: {result().counts.freeFaces}
          {" · "}Изменений MED: {result().counts.changedFaces} · Ошибок: {result().counts.errors}</p>
        <Show when={result().gridLevel === "parent"}>
          <p role="status">Иерархическая сетка JWeak1. Контакты проверяются по родительскому
            разбиению; отображаемая сетка ЭО соответствует dp.
            {" "}Уточнённых ШГ: {result().refinedBlocks.length}.</p>
        </Show>
        <p>Разрядность: {result().doubleFloat?"REAL64":"REAL32"}; допуск: {result().tolerance.toExponential(3)} мм.</p>
        <Show when={result().errors.length}><section aria-label="Ошибки MED">
          <h3>Ошибки — применение заблокировано</h3>
          <ul><For each={result().errors}>{e=><li>{e.message}{" "}
            <For each={e.elements}>{block=>link(block,e.faces.find(f=>f.block===block)?.face)}</For>
          </li>}</For></ul>
        </section></Show>
        <h3>Контакты</h3>
        <table><thead><tr><th>Первая грань / образ</th><th>Вторая грань / образ</th><th>MED до → после</th><th>Сетка стыка</th></tr></thead>
          <tbody><For each={result().contacts}>{c=><tr>
            <td>{link(c.a.block,c.a.face)}<small>{c.a.image}</small></td>
            <td>{link(c.b.block,c.b.face)}<small>{c.b.image}</small></td>
            <td>{c.oldA} → {proposed(c.a)}; {c.oldB} → {proposed(c.b)}</td><td>{c.compatible?"Совпадает":"Ошибка"}
              <Show when={c.gridLevel === "parent"}><small>
                Родители: [{c.contactDpA.join(",")}] ↔ [{c.contactDpB.join(",")}];
                {" "}ЭО: [{c.actualDpA.join(",")}] ↔ [{c.actualDpB.join(",")}]
              </small></Show>
            </td>
          </tr>}</For></tbody></table>
        <h3>Предлагаемые изменения</h3>
        <Show when={!props.stale&&!result().changes.length&&!result().errors.length}><p>Изменений MED не требуется.</p></Show>
        <table><thead><tr><th>Исходная запись / грань</th><th>Старое MED</th><th>Предлагаемое MED</th></tr></thead>
          <tbody><For each={result().changes}>{c=><tr><td>{link(c.block,c.face)}</td><td>{c.old??"—"}</td><td>{c.proposed}</td></tr>}</For></tbody>
        </table>
      </>}</Show>
    </div>
  </FloatingWindow>;
}
