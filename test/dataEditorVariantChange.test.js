import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";
import { STORAGE_TYPES, VALIDATION_LEVELS } from "../src/services/schemas/common/constants.js";
import { applyVariantChange } from "../src/services/model/variantChange.js";
import { resetKvGeo, unpackKvVertices, validateKvVertices } from "../src/services/solver/geometryKv.js";
import { validateConstraintValue } from "../src/tabulator/validators/types/constraintValidator.js";
import { schemaConstraintDiagnostics } from "../src/services/modelConstraintDiagnostics.js";

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: "custom",
    optimizeDeps: {noDiscovery: true, include: []} });
after(() => server.close());
const { default: schema } = await server.ssrLoadModule("/src/services/schemas/elements.schema.js");
const { dataService } = await server.ssrLoadModule("/src/services/dataService.js");
const { modelService } = await server.ssrLoadModule("/src/services/modelService.js");
const { modelToRows, rowsToModel } = await server.ssrLoadModule("/src/tabulator/converters/modelConverter.js");
const source = readFileSync(new URL("../src/components/editors/DataEditor.jsx", import.meta.url), "utf8");
const actualFunction = name => {
    const match = source.match(new RegExp(`  function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`));
    assert.ok(match, `actual DataEditor handler ${name}`);
    return match[0];
};

// Run the actual edit handlers and real conversion/model/history services.
// Tabulator's table.getData() clones values, while RowComponent.getData()
// returns its internal record. Row order here is deliberately source order.
const bindEditor = new Function("dependencies", `
    const {schema, table, rowsToModel, applyVariantChange, modelService, STORAGE_TYPES} = dependencies;
    const modelSource = Symbol("test-editor");
    const hasRecordColumns = false, referenceEntries = [];
    let applyingModel = false, changingStructure = false, pendingCellChange = null;
    const detailRegion = {clearIfSourceMissing() {}};
    const syncSelectedGraphRecords = () => {};
    const applyComputedPatches = () => true;
    ${actualFunction("captureCellChange")}
    ${actualFunction("handleTableChanged")}
    ${actualFunction("publishTableChanged")}
    return {captureCellChange, handleTableChanged, pending: () => pendingCellChange};
`);

function record(type = 0, name = "Элемент") {
    const result = dataService.createDefaultRecord(schema);
    result.name = name;
    result.geoType = type;
    const flat = resetKvGeo(type).map(value => value + 7);
    result.geo = Array.from({length: 8}, (_, i) => flat.slice(i * 3, i * 3 + 3));
    return result;
}

function editor(initial) {
    modelService.clearModel();
    modelService.setModelPart(schema, initial);
    const data = modelToRows(schema, modelService.getModel().elements);
    const rows = data.map(item => ({getData: () => item}));
    const table = {getRows: () => rows, getData: () => structuredClone(data)};
    const handlers = bindEditor({schema, table, rowsToModel, applyVariantChange, modelService, STORAGE_TYPES});
    return {
        ...handlers, rows,
        edit(index, field, value) {
            const item = data[index], oldValue = structuredClone(item[field]);
            item[field] = value;
            handlers.captureCellChange({getRow: () => rows[index], getField: () => field,
                getOldValue: () => oldValue, getValue: () => value});
            return handlers.handleTableChanged();
        },
    };
}

test("actual cell handlers replace geometry for every KV type transition despite accessor copies", () => {
    for (let from = 0; from <= 4; from++) {
        for (let to = 0; to <= 4; to++) {
            if (from === to) continue;
            const h = editor([record(0, "Сосед"), record(from, "Целевая запись")]);
            const before = structuredClone(modelService.getModel().elements);
            const update = h.edit(1, "geoType", to);
            const actual = update.data[1];
            assert.deepEqual(actual.geo.flat(), resetKvGeo(to), `${from} → ${to}`);
            assert.equal(unpackKvVertices(actual.geo.flat(), to).err, 0);
            assert.equal(validateKvVertices(unpackKvVertices(actual.geo.flat(), to).vertices), true);
            assert.deepEqual(update.data[0], before[0]);
            assert.equal(actual.name, before[1].name);
            assert.equal(update.source, null, "variant edit requests full table refresh");
        }
    }
    modelService.clearModel();
});

test("actual cell handlers record type and default geometry as one Undo/Redo", () => {
    const h = editor([record()]);
    const before = structuredClone(modelService.getModel().elements);
    h.edit(0, "geoType", 1);
    const changed = structuredClone(modelService.getModel().elements);
    assert.deepEqual(changed[0].geo.flat(), resetKvGeo(1));
    assert.equal(modelService.undo("elements"), true);
    assert.deepEqual(modelService.getModel().elements, before);
    assert.equal(modelService.canUndo("elements"), false);
    assert.equal(modelService.redo("elements"), true);
    assert.deepEqual(modelService.getModel().elements, changed);
    modelService.clearModel();
});

test("unrelated edit retains geometry and a missing row never becomes index minus one", () => {
    const h = editor([record()]);
    const geometry = structuredClone(modelService.getModel().elements[0].geo);
    h.edit(0, "name", "Новое имя");
    assert.deepEqual(modelService.getModel().elements[0].geo, geometry);
    h.captureCellChange({getRow: () => ({getData: () => ({geoType: 1})}), getField: () => "geoType",
        getOldValue: () => 0, getValue: () => 1});
    assert.equal(h.pending(), null);
    modelService.clearModel();
});

test("empty and whitespace-only element names produce ERROR through schema diagnostics", () => {
    for (const name of ["", " ", "\t\r\n", "\u00a0", "\u2003", " \t\u3000 "]) {
        assert.equal(validateConstraintValue(name, schema.properties.name), false, JSON.stringify(name));
        const diagnostics = schemaConstraintDiagnostics(schema, [record(0, name)]);
        assert.equal(diagnostics.length, 1);
        assert.equal(diagnostics[0].level, VALIDATION_LEVELS.ERROR);
    }
    for (const name of ["A", " Обмотка 1 ", "α", "Катушка\t1"]) {
        assert.equal(validateConstraintValue(name, schema.properties.name), true);
        assert.deepEqual(schemaConstraintDiagnostics(schema, [record(0, name)]), []);
    }
});
