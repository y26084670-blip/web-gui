import assert from "node:assert/strict";
import test from "node:test";

import {
    applyGeneratedSeries,
    generateTimeSeries,
    timeGrid,
} from "../src/services/generator/timeFunctionModel.js";

test("time grid contains interval endpoints and range zeroes values outside", () => {
    assert.deepEqual(
        timeGrid({ countTimeSteps: 3, timeStep: 0.5 }),
        [0, 0.5, 1, 1.5],
    );
    assert.deepEqual(
        generateTimeSeries({
            expression: "2t",
            countTimeSteps: 3,
            timeStep: 0.5,
            minimumTime: 0.5,
            maximumTime: 1,
        }),
        [[0, 0], [0.5, 1], [1, 2], [1.5, 0]],
    );
});

test("trajectory generation preserves other components and synchronizes both tables", () => {
    const schema = {
        properties: {
            angle: { nColumns: 4 },
            position: { nColumns: 4 },
        },
        views: {
            generator: {
                synchronizedProperties: ["angle", "position"],
                targets: [{
                    value: "positionY",
                    property: "position",
                    column: 2,
                }],
            },
        },
    };
    const record = {
        angle: [[0, 1, 2, 3], [1, 4, 5, 6]],
        position: [[0, 7, 8, 9], [1, 10, 11, 12]],
    };

    const patch = applyGeneratedSeries({
        schema,
        record,
        targetValue: "positionY",
        points: [[0, 100], [1, 200], [2, 300]],
    });

    assert.deepEqual(patch.position, [
        [0, 7, 100, 9],
        [1, 10, 200, 12],
        [2, 0, 300, 0],
    ]);
    assert.deepEqual(patch.angle, [
        [0, 1, 2, 3],
        [1, 4, 5, 6],
        [2, 0, 0, 0],
    ]);
    assert.deepEqual(record.position[0], [0, 7, 8, 9]);
});

test("generator rejects invalid time configuration", () => {
    assert.throws(
        () => timeGrid({ countTimeSteps: 2, timeStep: 0 }),
        /положительным/u,
    );
    assert.throws(
        () => generateTimeSeries({
            expression: "t",
            countTimeSteps: 1,
            timeStep: 1,
            minimumTime: 2,
            maximumTime: 1,
        }),
        /не должно превышать/u,
    );
});
