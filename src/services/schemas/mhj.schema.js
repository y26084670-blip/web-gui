/*
Источник: solver/src/core/types.jl (MHJ, JSON_MHJ),
solver/src/task/05_taskData.jl и solver/src/vsolver/04_mhj.jl::mhjRecall!.
Снимок 2026-08.

Формат GUI: необязательный mhj.txt содержит не более одной RECORDS-записи
с ключом v. Единственная строка JSON Lines физически совпадает с объектом,
который читает решатель.
*/
import {
    FIELD_TYPES,
    FILES,
    STORAGE_TYPES,
    TABS,
    VIEW_TYPES,
} from "../../services/schemas/common/constants";
import { createSchema } from "../schemaFactory";
import { mhjRows } from "../solver/mhjLayout";

const computedColumns = Object.freeze([
    {
        key: "eoLocal",
        label: "№ ЭО",
        description:
            "Сплошной номер ЭО внутри текущей записи elements",
        width: 75,
    },
    {
        key: "eoGlobal",
        label: "№ ЭО общий",
        description:
            "Сплошной номер ЭО с учётом всех предыдущих записей elements независимо от их назначения",
        width: 105,
    },
    {
        key: "kv",
        label: "KV",
        description:
            "Номер записи в полной таблице elements",
        width: 60,
    },
    {
        key: "d12",
        label: "D12",
        description:
            "Индекс разбиения по направлению 1–2",
        width: 60,
    },
    {
        key: "d13",
        label: "D13",
        description:
            "Индекс разбиения по направлению 1–3",
        width: 60,
    },
    {
        key: "d15",
        label: "D15",
        description:
            "Индекс разбиения по направлению 1–5",
        width: 60,
    },
    {
        key: "ls",
        label: "LS",
        description:
            "Номер образа локальной симметрии",
        width: 60,
    },
    {
        key: "as",
        label: "AS",
        description:
            "Номер геометрического азимутального образа",
        width: 60,
    },
    {
        key: "ps",
        label: "PS",
        description:
            "Номер геометрического периодического образа",
        width: 60,
    },
]);

export default createSchema({
    id: TABS.MHJ.id,
    title: TABS.MHJ.label,
    file: FILES.MHJ,
    storage: STORAGE_TYPES.RECORDS,
    required: false,

    views: {
        main: {
            property: "v",
        },
    },

    properties: {
        v: {
            type: FIELD_TYPES.ARRAY,
            view: VIEW_TYPES.TABLE,
            label: "Заданные источники",
            description:
                "Компоненты заданной намагниченности или плотности тока",
            default: [],
            nColumns: 3,
            order: "column",
            columns: [
                "Mx / Jx",
                "My / Jy",
                "Mz / Jz",
            ],
            items: {
                type: FIELD_TYPES.FLOAT,
                default: 0,
                digits: 6,
                description:
                    "Компонента намагниченности или плотности тока",
            },
            computedView: {
                dependencies: [TABS.ELEMENTS.id],
                columns: computedColumns,
                rows: ({ models, rowLimit }) =>
                    mhjRows(
                        models[TABS.ELEMENTS.id],
                        { limit: rowLimit },
                    ),
            },
        },
    },
});
