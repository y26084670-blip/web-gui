import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { modelService } from "../../services/modelService.js";
import { selectionService } from "../../services/selectionService.js";
import { TABS } from "../../services/schemas/common/constants.js";
import {
  generateTimeSeries,
} from "../../services/generator/timeFunctionModel.js";
import {
  loadFormulaHistory,
  saveFormulaHistory,
} from "../../services/generator/timeFunctionHistoryService.js";
import { TIME_EXPRESSION_HELP } from "../../services/generator/timeFunctionExpression.js";
import "./TimeFunctionGenerator.css";

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function GeneratorPreviewGraph(props) {
  let canvas;
  let chart;
  let renderRevision = 0;

  createEffect(() => {
    const points = props.points ?? [];
    const revision = ++renderRevision;
    chart?.destroy();
    chart = null;
    if (!canvas || points.length === 0) return;

    void import("chart.js/auto").then(({ default: Chart }) => {
      if (revision !== renderRevision || !canvas) return;
      chart = new Chart(canvas, {
        type: "line",
        data: {
          datasets: [{
            label: props.label || "Предпросмотр",
            data: points.map(([x, y]) => ({ x, y })),
            borderColor: "#e59a3a",
            backgroundColor: "#e59a3a",
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 4,
            fill: false,
            parsing: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          normalized: true,
          plugins: {
            legend: { labels: { color: "#dce4ec" } },
          },
          scales: {
            x: {
              type: "linear",
              title: { display: true, text: "Время, сек", color: "#dce4ec" },
              ticks: { color: "#b8c3cd" },
              grid: { color: "rgba(180, 195, 208, .16)" },
            },
            y: {
              type: "linear",
              title: { display: true, text: props.label || "Значение", color: "#dce4ec" },
              ticks: { color: "#b8c3cd" },
              grid: { color: "rgba(180, 195, 208, .16)" },
            },
          },
        },
      });
    }).catch((error) => props.onError?.(errorText(error)));
  });

  onCleanup(() => {
    renderRevision += 1;
    chart?.destroy();
    chart = null;
  });

  return (
    <div class="time-generator-graph">
      <canvas ref={(element) => (canvas = element)} />
      <Show when={(props.points?.length ?? 0) === 0}>
        <div class="time-generator-graph-hint">
          Введите формулу и нажмите «Генерировать»
        </div>
      </Show>
    </div>
  );
}

export function TimeFunctionGenerator(props) {
  const descriptor = props.schema.views.generator;
  const [formula, setFormula] = createSignal("");
  const [formulas, setFormulas] = createSignal([]);
  const [selectedIndices, setSelectedIndices] = createSignal([]);
  const [lastSelectedIndex, setLastSelectedIndex] = createSignal(null);
  const [target, setTarget] = createSignal(descriptor.defaultTarget);
  const [minimumTime, setMinimumTime] = createSignal("0");
  const [maximumTime, setMaximumTime] = createSignal("0");
  const [preview, setPreview] = createSignal(null);
  const [message, setMessage] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [contextMenu, setContextMenu] = createSignal(null);
  let observedTaskHandle = null;
  let rangeTouched = false;

  function targetDefinition(value = target()) {
    return descriptor.targets.find(item => item.value === value);
  }

  function resetForTask(taskHandle) {
    observedTaskHandle = taskHandle;
    rangeTouched = false;
    setFormula("");
    setFormulas([]);
    setSelectedIndices([]);
    setLastSelectedIndex(null);
    setTarget(descriptor.defaultTarget);
    setMinimumTime("0");
    setMaximumTime("0");
    setPreview(null);
    setContextMenu(null);
  }

  createEffect(() => {
    const taskHandle = selectionService.loadedTaskHandle();
    if (taskHandle !== observedTaskHandle) resetForTask(taskHandle);
  });

  createEffect(() => {
    modelService.getModelPartUpdate(TABS.GENERAL.id)?.revision;
    const general = modelService.getModel()[TABS.GENERAL.id];
    if (rangeTouched || !general) return;
    const intervals = Number(general.countTimeSteps);
    const step = Number(general.timeStep);
    if (Number.isFinite(intervals) && Number.isFinite(step)) {
      setMaximumTime(String(Math.max(0, intervals * step)));
    }
  });

  onMount(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    onCleanup(() => window.removeEventListener("pointerdown", close));
  });

  function showError(error) {
    setMessage(errorText(error));
  }

  function handleGenerate() {
    try {
      const general = modelService.getModel()[TABS.GENERAL.id];
      if (!general) {
        throw new Error("Сначала загрузите общие параметры задания.");
      }
      const points = generateTimeSeries({
        expression: formula(),
        countTimeSteps: general.countTimeSteps,
        timeStep: general.timeStep,
        minimumTime: minimumTime(),
        maximumTime: maximumTime(),
      });
      const targetItem = targetDefinition();
      setPreview({
        points,
        target: targetItem.value,
        label: targetItem.label,
      });
    } catch (error) {
      showError(error);
    }
  }

  async function handleApply() {
    const generated = preview();
    if (!generated) return;
    try {
      await props.onApply?.({
        targetValue: generated.target,
        points: generated.points,
      });
    } catch (error) {
      showError(error);
    }
  }

  function addCurrentFormula() {
    const value = formula();
    if (!value.trim()) {
      showError("Нельзя добавить пустую формулу.");
      return;
    }
    setFormulas(items => [...items, value]);
  }

  function insertSelectedFormula() {
    const selected = new Set(selectedIndices());
    let index = lastSelectedIndex();
    if (!selected.has(index)) index = selectedIndices().at(-1);
    if (!Number.isInteger(index) || formulas()[index] === undefined) return;
    setFormula(formulas()[index]);
  }

  function deleteSelectedFormulas() {
    const selected = new Set(selectedIndices());
    setFormulas(items => items.filter((_item, index) => !selected.has(index)));
    setSelectedIndices([]);
    setLastSelectedIndex(null);
  }

  async function saveHistory() {
    setBusy(true);
    try {
      await saveFormulaHistory({
        taskHandle: selectionService.loadedTaskHandle(),
        fileName: descriptor.historyFile,
        formulas: formulas(),
      });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function restoreHistory() {
    setBusy(true);
    try {
      const restored = await loadFormulaHistory({
        taskHandle: selectionService.loadedTaskHandle(),
        fileName: descriptor.historyFile,
      });
      setFormulas(restored);
      setSelectedIndices([]);
      setLastSelectedIndex(null);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  function updateSelection(event) {
    setSelectedIndices(
      [...event.currentTarget.selectedOptions].map(option => Number(option.value)),
    );
  }

  function handleHistoryClick(event) {
    const option = event.target.closest?.("option");
    if (option) setLastSelectedIndex(Number(option.value));
  }

  function openContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    const option = event.target.closest?.("option");
    if (option) {
      const index = Number(option.value);
      setLastSelectedIndex(index);
      if (!option.selected) {
        setSelectedIndices([index]);
      }
    }
    setContextMenu({ x: event.clientX, y: event.clientY });
  }

  function menuAction(action) {
    return () => {
      setContextMenu(null);
      void Promise.resolve(action()).catch(showError);
    };
  }

  return (
    <div class="time-generator">
      <GeneratorPreviewGraph
        points={preview()?.points ?? []}
        label={preview()?.label ?? targetDefinition()?.label}
        onError={showError}
      />

      <div class="time-generator-workspace">
        <section class="time-generator-history">
          <div class="time-generator-section-title">
            История формул
          </div>
          <select
            multiple
            size="10"
            disabled={busy()}
            aria-label="История формул"
            onChange={updateSelection}
            onClick={handleHistoryClick}
            onContextMenu={openContextMenu}
          >
            <For each={formulas()}>
              {(item, index) => (
                <option value={index()} title={item}>
                  {item.replace(/\s+/gu, " ").trim()}
                </option>
              )}
            </For>
          </select>
          <div class="time-generator-history-hint">
            Команды доступны по правому щелчку
          </div>
        </section>

        <section class="time-generator-editor">
          <Show when={descriptor.targets.length > 1}>
            <label class="time-generator-target">
              <span>Величина</span>
              <select
                value={target()}
                onChange={(event) => setTarget(event.currentTarget.value)}
              >
                <For each={descriptor.targets}>
                  {(item) => <option value={item.value}>{item.label}</option>}
                </For>
              </select>
            </label>
          </Show>

          <textarea
            value={formula()}
            spellcheck={false}
            aria-label="Формула временной зависимости"
            placeholder={"f=50\nomega=2*pi*f\nres=sin(omega*t)"}
            onInput={(event) => setFormula(event.currentTarget.value)}
          />

          <div class="time-generator-help">
            t — время, сек; константы: {TIME_EXPRESSION_HELP.constants.join(", ")};
            степени задаются оператором ^
          </div>

          <div class="time-generator-range">
            <label>
              <span>Начало действия, сек</span>
              <input
                type="number"
                step="any"
                value={minimumTime()}
                onInput={(event) => {
                  rangeTouched = true;
                  setMinimumTime(event.currentTarget.value);
                }}
              />
            </label>
            <label>
              <span>Конец действия, сек</span>
              <input
                type="number"
                step="any"
                value={maximumTime()}
                onInput={(event) => {
                  rangeTouched = true;
                  setMaximumTime(event.currentTarget.value);
                }}
              />
            </label>
          </div>

          <div class="time-generator-actions">
            <button
              disabled={!selectionService.loadedTaskHandle() || busy()}
              onClick={handleGenerate}
            >
              Генерировать
            </button>
            <button
              disabled={!preview() || !selectionService.loadedTaskHandle() || busy()}
              onClick={handleApply}
            >
              Применить
            </button>
          </div>
        </section>
      </div>

      <Show when={contextMenu()}>
        <div
          class="time-generator-context-menu"
          role="menu"
          style={{ left: `${contextMenu().x}px`, top: `${contextMenu().y}px` }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button role="menuitem" onClick={menuAction(addCurrentFormula)}>
            Добавить текущую формулу
          </button>
          <button
            role="menuitem"
            disabled={selectedIndices().length === 0}
            onClick={menuAction(insertSelectedFormula)}
          >
            Вставить выбранную формулу
          </button>
          <hr />
          <button
            role="menuitem"
            disabled={selectedIndices().length === 0}
            onClick={menuAction(deleteSelectedFormulas)}
          >
            Удалить выделенные формулы
          </button>
          <hr />
          <button role="menuitem" disabled={busy()} onClick={menuAction(saveHistory)}>
            Сохранить список
          </button>
          <button role="menuitem" disabled={busy()} onClick={menuAction(restoreHistory)}>
            Восстановить список
          </button>
        </div>
      </Show>

      <Show when={message()}>
        <div class="time-generator-dialog-backdrop" role="presentation">
          <section
            class="time-generator-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Ошибка генератора"
          >
            <div class="time-generator-dialog-title">Генерация не выполнена</div>
            <div class="time-generator-dialog-message">{message()}</div>
            <button onClick={() => setMessage("")}>Закрыть</button>
          </section>
        </div>
      </Show>
    </div>
  );
}
