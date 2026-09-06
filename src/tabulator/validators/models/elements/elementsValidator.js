import {
    createError,
    createWarning,
} from "../../common/createDiagnostic.js";
import { TABS } from "../../../../services/schemas/common/constants.js";
import {
    unpackKvVertices,
    validateKvVerticesDetailed,
}
    from "../../../../services/solver/geometryKv.js";
import { validateElementMaterialReferences }
    from "../../../../services/materialReferenceValidation.js";

const GEO_SHAPE = Object.freeze({
    property: "geo",
    storagePath: "geo",
    rows: 8,
    columns: 3,
});

const FIXED_ARRAY_SHAPES = Object.freeze([
    { property: "symVi", storagePath: "sym.vi", rows: 3, columns: 1 },
    { property: "symR0", storagePath: "sym.r0", rows: 3, columns: 1 },
    GEO_SHAPE,
    { property: "dr", storagePath: "dr", rows: 3, columns: 1 },
    { property: "dp", storagePath: "dp", rows: 3, columns: 1 },
    { property: "vkan", storagePath: "vkan", rows: 3, columns: 1 },
    { property: "med", storagePath: "med", rows: 6, columns: 1 },
]);

const VALID_TARG = new Set([0, 1, 2, 3]);
const VALID_MODEL = new Set([0, 1, 2]);
const VALID_GEO_TYPE = new Set([0, 1, 2, 3, 4]);

const GEOMETRY_CHECK_DIAGNOSTICS = Object.freeze([
    ["edge13", "Длина ребра 13 не превышает 0,03"],
    ["edge57", "Длина ребра 57 не превышает 0,03"],
    ["edge15", "Длина ребра 15 не превышает 0,03"],
    ["edge37", "Длина ребра 37 не превышает 0,03"],
    ["edge26", "Длина ребра 26 не превышает 0,03"],
    [
        "parallel13And24",
        "Рёбра 13 и 24 не параллельны с заданной точностью",
    ],
    [
        "parallel57And68",
        "Рёбра 57 и 68 не параллельны с заданной точностью",
    ],
    [
        "parallel15And26",
        "Рёбра 15 и 26 не параллельны с заданной точностью",
    ],
    [
        "parallel37And26",
        "Рёбра 37 и 26 не параллельны с заданной точностью",
    ],
    [
        "parallel48And26",
        "Рёбра 48 и 26 не параллельны с заданной точностью",
    ],
    [
        "positiveVolume",
        "Ориентированный объём не превышает 0,000027 мм³",
    ],
]);

const UNPACK_DIAGNOSTICS = Object.freeze({
    1: Object.freeze({
        1: "Параметры сектора не задают поддерживаемую конфигурацию граней",
        2: "Параметры радиального сектора имеют недопустимый порядок координат",
        21: "В осевом секторе x4 не меньше x2",
        22: "В осевом секторе r1 больше r4",
        23: "В осевом секторе r2 больше r3",
    }),
    2: Object.freeze({
        1: "Прямоугольная призма содержит неположительный размер Lx, Ly или Lz",
    }),
    3: Object.freeze({
        1: "Усечённая пирамида содержит неположительный размер Hx, Ly, Lz, Ly2 или Lz2",
    }),
    4: Object.freeze({
        1: "Пирамида содержит неположительный размер L15, L37 или DY",
    }),
});

export function elementsValidator(
    service,
    diagnostics,
    context = {},
) {
    const elements = service.getModel()[TABS.ELEMENTS.id];
    if (!Array.isArray(elements)) return;

    validateArrayShapes(elements, diagnostics);
    validateRecordRules(elements, diagnostics);
    validateGeometry(elements, diagnostics);
    validateRecordOrder(elements, diagnostics);
    validateElementMaterialReferences(
        elements,
        context.materialCatalog,
        diagnostics,
    );
}

function validateRecordRules(elements, diagnostics) {
    elements.forEach((record, index) => {
        validateSymmetryPair({
            diagnostics,
            index,
            record,
            stepProperty: "symYl",
            countProperty: "symLs",
            multipleMessage:
                "при наличии локальных образов следует задать "
                + "ненулевой угол симметрии (шаг по углу)",
            unusedMessage:
                "при отсутствии локальных образов задавать "
                + "угол симметрии (шаг по углу) излишне",
        });
        validateSymmetryPair({
            diagnostics,
            index,
            record,
            stepProperty: "symYa",
            countProperty: "symAs",
            multipleMessage:
                "при наличии азимутальных образов следует задать "
                + "ненулевой угол симметрии (шаг по углу)",
            unusedMessage:
                "при отсутствии азимутальных образов задавать угол "
                + "симметрии (шаг по углу) излишне",
        });
        validateSymmetryPair({
            diagnostics,
            index,
            record,
            stepProperty: "symTx",
            countProperty: "symPs",
            multipleMessage:
                "при наличии периодических образов следует "
                + "задать ненулевой шаг вдоль оси",
            unusedMessage:
                "при отсутствии периодических образов задавать "
                + "шаг вдоль оси излишне",
        });

        if (Number.isFinite(record?.indMove) && record.indMove < 0) {
            diagnostics.push(createError({
                tab: TABS.ELEMENTS,
                row: index + 1,
                property: "indMove",
                message:
                    "индекс движения не может быть отрицательным",
            }));
        }

        if (Number.isFinite(record?.rv) && record.rv < 0) {
            diagnostics.push(createError({
                tab: TABS.ELEMENTS,
                row: index + 1,
                property: "rv",
                message:
                    "электропроводность не может быть отрицательной",
            }));
        }

        validateDiscretization(record, index, diagnostics);
    });
}

