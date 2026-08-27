//==============================================================================
// Общие операции над именованными вариантами property.enum.
//==============================================================================

export function isNamedEnumOption(option) {
    if (
        option === null ||
        typeof option !== "object" ||
        Array.isArray(option)
    ) {
        return false;
    }

    const valueType = typeof option.value;
    const isJsonScalar =
        valueType === "string" ||
        valueType === "boolean" ||
        (
            valueType === "number" &&
            Number.isFinite(option.value)
        );

    return isJsonScalar &&
        typeof option.label === "string" &&
        option.label.trim().length > 0;
}

export function findNamedEnumOption(options, value) {
    if (!Array.isArray(options)) return undefined;

    return options.find(option =>
        isNamedEnumOption(option) &&
        option.value === value
    );
}

export function firstNamedEnumValue(options) {
    const option = Array.isArray(options)
        ? options[0]
        : undefined;

    return isNamedEnumOption(option)
        ? option.value
        : undefined;
}
