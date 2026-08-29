/*
Источник: solver/src/core/types.jl (Move, JSON_Move),
solver/src/task/05_taskData.jl и solver/src/import/02_fillMoves.jl.
Снимок 2026-08.
*/
import {
    VIEW_TYPES,
    TABS,
    STORAGE_TYPES,
    FIELD_TYPES,
    FILES,
} from "../../services/schemas/common/constants";
import { createSchema } from "../schemaFactory";
import { nodeCount } from "../solver/kvDerived";

function commonMoveNodeCount({ values }) {
    const angleCount = nodeCount(values.angle);
    const positionCount = nodeCount(values.position);

    return angleCount === positionCount
        ? angleCount
        : 0;
}

function moveRowsSummary({ presentation }) {
    const rows = presentation?.rows;
    if (!Array.isArray(rows)) return "";

    return rows
        .map(row =>
            `(${row?.[0] ?? ""}, ${row?.[1] ?? ""}, `
            + `${row?.[2] ?? ""}, ${row?.[3] ?? ""})`
        )
        .join(", ");
}

export default createSchema({

    id: TABS.MOVES.id,

    title: TABS.MOVES.label,

    file: FILES.MOVES,

    storage: STORAGE_TYPES.RECORDS,

    required: false,

    views: {
        generator: {
            title: "Генератор временных зависимостей",
        },
        graph: {
            title: "Графики траекторий",
            recordLabel: "Траектория",
            selectorLabel: "Показ",
            defaultMode: "position",
            modes: [
                {
                    value: "position",
                    label: "Смещение",
                    property: "position",
                    x: { column: 0, title: "Время, сек" },
                    y: { title: "Смещение, мм" },
                    series: [
                        { column: 1, label: "X" },
                        { column: 2, label: "Y" },
                        { column: 3, label: "Z" },
                    ],
                },
                {
                    value: "angle",
                    label: "Углы",
                    property: "angle",
                    x: { column: 0, title: "Время, сек" },
                    y: { title: "Угол, град" },
                    series: [
                        { column: 1, label: "aX" },
                        { column: 2, label: "aY" },
                        { column: 3, label: "aZ" },
                    ],
                },
            ],
        },
    },

    properties: {

        angle: {
            type: FIELD_TYPES.ARRAY,
            view: VIEW_TYPES.TABLE,
            label: "Поворот",
            description: "Зависимость углов поворота от времени",
            default: [],
            nColumns: 4,
            columns: [
                "Время, сек",
                "aX, град",
                "aY, град",
                "aZ, град",
            ],
            items: {
                type: FIELD_TYPES.FLOAT,
                description: "Время или угол поворота",
                default: 0,
                digits: 6,
            },
            summary: moveRowsSummary,
        },

        position: {
            type: FIELD_TYPES.ARRAY,
            view: VIEW_TYPES.TABLE,
            label: "Положение",
            description: "Зависимость положения от времени",
            default: [],
            nColumns: 4,
            columns: [
                "Время, сек",
                "X0, мм",
                "Y0, мм",
                "Z0, мм",
            ],
            items: {
                type: FIELD_TYPES.FLOAT,
                description: "Время или координата положения",
                default: 0,
                digits: 6,
            },
            summary: moveRowsSummary,
        },

        n: {
            type: FIELD_TYPES.INTEGER,
            label: "Число узлов",
            description: "Общее число строк таблиц поворота и положения",
            default: 0,
            readonly: true,
            hidden: true,
            computeStored: {
                dependencies: ["angle", "position"],
                evaluate: commonMoveNodeCount,
            },
        },

    }

});
