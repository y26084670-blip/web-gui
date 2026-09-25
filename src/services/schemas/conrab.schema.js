/*
Источник: solver/src/core/types.jl, Conrab; startITER и fullJNewton — логические параметры.
Файл содержит две RECORDS-записи: Float32, затем Float64.
Каждая запись содержит 11 сериализуемых полей; отсутствующие поля получают default схемы.
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
    obsoleteStoragePaths: ["KB2", "B20", "KEPS2", "KEPS3", "KEPS4",
        "EPS_0", "TAU_0", "KB1", "KEPS1", "CF_KEPS"],
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

        startITER: {
            type: FIELD_TYPES.BOOLEAN,
            label: "StartITER",
            description: "Начальное приближение итерационного процесса: "
                + "true — нулевые значения; "
                + "false — значения предыдущей итерации",
            default: false,
            textOn: "Нулевые значения",
            textOff: "Предыдущая итерация",
        },

        EPS: {
            type: FIELD_TYPES.FLOAT,
            label: "EPS — общий критерий",
            description: "Общий критерий выхода из итерационного процесса, включая t = 0",
            default: 0.005,
            digits: 6,
        },

        TAU: {
            type: FIELD_TYPES.FLOAT,
            label: "TAU — общий параметр",
            description: "Общий параметр итерационного процесса, включая t = 0",
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

        CF_FMMEPS: {
            type: FIELD_TYPES.FLOAT,
            label: "CF_FMMEPS — допуск M, кА/м",
            description: "Абсолютный допуск невязки намагниченности ФММ: "
                + "abs(M из уравнений − M по характеристике) < CF_FMMEPS. "
                + "Конечное положительное число. На насыщенной ветви поиск продолжается "
                + "до неделимого машинного интервала. Не зависит от EPS.",
            default: 0.01,
            exclusiveMinimum: 0,
            digits: 6,
        },

        CF_HTSEPS: {
            type: FIELD_TYPES.FLOAT,
            label: "CF_HTSEPS — допуск M, кА/м",
            description: "Абсолютный допуск невязки намагниченности магнитной подсистемы ВТСП: "
                + "abs(M из уравнений − M по характеристике) < CF_HTSEPS. "
                + "Конечное положительное число. На насыщенной ветви поиск продолжается "
                + "до неделимого машинного интервала. Не зависит от EPS.",
            default: 0.01,
            exclusiveMinimum: 0,
            digits: 6,
        },

        fullJNewton: {
            type: FIELD_TYPES.BOOLEAN,
            label: "fullJNewton — полный Newton [J/λ]",
            description: "Выбор метода решения совместной системы для плотности тока J "
                + "и множителей Лагранжа λ в ШГ с линейными электропроводящими свойствами. "
                + "true — полный метод Ньютона с GMRES всей токовой системы; "
                + "false — упрощённая блочная коррекция: локальные системы 3×3 "
                + "и система Шура для множителей, без внутреннего GMRES. "
                + "В обоих режимах сохраняются полные физические уравнения, ограничения "
                + "и критерии сходимости. Полный режим можно включить для контрольного "
                + "расчёта или при трудностях сходимости упрощённого режима. "
                + "При наличии ВТСП-проводников, в том числе в смешанной задаче, "
                + "для всей токовой системы всегда используется полный метод независимо "
                + "от fullJNewton. Нелинейность только магнитных свойств сама по себе "
                + "не включает полный токовый метод. Параметр не отключает токи "
                + "и не заменяет настройку «Подключить токовую подсистему» (htcRo). "
                + "Значение задаётся отдельно для Float32 и Float64; применяется активный "
                + "профиль. По умолчанию false, в том числе при отсутствии поля в conrab.txt.",
            default: false,
            textOn: "Полный Newton",
            textOff: "Упрощённый Newton",
        },

    },
});
