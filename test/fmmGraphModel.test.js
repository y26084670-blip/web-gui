import assert from "node:assert/strict";
import test from "node:test";

import {
    fmmGraphConfig,
    fmmGraphDatasets,
} from "../src/services/materials/fmmGraphModel.js";

test("selected FMM records become one H-M line dataset each", () => {
    const records = [
        { name: "A", tabl: [[1, 10], [2, 20]] },
        { name: "B", tabl: [[3, 30], [4, 40]] },
    ];
    const datasets = fmmGraphDatasets(records);

    assert.equal(datasets.length, 2);
    assert.equal(datasets[0].label, "A");
    assert.deepEqual(datasets[0].data, [{ x: 1, y: 10 }, { x: 2, y: 20 }]);
    assert.notEqual(datasets[0].borderColor, datasets[1].borderColor);
    assert.equal(fmmGraphConfig(records).options.scales.x.type, "linear");
});

test("malformed FMM graph rows fail before Chart creation", () => {
    assert.throws(
        () => fmmGraphDatasets([{ name: "A", tabl: [[1, Number.NaN]] }]),
        /некорректна/,
    );
});
