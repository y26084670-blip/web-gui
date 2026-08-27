import { VIEW_TYPES } from "../../../services/schemas/common/constants";
import { viewRegistry } from "../../views/viewRegistry";

// В ячейке основной таблицы отображается сводка значения.
// Само представление размещается в области деталей вкладки.
export function arrayFormatter(
    cell,
    formatterParams,
) {
    const property = formatterParams.property;

    if (!property) {
        return "";
    }

    const viewType =
        property.view ?? VIEW_TYPES.TABLE;

    const adapter =
        viewRegistry.get(viewType);

    if (!adapter) {
        throw new Error(
            `View '${viewType}' is not registered`
        );
    }

    return adapter.summary(
        cell,
        formatterParams,
    );
}