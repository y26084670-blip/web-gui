//==============================================================================
// Служебная подпись строки — единственный владелец правила.
//
// Подпись строки является презентацией: она не входит в BaseModel и не
// сериализуется. Правило объявлено здесь и применяется одинаково при
// построении строк и при пересчёте после структурных операций.
//
// Функции принимают дескриптор свойства и номер; сущности Tabulator им
// не передаются.
//==============================================================================

// Подпись строки записи основной таблицы (RECORDS).
export function recordRowLabel(index) {
    return index + 1;
}

// Подпись строки свойства основной таблицы (CLUSTER).
export function propertyRowLabel(property, name) {
    return property?.label ?? name;
}

// Подпись строки элемента ARRAY-свойства без объявленной формы (CLUSTER).
export function propertyItemRowLabel(property, index) {
    const labels = property.itemLabels ?? [];
    return `${property.label} ${labels[index] ?? index + 1}`;
}

// Подпись строки связанного представления.
export function viewRowLabel(property, index, itemLabels) {
    const labels = itemLabels ?? property.itemLabels ?? [];
    return labels[index] ?? index + 1;
}