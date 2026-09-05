import assert from "node:assert/strict";
import test from "node:test";
import {
    CellComponent,
    RowComponent,
    ValidateModule,
} from "tabulator-tables";

import { FIELD_TYPES } from "../src/services/schemas/common/constants.js";
import { COMMON_TABLE_OPTIONS } from "../src/tabulator/tableOptions.js";
import {
    constraintValidator,
} from "../src/tabulator/validators/types/constraintValidator.js";

const invalidClass = "tabulator-validation-fail";
const subdivision = { type: FIELD_TYPES.INTEGER, minimum: 1 };

// Exercise Tabulator's actual validation module and component proxies. Only
// component registration and DOM classList are stubbed; no browser is required.
function createTableHarness() {
    const handlers = new Map();
    const events = [];
    const table = {
        options: { ...COMMON_TABLE_OPTIONS },
        optionsList: { register() {} },
        columnManager: { optionsList: { register() {} } },
        componentFunctionBinder: {
            bind(type, name, handler) {
                handlers.set(`${type}.${name}`, handler);
            },
            handle(type, component, name) {
                const handler = handlers.get(`${type}.${name}`);
                return handler && ((...args) => handler(component, ...args));
            },
        },
        eventBus: {
            dispatch: (...args) => events.push(args),
        },
        externalEvents: {
            dispatch: (...args) => events.push(args),
        },
        initGuard() {},
    };
    const validation = new ValidateModule(table);

    function createRow(definitions) {
        const row = { table, cells: [] };
        const component = new RowComponent(row);
        row.getComponent = () => component;
        row.getCells = () => row.cells;
        row.cells = definitions.map(({ value, descriptor }) => {
            const classes = new Set();
            const element = {
                classList: {
                    add: name => classes.add(name),
                    remove: name => classes.delete(name),
                    contains: name => classes.has(name),
                },
            };
            const column = {
                modules: {},
                definition: descriptor ? {
                    validator: (cell, nextValue) => constraintValidator(
                        cell, nextValue, null, descriptor,
                    ),
                } : {},
            };
            validation.initializeColumnCheck(column);
            const cell = {
                table,
                row,
                column,
                value,
                modules: {},
                getValue() { return this.value; },
                getElement: () => element,
            };
            const cellComponent = new CellComponent(cell);
            cell.getComponent = () => cellComponent;
            return cell;
        });
        return { component, cells: row.cells };
    }

    return { table, validation, createRow, events };
}

function hasRedBorder(cell) {
    return cell.getElement().classList.contains(invalidClass);
}

test("first row render highlights loaded subdivision violations without editing", () => {
    const { table, createRow, events } = createTableHarness();
    const row = createRow([
        { value: 0, descriptor: subdivision },
        { value: -2, descriptor: subdivision },
        { value: 1, descriptor: subdivision },
    ]);

    COMMON_TABLE_OPTIONS.rowFormatter(row.component);

    assert.deepEqual(row.cells.map(hasRedBorder), [true, true, false]);
    assert.deepEqual(
        table.getInvalidCells(),
        row.cells.slice(0, 2).map(cell => cell.getComponent()),
    );
    assert.deepEqual(row.cells.map(cell => cell.value), [0, -2, 1]);
    assert.deepEqual(events, [], "render validation must not emit edit events");
});

test("rerender keeps one invalid entry and removes the border after correction", () => {
    const { table, createRow, events } = createTableHarness();
    const row = createRow([{ value: 0, descriptor: subdivision }]);
    const [cell] = row.cells;

    COMMON_TABLE_OPTIONS.rowFormatter(row.component);
    COMMON_TABLE_OPTIONS.rowFormatter(row.component);

    assert.equal(hasRedBorder(cell), true);
    assert.deepEqual(table.getInvalidCells(), [cell.getComponent()]);

    cell.value = 1;
    COMMON_TABLE_OPTIONS.rowFormatter(row.component);

    assert.equal(hasRedBorder(cell), false);
    assert.deepEqual(table.getInvalidCells(), []);
    assert.deepEqual(events, [], "refresh must not report model edits");
});

test("a newly displayed row is checked independently of earlier rendered rows", () => {
    const { table, createRow } = createTableHarness();
    const first = createRow([{ value: 2, descriptor: subdivision }]);
    COMMON_TABLE_OPTIONS.rowFormatter(first.component);
    assert.deepEqual(table.getInvalidCells(), []);

    // A later viewport row or an opened detail table has no previous edit state.
    const next = createRow([{ value: 0, descriptor: subdivision }]);
    assert.equal(hasRedBorder(next.cells[0]), false);
    COMMON_TABLE_OPTIONS.rowFormatter(next.component);

    assert.equal(hasRedBorder(first.cells[0]), false);
    assert.equal(hasRedBorder(next.cells[0]), true);
    assert.deepEqual(table.getInvalidCells(), [next.cells[0].getComponent()]);
});

test("render validation accepts unconstrained values and cells without validators", () => {
    const { table, createRow, events } = createTableHarness();
    const row = createRow([
        { value: -10, descriptor: { type: FIELD_TYPES.INTEGER } },
        { value: "row label" },
    ]);

    COMMON_TABLE_OPTIONS.rowFormatter(row.component);

    assert.deepEqual(row.cells.map(hasRedBorder), [false, false]);
    assert.deepEqual(table.getInvalidCells(), []);
    assert.deepEqual(events, []);
});
