import assert from "node:assert/strict";
import test from "node:test";

import {
    DEFAULT_OBJECT_MODES,
    DEFAULT_SYMMETRY_FILTERS,
    GEOMETRY_SOURCE_CATEGORIES,
    OBJECT_VISIBILITY_MODES,
    instanceVisible,
    primitiveVisible,
    sourceCategory,
} from "../src/services/visualization/geometryRenderFilters.js";

function primitive(schemaId, recordIndex = 0) {
    return {
        source: {
            schemaId,
            recordIndex,
        },
    };
}

test("sourceCategory recognizes scene primitives and source DTOs", () => {
    assert.equal(
        sourceCategory(primitive("elements")),
        GEOMETRY_SOURCE_CATEGORIES.ELEMENTS,
    );
    assert.equal(
        sourceCategory({ schemaId: "regions" }),
        GEOMETRY_SOURCE_CATEGORIES.REGIONS,
    );
    assert.equal(sourceCategory(primitive("general")), null);
    assert.equal(sourceCategory(null), null);
});

test("primitiveVisible defaults both supported object categories to all", () => {
    assert.equal(primitiveVisible(primitive("elements", 4)), true);
    assert.equal(primitiveVisible(primitive("regions", 7)), true);
    assert.equal(DEFAULT_OBJECT_MODES.elements, OBJECT_VISIBILITY_MODES.ALL);
    assert.equal(DEFAULT_OBJECT_MODES.regions, OBJECT_VISIBILITY_MODES.ALL);
    assert.equal(primitiveVisible(primitive("general")), false);
});

test("primitiveVisible applies independent all and none modes", () => {
    const modes = {
        elements: OBJECT_VISIBILITY_MODES.NONE,
        regions: OBJECT_VISIBILITY_MODES.ALL,
    };

    assert.equal(primitiveVisible(primitive("elements"), modes), false);
    assert.equal(primitiveVisible(primitive("regions"), modes), true);
});

test("selected mode uses zero-based record indices from sets or arrays", () => {
    const modes = {
        elements: OBJECT_VISIBILITY_MODES.SELECTED,
        regions: OBJECT_VISIBILITY_MODES.SELECTED,
    };
    const selections = {
        elements: new Set([0, 2]),
        regions: [1, 3],
    };

    assert.equal(
        primitiveVisible(primitive("elements", 0), modes, selections),
        true,
    );
    assert.equal(
        primitiveVisible(primitive("elements", 1), modes, selections),
        false,
    );
    assert.equal(
        primitiveVisible(primitive("regions", 3), modes, selections),
        true,
    );
    assert.equal(
        primitiveVisible(primitive("regions", 2), modes, selections),
        false,
    );
});

test("selected mode rejects missing or invalid source indices", () => {
    const modes = { elements: OBJECT_VISIBILITY_MODES.SELECTED };
    const selections = { elements: new Set([0]) };

    assert.equal(
        primitiveVisible(primitive("elements", -1), modes, selections),
        false,
    );
    assert.equal(
        primitiveVisible(primitive("elements", 0.5), modes, selections),
        false,
    );
    assert.equal(
        primitiveVisible({ source: { schemaId: "elements" } }, modes, selections),
        false,
    );
});

test("unknown object mode fails closed while omitted categories use defaults", () => {
    assert.equal(
        primitiveVisible(primitive("elements"), { elements: "future" }),
        false,
    );
    assert.equal(
        primitiveVisible(primitive("regions"), { elements: "none" }),
        true,
    );
});

test("instanceVisible defaults every symmetry kind to visible", () => {
    const combined = {
        ls: 1,
        as: 2,
        ps: 3,
        mirrorX: 1,
        mirrorY: 1,
    };

    assert.equal(instanceVisible(combined), true);
    assert.deepEqual(DEFAULT_SYMMETRY_FILTERS, {
        local: true,
        axial: true,
        periodic: true,
        mirror: true,
    });
});

test("original instance remains visible with every symmetry filter disabled", () => {
    const hidden = {
        local: false,
        axial: false,
        periodic: false,
        mirror: false,
    };

    assert.equal(instanceVisible({
        ls: 0,
        as: 0,
        ps: 0,
        mirrorX: 0,
        mirrorY: 0,
    }, hidden), true);
    assert.equal(instanceVisible({}, hidden), true);
});

test("each symmetry filter independently hides only its generated images", () => {
    const cases = [
        ["local", { ls: 1 }],
        ["axial", { as: 1 }],
        ["periodic", { ps: 1 }],
        ["mirror", { mirrorX: 1 }],
        ["mirror", { mirrorY: 1 }],
    ];

    for (const [filterName, instance] of cases) {
        assert.equal(
            instanceVisible(instance, { [filterName]: false }),
            false,
            filterName,
        );
        assert.equal(
            instanceVisible(instance, { [filterName]: true }),
            true,
            filterName,
        );
    }
});

test("combined symmetry image requires every corresponding filter", () => {
    const combined = {
        ls: 1,
        as: 1,
        ps: 1,
        mirrorX: 1,
        mirrorY: 0,
    };

    for (const filterName of ["local", "axial", "periodic", "mirror"]) {
        assert.equal(
            instanceVisible(combined, { [filterName]: false }),
            false,
            filterName,
        );
    }

    assert.equal(instanceVisible(combined, {
        local: true,
        axial: true,
        periodic: true,
        mirror: true,
    }), true);
});

test("only positive symmetry indices classify an instance as an image", () => {
    const disabled = {
        local: false,
        axial: false,
        periodic: false,
        mirror: false,
    };

    assert.equal(instanceVisible({
        ls: -1,
        as: Number.NaN,
        ps: undefined,
        mirrorX: false,
        mirrorY: -1,
    }, disabled), true);
});
