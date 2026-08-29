import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const selectionUrl = new URL(
    "../src/components/materials/MaterialSelectionDialog.jsx",
    import.meta.url,
);
const confirmationUrl = new URL(
    "../src/components/materials/MaterialDeleteConfirmationDialog.jsx",
    import.meta.url,
);
const stylesUrl = new URL(
    "../src/components/materials/MaterialSelectionDialog.css",
    import.meta.url,
);

test("material selection dialog puts equal-width apply before cancel", async () => {
    const source = await readFile(selectionUrl, "utf8");
    const styles = await readFile(stylesUrl, "utf8");

    assert.match(source, /material-selection-actions/u);
    assert.match(source, /Назначить[\s\S]*Отмена/u);
    assert.match(
        styles,
        /\.material-selection-actions button\s*\{[^}]*width:\s*120px/su,
    );
});

test("local material deletion uses a modal confirmation component", async () => {
    const source = await readFile(confirmationUrl, "utf8");

    assert.match(source, /role="dialog"/u);
    assert.match(source, /aria-modal="true"/u);
    assert.match(source, /Удалить выбранные характеристики/u);
    assert.match(source, /props\.onConfirm/u);
});
