// Источник: julia, src/core/types.jl (KvGeoType, TkGeoType);
//           src/base/defines.jl (EnModel, EnTARG);
//           src/import/02_fillKvs.jl (kya/kyp);
//           подписи TkGeoType — src/import/02_fillTks.jl. Снимок 2026-09.
export const KV_GEO_TYPE = [
    { value: 0, label: "Шестигранник" },
    { value: 1, label: "Сектор" },
    { value: 2, label: "Прямоугольная призма" },
    { value: 3, label: "Усечённая правильная пирамида" },
    { value: 4, label: "Неправильная пирамида" },
];
export const TK_GEO_TYPE = [
    { value: 0, label: "Площадка" },
    { value: 1, label: "Сектор" },
    { value: 2, label: "Отрезок" },
    { value: 3, label: "Прямоугольник" },
];
export const EN_MODEL = [
    { value: 0, label: "ФММ M(H)" },
    {
        value: 1,
        label: "Частные циклы (не используется)",
        disabled: true,
    },
    { value: 2, label: "ВТСП 2-го рода" },
];
export const EN_TARG = [
    { value: 0, label: "Неизвестные источники" },
    { value: 1, label: "Заданная намагниченность" },
    { value: 2, label: "Заданная плотность тока" },
    { value: 3, label: "Виртуальный (поле / катушка)" },
];
export const SYM_KIND = [
    { value: 1, label: "Знакопостоянная" },
    { value: -1, label: "Знакопеременная" },
    { value: 0, label: "Геометрическая" },
];
