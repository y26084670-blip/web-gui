//------------------------------------------------------------------------------
// Форматтер именованных перечислений.
//------------------------------------------------------------------------------
import { findNamedEnumOption } from "../../../services/schemas/common/enumOptions";

function imageEnumValue(option) {
    const value = document.createElement("span");
    value.className = "image-enum-value";
    value.setAttribute("aria-label", option.description ?? option.label);

    const image = document.createElement("img");
    image.src = option.image;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    value.appendChild(image);
    return value;
}

export function enumFormatter(cell, formatterParams) {
    const value = cell.getValue();

    if (value === undefined || value === null) {
        return "";
    }

    const option = findNamedEnumOption(
        formatterParams?.property?.enum,
        value,
    );

    if (typeof option?.image === "string" && option.image.length > 0) {
        return imageEnumValue(option);
    }

    const defaultLabel = option?.label ?? String(value);
    const displayLabel = formatterParams?.property?.displayLabel;
    return typeof displayLabel === "function"
        ? displayLabel({ value, rowData: cell.getRow().getData(), defaultLabel })
        : defaultLabel;
}