function validateSymmetryPair({
    diagnostics,
    index,
    record,
    stepProperty,
    countProperty,
    multipleMessage,
    unusedMessage,
}) {
    const step = record?.[stepProperty];
    const count = record?.[countProperty];
    if (!Number.isFinite(step) || !Number.isInteger(count)) return;

    if (step === 0 && count > 1) {
        diagnostics.push(createError({
            tab: TABS.ELEMENTS,
            row: index + 1,
            property: stepProperty,
            message: multipleMessage,
        }));
    } else if (step !== 0 && count === 1) {
        diagnostics.push(createWarning({
            tab: TABS.ELEMENTS,
            row: index + 1,
            property: stepProperty,
            message: unusedMessage,
        }));
    }
}

function validateDiscretization(record, index, diagnostics) {
    if (!hasCompleteShape(record?.dp, { rows: 3, columns: 1 })) return;

    record.dp.forEach((row, directionIndex) => {
        const value = row[0];
        if (Number.isInteger(value) && value >= 1) return;

        diagnostics.push(createError({
            tab: TABS.ELEMENTS,
            row: index + 1,
            property: "dp",
            message:
                `разбиение D${directionIndex + 1} должно быть задано `
                + "положительным целым числом",
        }));
    });
}

function validateArrayShapes(elements, diagnostics) {
    elements.forEach((record, index) => {
        for (const shape of FIXED_ARRAY_SHAPES) {
            if (hasCompleteShape(record?.[shape.property], shape)) {
                continue;
            }

            diagnostics.push(
                createError({
                    tab: TABS.ELEMENTS,
                    row: index + 1,
                    property: shape.property,
                    message:
                        "Массив '" + shape.storagePath + "' должен содержать "
                        + shape.rows + " × " + shape.columns
                        + " заполненных значений",
                })
            );
        }
    });
}

function validateGeometry(elements, diagnostics) {
    elements.forEach((record, index) => {
        if (
            !VALID_GEO_TYPE.has(record?.geoType)
            || !hasCompleteShape(record?.geo, GEO_SHAPE)
        ) {
            return;
        }

        const unpacked = unpackKvVertices(
            record.geo.flat(),
            record.geoType,
        );

        const unpackMessage =
            UNPACK_DIAGNOSTICS[record.geoType]?.[unpacked.err];
        if (unpackMessage) {
            pushGeometryError(diagnostics, index, unpackMessage);
        }

        const validation = validateKvVerticesDetailed(unpacked.vertices);
        if (validation.malformed) {
            pushGeometryError(
                diagnostics,
                index,
                "После распаковки геометрия содержит некорректные координаты",
            );
            return;
        }

        for (const [check, message] of GEOMETRY_CHECK_DIAGNOSTICS) {
            if (!validation.checks[check]) {
                pushGeometryError(diagnostics, index, message);
            }
        }
    });
}

function pushGeometryError(diagnostics, index, message) {
    diagnostics.push(
        createError({
            tab: TABS.ELEMENTS,
            row: index + 1,
            property: "geo",
            message,
        })
    );
}

function validateRecordOrder(elements, diagnostics) {
    let maximumTarg = null;
    let nonModelTwoSeen = false;

    elements.forEach((record, index) => {
        const targ = record?.targ;

        if (!VALID_TARG.has(targ)) return;

        if (maximumTarg !== null && targ < maximumTarg) {
            diagnostics.push(
                createError({
                    tab: TABS.ELEMENTS,
                    row: index + 1,
                    property: "targ",
                    message:
                        "Записи elements должны располагаться по "
                        + "неубыванию targ (0, 1, 2, 3)",
                })
            );
        }

        maximumTarg = maximumTarg === null
            ? targ
            : Math.max(maximumTarg, targ);

        if (targ !== 0 || !VALID_MODEL.has(record?.model)) return;

        if (record.model === 2) {
            if (nonModelTwoSeen) {
                diagnostics.push(
                    createError({
                        tab: TABS.ELEMENTS,
                        row: index + 1,
                        property: "model",
                        message:
                            "В группе targ = 0 записи с model = 2 "
                            + "должны предшествовать остальным",
                    })
                );
            }
        }
        else {
            nonModelTwoSeen = true;
        }
    });
}

function hasCompleteShape(value, { rows, columns }) {
    return Array.isArray(value) &&
        value.length === rows &&
        Array.from(value).every(row =>
            Array.isArray(row) &&
            row.length === columns &&
            Array.from(row).every(cell =>
                cell !== null &&
                cell !== undefined
            )
        );
}
