import { For, createEffect, onCleanup } from "solid-js";
import "./GeneralInformationDialog.css";

const units = [
  ["Линейные размеры", "мм"],
  ["Площади", "мм²"],
  ["Объёмы", "мм³"],
  ["Время", "сек"],
  ["Плотность тока", "А/мм²"],
  ["Намагниченность, напряжённость магнитного поля", "кА/м"],
  ["Индукция", "Т"],
  ["Удельная электропроводность", "МСм/м"],
  ["Потокосцепление", "мВб"],
  ["Силы", "Н"],
  ["Момент", "Н·м"],
];

export function GeneralInformationDialog(props) {
  let dialog;
  let closeButton;
  let content;

  createEffect(() => {
    if (!dialog) return;
    if (props.open) {
      if (!dialog.open) {
        dialog.showModal();
        content.scrollTop = 0;
        closeButton?.focus({ preventScroll: true });
      }
    } else if (dialog.open) {
      dialog.close();
    }
  });

  onCleanup(() => {
    if (dialog?.open) dialog.close();
  });

  return (
    <dialog
      ref={(el) => (dialog = el)}
      class="general-information-dialog"
      aria-labelledby="general-information-title"
      onClose={() => props.onClose?.()}
    >
      <header class="general-information-header">
        <h2 id="general-information-title">Общая информация</h2>
      </header>

      <div
        ref={(el) => (content = el)}
        class="general-information-content"
        role="region"
        aria-label="Содержание справки"
        tabindex="0"
      >
        <section aria-labelledby="general-information-selection">
          <h3 id="general-information-selection">1. Выбор и предпросмотр</h3>
          <p>
            Если режим администратора не включён по паролю в панели
            «О программе», доступ к проектам открывается в фиксированной
            папке <strong>clark.projects</strong>. Ищите её на диске, где
            установлен решатель.
          </p>
          <p>
            В сборках с кнопкой <strong>«Развернуть примеры»</strong> в панели
            «О программе» проекты можно также распаковать независимо.
          </p>
          <p>
            Редактор использует двухуровневую систему каталогов:
            <strong> проекты → задания</strong>. Так организованы и примеры:
            сначала выберите проект, затем задание внутри него.
          </p>
          <ul>
            <li>
              <strong>Выбор задания</strong> щелчком в списке показывает его
              исходную 3D-геометрию, без симметричных образов.
            </li>
            <li>
              <strong>«Загрузить для редактирования»</strong> открывает задание
              для изменения данных. Если в уже загруженном задании есть
              несохранённые изменения, появится предупреждение с вариантами
              дальнейших действий.
            </li>
          </ul>
        </section>

        <section aria-labelledby="general-information-interface">
          <h3 id="general-information-interface">2. Помощь при работе с интерфейсом</h3>
          <p>
            Справка по параметрам колонки находится во всплывающей подсказке
            её заголовка. Подсказки также предусмотрены у других элементов
            интерфейса, когда требуется пояснение.
          </p>
          <p>
            Кнопка <strong>«Дополнительные функции»</strong> открывает
            выдвижное меню слева. В нём доступны:
          </p>
          <ul>
            <li>
              <strong>«История текущей вкладки»</strong> — отмена и повтор
              изменений (undo/redo), отдельно для каждой вкладки.
            </li>
            <li>
              <strong>Действия текущей вкладки.</strong> На вкладке
              «Элементы модели» можно назначать характеристики элементам,
              выделенным в списке.
            </li>
          </ul>
          <p>
            На вкладках <strong>«Амплитуды»</strong> и
            <strong> «Траектории»</strong> встроены генераторы временных
            зависимостей по аналитическим формулам с просмотром графиков.
            Набор формул можно редактировать и сохранять в задании в простом
            текстовом файле для последующего использования.
          </p>
        </section>

        <section aria-labelledby="general-information-units">
          <h3 id="general-information-units">3. Используемые размерности</h3>
          <table class="general-information-units">
            <thead>
              <tr>
                <th scope="col">Величина</th>
                <th scope="col">Единица</th>
              </tr>
            </thead>
            <tbody>
              <For each={units}>
                {([quantity, unit]) => (
                  <tr>
                    <th scope="row">{quantity}</th>
                    <td>{unit}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </section>
      </div>

      <footer class="general-information-footer">
        <button
          ref={(el) => (closeButton = el)}
          type="button"
          class="general-information-close-button"
          onClick={() => dialog.close()}
        >
          Закрыть
        </button>
      </footer>
    </dialog>
  );
}
