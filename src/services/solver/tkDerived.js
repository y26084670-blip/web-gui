// Эти строки являются частью хранимой legacy-формулы, а не UI-подписями ENUM.
const REGION_TYPE_NAMES = new Map([
    [0, "Площадка"],
    [1, "Сектор"],
    [2, "Отрезок"],
    [3, "Прямоугольник"],
]);

// Источник: solver/src/import/02_fillTks.jl::tksFrom2XX,
// commit 4bc4991c84467a5cdd9603c22e024569188a6cd7.
//
// В legacy-импорте имя строится до перестановки dv в TkBase.dp, поэтому
// для BaseModel dp = [[D1], [D2]] сохраняется соответствие:
// dp41 = D2, dp21 = D1.
//
// Постоянный пересчёт имени является политикой GUI на основе этой формулы,
// а не runtime-инвариантом решателя.
export function regionName({ values }) {
    const type = REGION_TYPE_NAMES.get(values.geoType) ?? "";
    const dp41 = matrixScalar(values.dp, 1);
    const dp21 = matrixScalar(values.dp, 0);

    let name = `${type}, dp41=${dp41}, dp21=${dp21}`;

    if (values.symLs > 1) {
        name += `, las=${values.symLs}`;
    }

    return name;
}

function matrixScalar(value, row) {
    const scalar = Array.isArray(value?.[row])
        ? value[row][0]
        : undefined;

    return scalar ?? "";
}
