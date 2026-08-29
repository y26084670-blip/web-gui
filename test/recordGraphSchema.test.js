import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("amplitude and trajectory schemas declare record graph projections", () => {
    return Promise.all([
        readFile(new URL("../src/services/schemas/amps.schema.js", import.meta.url), "utf8"),
        readFile(new URL("../src/services/schemas/moves.schema.js", import.meta.url), "utf8"),
    ]).then(([ampsSource, movesSource]) => {
        assert.match(ampsSource, /defaultMode: "amplitude"/u);
        assert.match(ampsSource, /property: "impuls"/u);
        assert.match(movesSource, /defaultMode: "position"/u);
        assert.match(movesSource, /value: "position"/u);
        assert.match(movesSource, /value: "angle"/u);
        assert.match(movesSource, /label: "Смещение"/u);
        assert.match(movesSource, /label: "Углы"/u);
    });
});
