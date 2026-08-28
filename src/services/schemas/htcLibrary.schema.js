// Readonly-проекция базовой библиотеки характеристик ВТСП.
// Параметры остаются скалярными свойствами записи; таблица деталей является
// только View-проекцией и не меняет JSON-файл материала.
import {
    FIELD_TYPES,
    STORAGE_TYPES,
    TABS,
} from "./common/constants";
import { createSchema } from "../schemaFactory";
import { HTC_PARAMETER_NAMES } from "../materials/materialConstants";

const scalar = (type, label, description = label) => ({
    type,
    label,
    description,
    default: type === FIELD_TYPES.BOOLEAN ? false : 0,
    readonly: true,
    hidden: true,
});

export { HTC_PARAMETER_NAMES };

export default createSchema({
    id: TABS.HTC_LIBRARY.id,
    title: TABS.HTC_LIBRARY.label,
    storage: STORAGE_TYPES.RECORDS,
    required: false,
    stretchLastColumn: true,

    properties: {
        name: {
            type: FIELD_TYPES.STRING,
            label: "Название",
            description: "Имя характеристики и файла без расширения",
            default: "",
            readonly: true,
            columnWidth: 320,
        },

        j_HC0: scalar(FIELD_TYPES.FLOAT, "j_HC0"),
        JC0: scalar(FIELD_TYPES.FLOAT, "JC0"),
        JCa: scalar(FIELD_TYPES.FLOAT, "JCa"),
        JCb: scalar(FIELD_TYPES.FLOAT, "JCb"),
        j_type: scalar(FIELD_TYPES.INTEGER, "j_type"),
        j_gmin: scalar(FIELD_TYPES.FLOAT, "j_gmin"),
        j_gmax: scalar(FIELD_TYPES.FLOAT, "j_gmax"),
        j1_delta: scalar(FIELD_TYPES.FLOAT, "j1_delta"),
        j2_n: scalar(FIELD_TYPES.INTEGER, "j2_n"),
        m_type: scalar(FIELD_TYPES.INTEGER, "m_type"),
        m_HC0: scalar(FIELD_TYPES.FLOAT, "m_HC0"),
        m1_delta: scalar(FIELD_TYPES.FLOAT, "m1_delta"),
        m3_Mmax: scalar(FIELD_TYPES.FLOAT, "m3_Mmax"),
        m3_a: scalar(FIELD_TYPES.FLOAT, "m3_a"),
        m3_b: scalar(FIELD_TYPES.FLOAT, "m3_b"),
        KHabc: scalar(FIELD_TYPES.FLOAT, "KHabc"),
        Diag: scalar(FIELD_TYPES.FLOAT, "Diag"),
        M3D: scalar(FIELD_TYPES.BOOLEAN, "M3D"),

        comment: {
            type: FIELD_TYPES.STRING,
            label: "Комментарий",
            description: "Комментарий из файла характеристики",
            default: "",
            readonly: true,
            columnWidth: 620,
        },
    },
});
