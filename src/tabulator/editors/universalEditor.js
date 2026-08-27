import { editorRegistry } from "./editorRegistry";
import { resolveProperty, resolveValueProperty } from "../schema/propertyResolver";

//------------------------------------------------------------------------------
// Общий редактор значений ячейки.
// Вызывает зарегистрированный редактор для соответствующего типа данных.
//
// Массивы и логические значения обрабатываются отдельно, вне общего редактора.
//
// Единый канал получения описания поля:
//   1) editorParams.property — если описание передано колонкой;
//   2) resolveProperty(cell, table._gui.schema) — иначе.
//------------------------------------------------------------------------------
export function universalEditor(

    // Объект текущей редактируемой ячейки.
    cell,

    // Функция регистрации обработчика, вызываемого после вставки редактора в DOM.
    onRendered,

    // Функция успешного завершения редактирования.
    success,

    // Функция отмены редактирования.
    cancel,

    // Параметры редактора из описания колонки.
    editorParams,
) {

    const params = editorParams ?? {};

    let property = params.property;

    if (!property) {
        const schema = cell.getTable()._gui?.schema;

        property = schema
            ? resolveProperty(cell, schema)
            : null;
    }

    const valueProperty = resolveValueProperty(property);

    if (!valueProperty) {
        throw new Error("Не найдено описание свойства для редактора");
    }

    const editor = editorRegistry.get(valueProperty.type);

    if (!editor) {
        throw new Error(
            `Редактор для типа '${valueProperty.type}' не зарегистрирован`
        );
    }

    // Редактор обязан вернуть DOM-элемент (input, select, textarea и т.п.).
    return editor(
        cell,
        onRendered,
        success,
        cancel,
        valueProperty,
    );
}