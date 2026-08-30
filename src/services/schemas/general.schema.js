/*
{"fullAxialSymmetry":false,"doubleFloat":false,"mirrorSymmetryX":-1,"mirrorSymmetryY":-1,"countTimeSteps":8,"timeStep":1.0,"polusForce":[0.0,0.0,0.0],"evalForce":true,"htcRegimFC":false,"htcMu":true,"htcRo":true}
...
json_str = readline(f)
JSON3.read!(json_str, me.general)
...
mutable struct General
    fullAxialSymmetry::Bool = false
    doubleFloat::Bool = false
    mirrorSymmetryX::INT = -1
    mirrorSymmetryY::INT = -1
    countTimeSteps::Int = 0
    timeStep::REAL = ZERO
    polusForce::VEC = VZERO3()
    evalForce::Bool = false
    htcRegimFC::Bool = false
    htcMu::Bool = true
    htcRo::Bool = true
end
 general::General = General()
*/
import {
    TABS,
    STORAGE_TYPES,
    FIELD_TYPES,
    FILES,
    VIEW_TYPES,
} from "../../services/schemas/common/constants";
import { createSchema } from "../schemaFactory";
import {
    measurementCoilRows,
    measurementCoilSummary,
} from "../references/modelReferenceViews.js";

export default createSchema({
    id: TABS.GENERAL.id,
    title: TABS.GENERAL.label,
    file: FILES.GENERAL,
    storage: STORAGE_TYPES.CLUSTER,
    required: true,
    rowLabelDescription: "Общие параметры модели",

    views: {
        references: {
            measurementCoils: {
                type: FIELD_TYPES.ARRAY,
                view: VIEW_TYPES.TABLE,
                label: "Измерительные катушки",
                description:
                    "Сводный список измерительных катушек и связанных объектов",
                readonly: true,
                rowsMutable: false,
                nColumns: 6,
                columns: [
                    "Катушка",
                    "Тип",
                    "№",
                    "Название",
                    "w",
                    "Направление",
                ],
                items: {
                    type: FIELD_TYPES.STRING,
                    default: "",
                    description: "Параметр связи измерительной катушки",
                },
                dependencies: [TABS.ELEMENTS.id, TABS.REGIONS.id],
                rows: measurementCoilRows,
                summary: measurementCoilSummary,
            },
        },
    },

    properties: {

        fullAxialSymmetry: {
            type: FIELD_TYPES.BOOLEAN,
            label: "Полная аксиальная симметрия",
            description: "",
            default: false,
            textOn: "Использовать",
            textOff: "Не использовать",
        },

        doubleFloat: {
            type: FIELD_TYPES.BOOLEAN,
            label: "Разрядность вычислений",
            description: "Разрядность вычислений",
            default: false,
            textOn: "Double числа",
            textOff: "Single числа",
        },

        mirrorSymmetryX: {
            type: FIELD_TYPES.INTEGER,
            label: "Зеркальная симметрия по X",
            description: "Зеркальная симметрия по X\n(относительно плоскости ZoY)",
            default: -1,
            minimum: -1,
            maximum: 1,
        },

        mirrorSymmetryY: {
            type: FIELD_TYPES.INTEGER,
            label: "Зеркальная симметрия по Y",
            description: "",
            default: -1,
            minimum: -1,
            maximum: 1,
        },
        countTimeSteps: {
            type: FIELD_TYPES.INTEGER,
            label: "Число интервалов по времени",
            description: "",
            default: 0,
            minimum: 0,
        },
        timeStep: {
            type: FIELD_TYPES.FLOAT,
            label: "Шаг по времени, сек",
            description: "",
            default: 0,
            minimum: 0,
        },

        polusForceX: {
            type: FIELD_TYPES.FLOAT,
            label: "X - полюс для моментов, мм",
            description: "",
            default: 0,
        },

        polusForceY: {
            type: FIELD_TYPES.FLOAT,
            label: "Y - полюс для моментов, мм",
            description: "",
            default: 0,
        },

        polusForceZ: {
            type: FIELD_TYPES.FLOAT,
            label: "Z - полюс для моментов, мм",
            description: "",
            default: 0,
        },

        evalForce: {
            type: FIELD_TYPES.BOOLEAN,
            label: "Вычисление силы/момента",
            description: "",
            default: false,
            textOn: "Да",
            textOff: "Нет",
        },

        htcRegimFC: {
            type: FIELD_TYPES.BOOLEAN,
            label: "ВТСП: режим",
            description: "",
            default: false,
            textOn: "FC режим",
            textOff: "ZFC режим",
        },

        htcMu: {
            type: FIELD_TYPES.BOOLEAN,
            label: "ВТСП: Магнитная подсистема",
            description: "",
            default: true,
            textOn: "Используется",
            textOff: "Отключено",
        },

        htcRo: {
            type: FIELD_TYPES.BOOLEAN,
            label: "ВТСП: Токовая подсистема",
            description: "",
            default: true,
            textOn: "Используется",
            textOff: "Отключено",
        }

    }

});
