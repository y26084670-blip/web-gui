import { TabulatorFull as Tabulator } from "tabulator-tables";

import { createHtcMaterialDetailSchema } from "../../services/materials/materialLibraryModel.js";
import { modelToRows } from "../converters/modelConverter.js";
import { TableBuilder } from "../builders/TableBuilder.js";
import { COMMON_TABLE_OPTIONS } from "../tableOptions.js";

export class HtcMaterialDetailView {
    constructor({ schema, record, isWritable, setValue }) {
        this.schema = createHtcMaterialDetailSchema(schema);
        this.record = record;
        this.isWritable = isWritable;
        this.setValue = setValue;
        this.host = null;
        this.table = null;
    }

    attach(host) {
        this.host = host;
    }

    detach() {
        this.host = null;
    }

    render() {
        if (!this.host || this.table) return undefined;

        const columns = TableBuilder.buildColumns(this.schema);
        columns[0].tooltip = (_event, cell) => {
            const propertyName = cell.getRow().getData()._property;
            return this.schema.properties[propertyName]?.description ?? "";
        };
        for (const column of columns.slice(1)) {
            const editable = column.editable;
            const cellClick = column.cellClick;
            column.editable = cell =>
                this.isWritable() && editable?.(cell) !== false;
            column.cellClick = (event, cell) => {
                if (this.isWritable()) cellClick?.(event, cell);
            };
        }

        this.table = new Tabulator(this.host, {
            ...COMMON_TABLE_OPTIONS,
            layout: "fitDataFill",
            height: "100%",
            data: modelToRows(this.schema, [this.record]),
            columns,
            selectableRows: true,
            selectableRowsRangeMode: "click",
        });
        this.table._gui = {
            schema: this.schema,
            required: false,
            structure: { mutable: false },
        };
        this.table.on("cellEdited", (cell) => {
            const propertyName = cell.getRow().getData()._property;
            if (!this.schema.properties[propertyName] || !this.isWritable()) {
                return;
            }
            void Promise.resolve(this.setValue(
                propertyName,
                cell.getValue(),
                cell.getOldValue(),
            )).catch(error => {
                console.error("HTC detail commit error:", error);
            });
        });
        return undefined;
    }

    getTable() {
        return this.table;
    }

    isStructureMutable() {
        return false;
    }

    onVisible() {
        if (this.host?.offsetWidth) this.table?.redraw(true);
    }

    destroy() {
        this.table?.destroy();
        this.table = null;
        this.host = null;
        this.record = null;
        this.setValue = null;
        this.isWritable = null;
    }
}
