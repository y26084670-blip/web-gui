import { For, createEffect, createSignal, onCleanup } from "solid-js";
import aboutIconUrl from "../../assets/zaica.BMP";
import projectSelectionUrl from "../../assets/help/project-selection.png";
import taskSelectionUrl from "../../assets/help/task-selection.png";
import { ExamplesInstaller } from "./ExamplesInstaller";
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
  const [installerOpen, setInstallerOpen] = createSignal(false);

  createEffect(() => {
    if (!dialog) return;
    setInstallerOpen(Boolean(props.open));
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
      onCancel={() => setInstallerOpen(false)}
      onClose={() => {
        setInstallerOpen(false);
        props.onClose?.();
      }}
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
        <section aria-labelledby="general-information-installation">
          <h3 id="general-information-installation">1. Установка примеров и решателя</h3>
          <p>
            Знакомство с редактором рекомендуется начать с установки примеров.
            Кнопка «Скачать установщик решателя» открывает в новой вкладке
            облачный каталог с актуальной версией. Выберите там установочный
            файл и скачайте его средствами облачного сервиса.
          </p>
          <ExamplesInstaller open={installerOpen()} />
          <p>
            Для установки решателя на Windows x86-64 запустите самораспаковывающийся
            файл <code>ClarkInstaller-&lt;версия&gt;.exe</code> и выберите корень
            внутреннего стационарного диска
            (по умолчанию <code>D:\</code>). Установщик создаст
            каталог <code>clark.app</code> и четыре ярлыка в папке
            «Clark» на рабочем столе. Для запуска решателя следует кинуть
            подготовленный список на ярлык «Запуск расчета» в папке Clark.
            Но более удобно запустить ярлык обычным способом (двойным щелчком).
            При этом откроется стандартный диалог выбора нужного файла
            со списком заданий.
            <br />
            Полная функциональность редактора гарантируется для браузеров
            Google Chrome или Microsoft Edge.
          </p>
          <p>
            В файле <code>clark.app\config\runtime.json</code> задайте
            параметр <code>mpiRanks</code> равным числу физических ядер компьютера.
            {" При установке по умолчанию задано 4 параллельных процесса."}
          </p>
        </section>

        <section aria-labelledby="general-information-selection">
          <h3 id="general-information-selection">2. Выбор и предпросмотр</h3>
          <p>
            Если режим администратора не включён по паролю в панели
            {" «О программе» "}
            <span
              class="general-information-sample general-information-about-sample"
              role="img"
              aria-label="Значок панели «О программе»"
            >
              <img src={aboutIconUrl} alt="" draggable={false} />
            </span>
            , доступ к проектам открывается в фиксированной
            папке <strong>clark.projects</strong>.
          </p>
          <p>
            Редактор использует двухуровневую систему каталогов:
            <strong> проекты → задания</strong>. Так организованы и примеры.
          </p>
          <table class="general-information-selection-table">
            <thead>
              <tr>
                <th scope="col">сначала выберите проект</th>
                <th scope="col">затем выберите задание</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <img
                    class="general-information-project-image"
                    src={projectSelectionUrl}
                    alt="Выбор проекта в списке проектов"
                    width="289"
                    height="147"
                    draggable={false}
                  />
                </td>
                <td>
                  <img
                    class="general-information-task-image"
                    src={taskSelectionUrl}
                    alt="Выбор задания в списке заданий выбранного проекта"
                    width="292"
                    height="147"
                    draggable={false}
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <ul>
            <li>
              Выбор задания щелчком в списке показывает его
              {" "}
              исходную 3D-геометрию, без симметричных образов.
            </li>
            <li>
              <span
                class="task-load-button general-information-sample general-information-load-sample"
                role="img"
                aria-label="Кнопка «Загрузить для редактирования»"
              >
                Загрузить для редактирования
              </span>
              {" открывает задание "}
              для изменения данных. Если в уже загруженном задании есть
              несохранённые изменения, появится предупреждение с вариантами
              дальнейших действий.
            </li>
          </ul>
        </section>

        <section aria-labelledby="general-information-interface">
          <h3 id="general-information-interface">3. Помощь при работе с интерфейсом</h3>
          <p>
            Справка по параметрам колонки находится во всплывающей подсказке
            её заголовка. Подсказки также предусмотрены у других элементов
            интерфейса, когда требуется пояснение.
          </p>
          <p>
            Геометрию загруженного задания с показом симметрий, дискретизации
            и других деталей можно посмотреть в плавающем окне при нажатии
            кнопки 3D{" "}
            <span
              class="geometry-button general-information-sample general-information-geometry-sample"
              role="img"
              aria-label="Кнопка «3D»"
            >
              3D
            </span>
            .
          </p>
          <p>
            Кнопка <strong>«Дополнительные функции»</strong>{" "}
            <span
              class="menu-button general-information-sample general-information-menu-sample"
              role="img"
              aria-label="Значок кнопки «Дополнительные функции»"
            >
              ☰
            </span>
            {" открывает "}
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
          <h3 id="general-information-units">4. Используемые размерности</h3>
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
        <label class="general-information-startup-option">
          <input
            type="checkbox"
            checked={props.openAtStartup}
            onChange={(event) => props.onOpenAtStartupChange?.(event.currentTarget.checked)}
          />
          <span>Открывать эту панель при старте</span>
        </label>
        <button
          ref={(el) => (closeButton = el)}
          type="button"
          class="general-information-close-button"
          onClick={() => {
            setInstallerOpen(false);
            dialog.close();
          }}
        >
          Закрыть
        </button>
      </footer>
    </dialog>
  );
}
