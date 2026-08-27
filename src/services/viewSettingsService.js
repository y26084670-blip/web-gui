import { createSignal } from "solid-js";

export const COMPUTED_COLUMN_MODES = Object.freeze({
    SCHEMA: "schema",
    SHOW: "show",
    HIDE: "hide",
});

const [computedColumnsMode, setComputedColumnsModeSignal] = createSignal(
    COMPUTED_COLUMN_MODES.SCHEMA,
);

function setComputedColumnsMode(mode) {
    if (!Object.values(COMPUTED_COLUMN_MODES).includes(mode)) {
        throw new Error(`Unknown computed-column mode: '${mode}'`);
    }

    setComputedColumnsModeSignal(mode);
}

function isComputedColumnVisible(
    hidden = false,
    mode = computedColumnsMode(),
) {
    if (mode === COMPUTED_COLUMN_MODES.SHOW) return true;
    if (mode === COMPUTED_COLUMN_MODES.HIDE) return false;
    return hidden !== true;
}

export const viewSettingsService = {
    computedColumnsMode,
    setComputedColumnsMode,
    isComputedColumnVisible,
};
