/*
Источник: solver/src/base/types.jl (SYMBase),
solver/src/core/types.jl (KvBase), solver/src/core/03_kv.jl
и solver/src/task/05_taskData.jl. Снимок 2026-09.
Сериализуются только поля KvBase; производные поля Kv в схему не входят.
*/
import {
    TABS,
    STORAGE_TYPES,
    FIELD_TYPES,
    FILES,
    VIEW_TYPES,
} from "../../services/schemas/common/constants";
import {
    EN_MODEL,
    EN_TARG,
    KV_GEO_TYPE,
    SYM_KIND,
} from "./common/enums";
import { createSchema } from "../schemaFactory";
import { KV_GEO_LENGTH } from "../solver/geometryKv.js";
import {
    eoCount,
    eoCountAll,
    kvFlags,
    symYc,
} from "../solver/kvDerived";
import { eoRange } from "../solver/mhjLayout";
import { kvGeoVariantCodec } from "../../tabulator/converters/geoVariantCodec";

function summaryRows({ value, presentation }) {
    return Array.isArray(presentation?.rows)
        ? presentation.rows
        : value;
}

function arraySummary(context) {
    const rows = summaryRows(context);

    return Array.isArray(rows)
        ? rows.flat().join(", ")
        : "";
}

function coordinateTriplesSummary(context) {
    const rows = summaryRows(context);
    if (!Array.isArray(rows)) return "";

    const values = rows.flat();
    const triples = [];

    for (let index = 0; index < values.length; index += 3) {
        triples.push(
            "(" + values.slice(index, index + 3).join(", ") + ")"
        );
    }

    return triples.join(", ");
}

function geometrySummary(context) {
    return context.rowData?.geoType === 0
        ? coordinateTriplesSummary(context)
        : arraySummary(context);
}

