/*
Источник: solver/src/core/types.jl, Conrab. Снимок 2026-08.
Файл содержит две RECORDS-записи: Float32, затем Float64.
Каждая запись содержит 12 сериализуемых полей.
*/
import {
    TABS,
    STORAGE_TYPES,
    FIELD_TYPES,
    FILES,
} from "../../services/schemas/common/constants";
import { createSchema } from "../schemaFactory";

export default createSchema({
    id: TABS.CONRAB.id,
    title: TABS.CONRAB.label,
    file: FILES.CONRAB,
    storage: STORAGE_TYPES.RECORDS,
    required: true,
    recordCount: 2,
    singleRecordFallback: {
        message: "При загрузке файла 'conrab.txt' найдена одна строка. "
            + "Значения продублированы для Float32 и Float64; "
            + "при сохранении будут записаны обе строки.",
    },
    obsoleteStoragePaths: ["KB2", "B20", "KEPS2", "KEPS3", "KEPS4"],
    rowLabelDescription: "Параметры математической модели",

    views: {
        recordsAsColumns: {
            labels: ["Float32", "Float64"],
            activeRecord: {
                dependencies: [TABS.GENERAL.id],
                index({ model }) {
                    const precision = model[TABS.GENERAL.id]?.doubleFloat;
                    return typeof precision === "boolean"
                        ? Number(precision)
                        : null;
                },
            },
        },
    },

    properties: {

        // итерационный процесс

        EPS: {
            type: FIELD_TYPES.FLOAT,
            label: "EPS — общий критерий",
            description: "Общий критерий выхода из итерационного процесса",
            default: 0.005,
            digits: 6,
        },

        EPS_0: {
            type: FIELD_TYPES.FLOAT,
            label: "EPS_0 — критерий при t = 0",
            description: "Критерий на нулевом временном шаге; 0 — использовать EPS; рекомендуется при учете вихревых токов",
            default: 0.0005,
            digits: 6,
        },

        TAU: {
            type: FIELD_TYPES.FLOAT,
            label: "TAU — общий параметр",
            description: "Общий параметр итерационного процесса",
            default: 0.3,
            digits: 6,
        },

        TAU_0: {
            type: FIELD_TYPES.FLOAT,
            label: "TAU_0 — параметр при t = 0",
            description: "Параметр на нулевом временном шаге; 0 — использовать TAU",
            default: 0.3,
            digits: 6,
        },

        EXTRA: {
            type: FIELD_TYPES.BOOLEAN,
            label: "Экстраполяция",
            description: "Использование экстраполяции для намагниченности",
            default: true,
            textOn: "Использовать",
            textOff: "Не использовать",
        },

        // формирование уравнений

        ADMIN: {
            type: FIELD_TYPES.FLOAT,
            label: "ADMIN",
            description: "Нижнее регулязирующее ограничение диагональных элементов для намагниченности",
            default: 0.01,
            digits: 6,
        },

        // интегрирование

        UZMIN: {
            type: FIELD_TYPES.FLOAT,
            label: "UZMIN",
            description: "Регуляризирующее ограничение на расстояние от точки наблюдения до площадки",
            default: 0.005,
            digits: 6,
        },

        KPY: {
            type: FIELD_TYPES.INTEGER,
            label: "KPY",
            description: "Параметр точности интегрирования",
            default: 150,
        },

        LONGD: {
            type: FIELD_TYPES.FLOAT,
            label: "LONGD",
            description: "Коэффициент перехода к квадратуре дальней зоны: LONGD * |SY| <= YY; SY—интервал, YY — расстояние в плоскости y–z от точки наблюдения до начала интервала",
            default: 150,
            digits: 6,
        },

        // материальные уравнения

        KB1: {
            type: FIELD_TYPES.FLOAT,
            label: "KB1",
            description: "Коэффициент для начальной нижней границы поиска J: b1=zero1*KB1",
            default: 1,
            digits: 6,
        },

        KEPS1: {
            type: FIELD_TYPES.FLOAT,
            label: "KEPS1",
            description: "Коэффициент критерия выхода из поиска J по интервалу: abs(b2-b1) < KEPS1",
            default: 1,
            digits: 6,
        },

        CF_KEPS: {
            type: FIELD_TYPES.FLOAT,
            label: "CF_KEPS",
            description: "ВТСП-модель: Mагнитная подсистема: Параметр критерия выхода по невязке, кА/м: DH <= DHmin && (DH == ZERO || abs(CF) <= CF_KEPS)",
            default: 1,
            digits: 6,
        },

    },
});
