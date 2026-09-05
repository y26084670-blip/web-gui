import assert from "node:assert/strict";
import test from "node:test";

import {
    collectModelConstraintDiagnostics,
    countSchemaConstraintViolations,
    schemaConstraintDiagnostics,
} from "../src/services/modelConstraintDiagnostics.js";
import {
    FIELD_TYPES,
    STORAGE_TYPES,
    VALIDATION_LEVELS,
} from "../src/services/schemas/common/constants.js";

function recordsSchema() {
    return {
        id: "elements",
        title: "Элементы модели",
        config: {
            storage: STORAGE_TYPES.RECORDS,
        },
        properties: {
            images: {
                type: FIELD_TYPES.INTEGER,
                minimum: 1,
            },
            dp: {
                type: FIELD_TYPES.ARRAY,
                items: {
                    type: FIELD_TYPES.INTEGER,
                    minimum: 1,
                },
            },
            integerWithoutLimits: {
                type: FIELD_TYPES.ARRAY,
                items: {
                    type: FIELD_TYPES.INTEGER,
                },
            },
            floatDetails: {
                type: FIELD_TYPES.ARRAY,
                items: {
                    type: FIELD_TYPES.FLOAT,
                    minimum: 10,
                },
            },
        },
    };
}

test("loaded constraints include integer details and scalar fields", () => {
    const schema = recordsSchema();
    const model = [
        {
            images: 0,
            dp: [[1], [0], [-1]],
            integerWithoutLimits: [[-100]],
            floatDetails: [[0]],
        },
        {
            images: 1,
            dp: [[1], [1], [1]],
            integerWithoutLimits: [[-200]],
            floatDetails: [[0]],
        },
    ];

    assert.equal(countSchemaConstraintViolations(schema, model), 3);
});

test("cluster scalar constraints are counted without a table instance", () => {
    const schema = {
        id: "general",
        title: "Общие параметры",
        config: {
            storage: STORAGE_TYPES.CLUSTER,
        },
        properties: {
            time: {
                type: FIELD_TYPES.FLOAT,
                exclusiveMinimum: 0,
            },
            name: {
                type: FIELD_TYPES.STRING,
                minLength: 2,
            },
        },
    };

    assert.equal(
        countSchemaConstraintViolations(schema, {
            time: 0,
            name: "x",
        }),
        2,
    );
});

test("constraint summary is one exact line without row localization", () => {
    const schema = recordsSchema();
    const diagnostics = schemaConstraintDiagnostics(schema, [{
        images: 0,
        dp: [[1], [0], [-1]],
        integerWithoutLimits: [],
        floatDetails: [],
    }]);

    assert.deepEqual(diagnostics, [{
        level: VALIDATION_LEVELS.ERROR,
        tab: undefined,
        row: undefined,
        property: undefined,
        message: "Вкладка: Элементы модели - нарушений ограничений: 3",
        presentation: "constraint-summary",
    }]);
});

test("one invalid value counts once even when it breaks several constraints", () => {
    const schema = recordsSchema();
    schema.properties.dp.items.multipleOf = 2;

    assert.equal(countSchemaConstraintViolations(schema, [{
        images: 1,
        dp: [[-1], [2], [4]],
    }]), 1);
});

test("full refresh replaces per-tab summaries including fixed tabs", () => {
    const elements = recordsSchema();
    const regions = {
        ...recordsSchema(),
        id: "regions",
        title: "Области наблюдения",
    };
    const result = collectModelConstraintDiagnostics(
        [elements, regions],
        {
            elements: [{
                images: 1,
                dp: [[1], [1], [1]],
                integerWithoutLimits: [],
                floatDetails: [],
            }],
            regions: [{
                images: 0,
                dp: [[1], [1]],
                integerWithoutLimits: [],
                floatDetails: [],
            }],
        },
    );

    assert.deepEqual(result.elements, []);
    assert.equal(result.regions.length, 1);
    assert.equal(
        result.regions[0].message,
        "Вкладка: Области наблюдения - нарушений ограничений: 1",
    );
});
