import { createSignal } from "solid-js";
import { DiagnosticPopup } from "./DiagnosticPopup";
import { diagnosticService } from "../../services/diagnosticService";
import { VALIDATION_LEVELS } from "../../services/schemas/common/constants";

import "./ValidationIndicator.css";

const [popupOpen, setPopupOpen] = createSignal(false);

const TOOLTIPS = {
  [VALIDATION_LEVELS.UNKNOWN]: "Диагностика не выполнялась",
  [VALIDATION_LEVELS.SUCCESS]: "Ошибок не обнаружено",
  [VALIDATION_LEVELS.WARNING]: "Есть предупреждения",
  [VALIDATION_LEVELS.ERROR]: "Обнаружены ошибки",
};

const COLORS = {
  [VALIDATION_LEVELS.UNKNOWN]: "#9e9e9e",
  [VALIDATION_LEVELS.SUCCESS]: "#4caf50",
  [VALIDATION_LEVELS.WARNING]: "#ffb300",
  [VALIDATION_LEVELS.ERROR]: "#f44336",
};

const TITLES = {
  [VALIDATION_LEVELS.UNKNOWN]: "Диагностика не выполнялась",
  [VALIDATION_LEVELS.SUCCESS]: "Ошибок не обнаружено",
  [VALIDATION_LEVELS.WARNING]: "Есть предупреждения",
  [VALIDATION_LEVELS.ERROR]: "Обнаружены ошибки",
};

export function ValidationIndicator() {
  const level = () => diagnosticService.validationLevel();

  function handleClick() {
    setPopupOpen(!popupOpen());
  }

  return (
    <div
      class="validation-indicator"
      style={{ "--diagnostic-color": COLORS[level()] }}
    >
      <div
        title={TOOLTIPS[level()]}
        style={{
          width: "14px",
          height: "14px",
          "border-radius": "50%",
          "background-color": "var(--diagnostic-color)",
          border: "1px solid #666",
          "box-shadow": "0 0 0 2px white",
          cursor: "pointer",
        }}
        onClick={handleClick}
      />

      <DiagnosticPopup open={popupOpen} />
    </div>
  );
}
