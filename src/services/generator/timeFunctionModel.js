import { compileTimeExpression } from "./timeFunctionExpression.js";

export const MAX_GENERATED_NODES = 1_000_001;

function requireFinite(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        throw new Error(`${label} должно быть конечным числом.`);
    }
    return number;
}

export function timeGrid({ countTimeSteps, timeStep }) {
    const intervals = Number(countTimeSteps);
    const step = requireFinite(timeStep, "Шаг по времени");

    if (!Number.isSafeInteger(intervals) || intervals < 0) {
        throw new Error("Число интервалов по времени должно быть целым и неотрицательным.");
    }
    if (step < 0 || (intervals > 0 && step === 0)) {
        throw new Error(
            "Шаг по времени должен быть положительным при ненулевом числе интервалов.",
        );
    }
    if (intervals + 1 > MAX_GENERATED_NODES) {
        throw new Error(
            `Генератор поддерживает не более ${MAX_GENERATED_NODES} узлов.`,
        );
    }

    return Array.from(
        { length: intervals + 1 },
        (_, index) => index * step,
    );
}

export function generateTimeSeries({
    expression,
    countTimeSteps,
    timeStep,
    minimumTime,
    maximumTime,
}) {
    const minimum = requireFinite(minimumTime, "Начало диапазона");
    const maximum = requireFinite(maximumTime, "Конец диапазона");
    if (minimum > maximum) {
        throw new Error("Начало диапазона не должно превышать его конец.");
    }

    const evaluate = compileTimeExpression(expression);
    return timeGrid({ countTimeSteps, timeStep }).map((time, index) => {
        if (time < minimum || time > maximum) {
            return [time, 0];
        }

        try {
            return [time, evaluate(time)];
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(
                `Не удалось вычислить узел ${index + 1} при t = ${time}: ${message}`,
            );
        }
    });
}

function sameTime(left, right) {
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    const tolerance = Number.EPSILON * 16 * Math.max(1, Math.abs(left), Math.abs(right));
    return Math.abs(left - right) <= tolerance;
}

function existingRowAtTime(rows, time) {
    if (!Array.isArray(rows)) return null;
    return rows.find(row => Array.isArray(row) && sameTime(row[0], time)) ?? null;
}

function targetDescriptor(generator, targetValue) {
    const target = generator?.targets?.find(item => item.value === targetValue);
    if (!target) {
        throw new Error(`Неизвестная величина генератора '${targetValue ?? ""}'.`);
    }
    return target;
}

export function applyGeneratedSeries({
    schema,
    record,
    targetValue,
    points,
}) {
    const generator = schema?.views?.generator;
    const target = targetDescriptor(generator, targetValue);
    if (!record || typeof record !== "object" || Array.isArray(record)) {
        throw new Error("Не выбрана запись для применения зависимости.");
    }
    if (!Array.isArray(points) || points.length === 0) {
        throw new Error("Сначала сформируйте зависимость.");
    }

    const properties = generator.synchronizedProperties ?? [target.property];
    const patch = {};

    for (const propertyName of properties) {
        const property = schema.properties[propertyName];
        if (!Number.isInteger(property?.nColumns) || property.nColumns < 2) {
            throw new Error(
                `Свойство '${propertyName}' не является таблицей временной зависимости.`,
            );
        }

        patch[propertyName] = points.map(([time]) => {
            const existing = existingRowAtTime(record[propertyName], time);
            const row = Array.from(
                { length: property.nColumns },
                (_, column) => {
                    if (column === 0) return time;
                    const value = existing?.[column];
                    return Number.isFinite(value) ? value : 0;
                },
            );
            return row;
        });
    }

    patch[target.property].forEach((row, index) => {
        row[target.column] = points[index][1];
    });

    return patch;
}
