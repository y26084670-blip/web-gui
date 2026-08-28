/*
Источник: solver/src/core/types.jl, Conrab. Снимок 2026-08.
Файл содержит две RECORDS-записи: Float32, затем Float64.
Каждая запись содержит 17 сериализуемых полей.
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
    rowLabelDescription: "Параметры математической модели",

    views: {
        recordsAsColumns: {
            labels: ["Float32", "Float64"],
        },
    },

    properties: {
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
            description: "Критерий на нулевом временном шаге; 0 — использовать EPS",
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

        ADMIN: {
            type: FIELD_TYPES.FLOAT,
            label: "ADMIN",
            description: "Нижнее ограничение диагональных элементов для намагниченности",
            default: 0.05,
            digits: 6,
        },

        UZMIN: {
            type: FIELD_TYPES.FLOAT,
            label: "UZMIN",
            description: "Ограничение на расстояние до площадки",
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
            description: "Коэффициент при Y-размере интервала интегрирования; не используется, так как режим дальней зоны удалён",
            default: 20000,
            digits: 6,
        },

        KB1: {
            type: FIELD_TYPES.FLOAT,
            label: "KB1",
            description: "Коэффициент начальной нижней границы поиска E",
            default: 1,
            digits: 6,
        },

        KB2: {
            type: FIELD_TYPES.FLOAT,
            label: "KB2",
            description: "Коэффициент начальной верхней границы поиска E",
            default: 1,
            digits: 6,
        },

        B20: {
            type: FIELD_TYPES.FLOAT,
            label: "B20",
            description: "Слагаемое начальной верхней границы поиска E",
            default: 0,
            digits: 6,
        },

        KEPS1: {
            type: FIELD_TYPES.FLOAT,
            label: "KEPS1",
            description: "Коэффициент критерия выхода из поиска E по интервалу",
            default: 1,
            digits: 6,
        },

        KEPS2: {
            type: FIELD_TYPES.FLOAT,
            label: "KEPS2",
            description: "Коэффициент критерия выхода дополнительной системы по интервалу",
            default: 1,
            digits: 6,
        },

        KEPS3: {
            type: FIELD_TYPES.FLOAT,
            label: "KEPS3",
            description: "Коэффициент критерия выхода дополнительной системы по невязке",
            default: 1,
            digits: 6,
        },

        KEPS4: {
            type: FIELD_TYPES.FLOAT,
            label: "KEPS4",
            description: "Критерий поиска H' по M-невязке в магнитной подсистеме ВТСП, кА/м",
            default: 1,
            digits: 6,
        },

        CF_KEPS: {
            type: FIELD_TYPES.FLOAT,
            label: "CF_KEPS",
            description: "Критерий выхода дополнительной системы ВТСП по невязке, кА/м",
            default: 1,
            digits: 6,
        },

    },
});
