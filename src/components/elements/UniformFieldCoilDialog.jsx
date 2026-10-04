import {createMemo,createSignal,For,Show} from "solid-js";
import {FloatingWindow} from "../window/FloatingWindow.jsx";
import {uniformFieldCoilParameters} from "../../services/generator/uniformFieldCoil.js";
import "./UniformFieldCoilDialog.css";

export function UniformFieldCoilDialog(props) {
  const [params,setParams]=createSignal({name:"Катушка однородного поля",H0:1,radius:10,direction:[1,0,0],amplitude:0,move:0});
  const change=(key,value)=>setParams(old=>({...old,[key]:value}));
  const analysis=createMemo(()=>{
    try{return {values:uniformFieldCoilParameters(params(),props.model)};}
    catch(error){return {error:error.message};}
  });
  const number=v=>Number.isFinite(v)?v.toLocaleString("ru-RU",{maximumSignificantDigits:7}):"—";
  return <FloatingWindow open={props.open} title="Катушка однородного поля" initialWidth={650} initialHeight={580}
    minWidth={450} minHeight={350} storageKey="web-gui:uniform-field-coil" onClose={props.onClose}>
    <div class="uniform-field-coil">
      <label>Название <input value={params().name} onInput={e=>change("name",e.currentTarget.value)} disabled={props.busy}/></label>
      <div class="coil-input-row">
        <label>H0, кА/м <input type="number" min="0" step="any" value={params().H0} onInput={e=>change("H0",e.currentTarget.valueAsNumber)} disabled={props.busy}/></label>
        <label>R, мм <input type="number" min="0" step="any" value={params().radius} onInput={e=>change("radius",e.currentTarget.valueAsNumber)} disabled={props.busy}/></label>
      </div>
      <fieldset disabled={props.busy}><legend>Направление поля — ненулевой вектор</legend><div class="coil-input-row">
        <For each={["X","Y","Z"]}>{(name,index)=><label>{name}<input type="number" step="any" value={params().direction[index()]}
          onInput={e=>change("direction",params().direction.map((v,i)=>i===index()?e.currentTarget.valueAsNumber:v))}/></label>}</For>
      </div></fieldset>
      <div class="coil-input-row">
        <label>Номер амплитуды <input type="number" min="0" step="1" value={params().amplitude} onInput={e=>change("amplitude",e.currentTarget.valueAsNumber)} disabled={props.busy}/></label>
        <label>Номер траектории <input type="number" min="0" step="1" value={params().move} onInput={e=>change("move",e.currentTarget.valueAsNumber)} disabled={props.busy}/></label>
      </div>
      <p>Центр — (0, 0, 0). Номер 0: постоянная амплитуда / без движения.</p>
      <Show when={analysis().values}>{values=><>
        <p>R1 = {number(values().r1)} мм · T = 10 мм · L = {number(values().length)} мм<br/>j0 = {number(values().j0)} А/мм² · 72 локальных образа</p>
        <table><caption>Аналитическая оценка на оси, при единичном множителе амплитуды</caption>
          <thead><tr><th>Положение</th><th>H, кА/м</th><th>Отклонение от H(0), %</th></tr></thead>
          <tbody><tr><td>0</td><td>{number(values().field0)}</td><td>0</td></tr>
            <tr><td>R = {number(values().radius)} мм</td><td>{number(values().fieldR)}</td><td>{number(values().relativeDeviation)}</td></tr></tbody>
        </table>
        <p>Неоднородность |H(R) − H(0)| / |H(0)| = {number(values().nonuniformity)}%. Оценка непрерывной катушки; проверка поля во всей сфере не выполняется.</p>
        <Show when={values().H0===0}><p>При H0 = 0 относительная погрешность не определена.</p></Show>
      </>}</Show>
      <Show when={analysis().error||props.error}><p class="coil-error" role="alert">{String(analysis().error||props.error).startsWith("ERROR:")?"":"ERROR: "}{analysis().error||props.error}</p></Show>
      <Show when={props.notice}><p role="status">{props.notice}</p></Show>
      <div class="coil-actions"><button disabled={props.busy||!!analysis().error} onClick={()=>props.onApply(params())}>Добавить катушку</button>
        <button onClick={props.onClose}>Закрыть</button></div>
    </div>
  </FloatingWindow>;
}