export default createSchema({
    id: TABS.ELEMENTS.id,
    title: TABS.ELEMENTS.label,
    file: FILES.KVS,
    storage: STORAGE_TYPES.RECORDS,
    required: true,
    obsoleteStoragePaths: ["xapType"],
    columnHeaderWordLines: true,

    properties: {
        name: {
            type: FIELD_TYPES.STRING,
            label: "Название",
            description: "Название объёмного элемента",
            default: "",
            minLength: 1,
            columnWidth: 280,
        },

        symVi: {
            storageKey: "sym.vi",
            type: FIELD_TYPES.ARRAY,
            view: VIEW_TYPES.TABLE,
            label: "LSK ориентация, град",
            description: "Углы начальной ориентации локальной СК, как последовательный поворот вокруг осей X, Y, Z",
            default: [0, 0, 0],
            nColumns: 1,
            columns: ["Угол, град"],
            rowsMutable: false,
            minItems: 3,
            maxItems: 3,
            itemLabels: ["X", "Y", "Z"],
            itemLabelTitle: "Ось",
            summary: arraySummary,
            items: {
                type: FIELD_TYPES.FLOAT,
                description: "Угол поворота, град",
                default: 0,
                digits: 6,
            },
        },

        symR0: {
            storageKey: "sym.r0",
            type: FIELD_TYPES.ARRAY,
            view: VIEW_TYPES.TABLE,
            label: "LSK начало, мм",
            description: "Координаты начала локальной СК",
            default: [0, 0, 0],
            nColumns: 1,
            columns: ["Координата"],
            rowsMutable: false,
            minItems: 3,
            maxItems: 3,
            itemLabels: ["X", "Y", "Z"],
            itemLabelTitle: "Ось",
            summary: arraySummary,
            items: {
                type: FIELD_TYPES.FLOAT,
                description: "Координата начала локальной СК",
                default: 0,
                digits: 6,
            },
        },

        symYl: {
            storageKey: "sym.yl",
            type: FIELD_TYPES.FLOAT,
            label: "YLV, град",
            description: "Угол поворота вокруг оси X локальной СК, формирующий образы локальной симметрии",
            default: 0,
            digits: 6,
        },

        symYa: {
            storageKey: "sym.ya",
            type: FIELD_TYPES.FLOAT,
            label: "YAV, град",
            description: "Угол поворота в основной СК вокруг оси X, формирующий азимутальные образы",
            default: 0,
            digits: 6,
        },

        symTx: {
            storageKey: "sym.tx",
            type: FIELD_TYPES.FLOAT,
            label: "TXV, мм",
            description: "Смещение в основной СК вдоль оси X, формирующее периодические образы",
            default: 0,
            digits: 6,
        },

        symLs: {
            storageKey: "sym.ls",
            type: FIELD_TYPES.INTEGER,
            label: "LAS",
            description: "Число образов локальной симметрии",
            default: 1,
            minimum: 1,
        },

        symAs: {
            storageKey: "sym.as",
            type: FIELD_TYPES.INTEGER,
            label: "ASV",
            description: "Число образов азимутальной симметрии",
            default: 1,
            minimum: 1,
        },

        symPs: {
            storageKey: "sym.ps",
            type: FIELD_TYPES.INTEGER,
            label: "PSV",
            description: "Число образов периодической симметрии",
            default: 1,
            minimum: 1,
        },

        symKya: {
            storageKey: "sym.kya",
            type: FIELD_TYPES.ENUM,
            label: "Тип ASV",
            description: "Знак и характер азимутальной симметрии",
            default: 0,
            enum: SYM_KIND,
        },

        symKyp: {
            storageKey: "sym.kyp",
            type: FIELD_TYPES.ENUM,
            label: "Тип PSV",
            description: "Знак и характер периодической симметрии",
            default: 0,
            enum: SYM_KIND,
        },

        yc1: {
            type: FIELD_TYPES.INTEGER,
            label: "YC1",
            description: "Учитывать образы азимутальной симметрии: 1 — да, 0 — нет",
            default: 0,
            readonly: true,
            hidden: true,
            columnWidth: 70,
            compute: {
                dependencies: ["symKya"],
                evaluate: ({ values }) =>
                    symYc(values.symKya, 0)[0],
            },
        },

        yc2: {
            type: FIELD_TYPES.INTEGER,
            label: "YC2",
            description: "Учитывать образы периодической симметрии: 1 — да, 0 — нет",
            default: 0,
            readonly: true,
            hidden: true,
            columnWidth: 70,
            compute: {
                dependencies: ["symKyp"],
                evaluate: ({ values }) =>
                    symYc(0, values.symKyp)[1],
            },
        },

        yc3: {
            type: FIELD_TYPES.INTEGER,
            label: "YC3",
            description: "Знак азимутальных образов: −1 или 1",
            default: 1,
            readonly: true,
            hidden: true,
            columnWidth: 70,
            compute: {
                dependencies: ["symKya"],
                evaluate: ({ values }) =>
                    symYc(values.symKya, 0)[2],
            },
        },

        yc4: {
            type: FIELD_TYPES.INTEGER,
            label: "YC4",
            description: "Знак периодических образов: −1 или 1",
            default: 1,
            readonly: true,
            hidden: true,
            columnWidth: 70,
            compute: {
                dependencies: ["symKyp"],
                evaluate: ({ values }) =>
                    symYc(0, values.symKyp)[3],
            },
        },

        geoType: {
            type: FIELD_TYPES.ENUM,
            label: "Тип геометрии",
            description: "Способ задания геометрии объёмного элемента",
            default: 0,
            enum: KV_GEO_TYPE,
        },

        geo: {
            type: FIELD_TYPES.ARRAY,
            view: VIEW_TYPES.TABLE,
            label: "Геометрия",
            description:
                "Фиксированный буфер геометрии объёмного элемента. "
                + "Для типа 0 рёбра 1–2, 3–4, 5–6, 7–8 соединяют грани;"
                + "обходы 1–5–7–3 и 2–4–8–6 задают внешние нормали граней",
            default: new Array(KV_GEO_LENGTH).fill(0),
            nColumns: 3,
            order: "row",
            columns: ["X", "Y", "Z"],
            rowsMutable: false,
            minItems: 8,
            maxItems: 8,
            itemLabels: [
                "V1", "V2", "V3", "V4",
                "V5", "V6", "V7", "V8",
            ],
            itemLabelTitle: "Вершина",
            variantCodec: kvGeoVariantCodec,
            summary: geometrySummary,
            items: {
                type: FIELD_TYPES.FLOAT,
                description: "Координата или параметр геометрии",
                default: 0,
                digits: 6,
            },
        },

        dr: {
            type: FIELD_TYPES.ARRAY,
            view: VIEW_TYPES.TABLE,
            label: "Начальное смещение, мм",
            description: "Вектор сначального смещения геометрии объёмного элемента после установки ориентации",
            default: [0, 0, 0],
            nColumns: 1,
            columns: ["Значение"],
            rowsMutable: false,
            minItems: 3,
            maxItems: 3,
            itemLabels: ["X", "Y", "Z"],
            itemLabelTitle: "Ось",
            summary: arraySummary,
            items: {
                type: FIELD_TYPES.FLOAT,
                description: "Компонента вектора смещения",
                default: 0,
                digits: 6,
            },
        },

        dp: {
            type: FIELD_TYPES.ARRAY,
            view: VIEW_TYPES.TABLE,
            label: "Разбиение",
            description: "Число интервалов разбиения по трём направлениям",
            default: [1, 1, 1],
            nColumns: 1,
            columns: ["Число интервалов"],
            rowsMutable: false,
            minItems: 3,
            maxItems: 3,
            itemLabels: ["D1", "D2", "D3"],
            itemLabelTitle: "Направление",
            summary: arraySummary,
            items: {
                type: FIELD_TYPES.INTEGER,
                description: "Число интервалов разбиения",
                default: 1,
            },
        },

        eoCount: {
            type: FIELD_TYPES.INTEGER,
            label: "Число ЭО",
            description: "Число элементарных объёмов с независимыми источниками",
            default: 0,
            readonly: true,
            columnWidth: 110,
            compute: {
                dependencies: [
                    "dp",
                    "symLs",
                    "symAs",
                    "symPs",
                    "symKya",
                    "symKyp",
                ],
                evaluate: ({ values }) => eoCount(values),
            },
        },

        eoCountAll: {
            type: FIELD_TYPES.INTEGER,
            label: "Всего ЭО",
            description: "Число элементарных объёмов с учётом всех геометрических образов",
            default: 0,
            readonly: true,
            hidden: true,
            columnWidth: 130,
            compute: {
                dependencies: [
                    "dp",
                    "symLs",
                    "symAs",
                    "symPs",
                ],
                evaluate: ({ values }) => eoCountAll(values),
            },
        },

        eoRange: {
            type: FIELD_TYPES.STRING,
            label: "Диапазон",
            description: "Диапазон глобальных номеров ЭО с независимыми источниками",
            default: "",
            readonly: true,
            hidden: true,
            columnWidth: 110,
            compute: {
                scope: "records",
                dependencies: [
                    "dp",
                    "symLs",
                    "symAs",
                    "symPs",
                    "symKya",
                    "symKyp",
                ],
                evaluate: ({ records, recordIndex }) =>
                    eoRange(records, recordIndex),
            },
        },

        vkan: {
            type: FIELD_TYPES.ARRAY,
            view: VIEW_TYPES.TABLE,
            label: "KAN, град",
            description: "Исходные углы ориентации оси X лёгкого намагничивания как последовательные повороты вокруг X, Y, Z",
            default: [0, 0, 0],
            nColumns: 1,
            columns: ["Угол, град"],
            rowsMutable: false,
            minItems: 3,
            maxItems: 3,
            itemLabels: ["X", "Y", "Z"],
            itemLabelTitle: "Ось",
            summary: arraySummary,
            items: {
                type: FIELD_TYPES.FLOAT,
                description: "Угол поворота, град",
                default: 0,
                digits: 6,
            },
        },

        indCoil: {
            type: FIELD_TYPES.INTEGER,
            label: "# катушка",
            description: "Номер измерительной катушки; 0 — элемент не принадлежит катушке",
            default: 0,
        },

        wCoil: {
            type: FIELD_TYPES.FLOAT,
            label: "W катушки",
            description: "Множитель вклада элемента в потокосцепление измерительной катушки",
            default: 0,
            digits: 6,
        },

        indAmp: {
            type: FIELD_TYPES.INTEGER,
            label: "# амплитуда/ KV-направление",
            description: "Для заданного источника — индекс временной зависимости амплитуды; для виртуального элемента — 0 для поля в центре или 1–3 для направления намотки вдоль D1–D3",
            default: 0,
        },

        indMove: {
            type: FIELD_TYPES.INTEGER,
            label: "# moview",
            description: "Индекс траектории движения объёмного элемента",
            default: 0,
        },

        model: {
            type: FIELD_TYPES.ENUM,
            label: "Модель материала",
            description: "Модель материала объёмного элемента",
            default: 0,
            enum: EN_MODEL,
        },

        auto: {
            type: FIELD_TYPES.BOOLEAN,
            label: "Автоповорот источников",
            description: "Поворачивать ось анизотропии и заданные источники вместе с локальными образами",
            default: true,
        },

        targ: {
            type: FIELD_TYPES.ENUM,
            label: "Назначение элемента",
            description: "Роль объёмного элемента: С неизвестыми источниками, заданные намагниченность/плотностьт тока, виртуальный для расчета потокосцепления",
            default: 0,
            enum: EN_TARG,
        },

        take: {
            type: FIELD_TYPES.BOOLEAN,
            label: "Учитывать для поля",
            description: "Учитывать элемент при расчёте поля",
            default: true,
        },

        rv: {
            type: FIELD_TYPES.FLOAT,
            label: "GAM, МСм/м",
            description: "Удельная электропроводность материала",
            default: 0,
            digits: 6,
        },

        med: {
            type: FIELD_TYPES.ARRAY,
            view: VIEW_TYPES.TABLE,
            label: "MED",
            description: "Указатели шести граней с зарядами: 0 - нет зарядов, -1 граница с воздухом",
            default: new Array(6).fill(0),
            nColumns: 1,
            columns: ["Указатель"],
            rowsMutable: false,
            minItems: 6,
            maxItems: 6,
            itemLabels: ["1", "2", "3", "4", "5", "6"],
            itemLabelTitle: "Грань",
            summary: arraySummary,
            items: {
                type: FIELD_TYPES.INTEGER,
                description: "0 отключает грань; отрицательное значение обозначает неизвестный заряд",
                default: 0,
            },
        },

        xapName: {
            type: FIELD_TYPES.STRING,
            label: "Характеристика материала",
            description: "Имя характеристики; поиск выполняется в локальной библиотеке после ее создания из базовой; для назначения характеристики выделите элементы и откройте меню Доаолнительные функции (слева, вверху)",
            default: "",
            readonly: true,
        },

        isConductive: {
            type: FIELD_TYPES.BOOLEAN,
            label: "Проводящий",
            description:
                "Производный признак электропроводящего элемента",
            default: false,
            readonly: true,
            hidden: true,
            columnWidth: 105,
            compute: {
                dependencies: ["targ", "rv"],
                evaluate: ({ values }) =>
                    kvFlags(values).rv,
            },
        },

        isMagnetic: {
            type: FIELD_TYPES.BOOLEAN,
            label: "Магнитный",
            description:
                "Производный признак магнитного элемента",
            default: false,
            readonly: true,
            hidden: true,
            columnWidth: 100,
            compute: {
                dependencies: ["targ", "xapName"],
                evaluate: ({ values }) =>
                    kvFlags(values).mv,
            },
        },

        isAnisotropic: {
            type: FIELD_TYPES.BOOLEAN,
            label: "Анизотропный",
            description:
                "Производный признак анизотропного элемента",
            default: false,
            readonly: true,
            hidden: true,
            columnWidth: 115,
            compute: {
                dependencies: ["targ", "vkan"],
                evaluate: ({ values }) =>
                    kvFlags(values).ani,
            },
        },
    },
});
