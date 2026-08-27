import { STORAGE_TYPES } from "../schemas/common/constants.js";

const planCache = new WeakMap();

const COMPUTATION_SCOPES = Object.freeze({
    RECORD: "record",
    RECORDS: "records",
});

function computationEntry(property) {
    if (!property) return null;

    if (property.compute !== undefined) {
        return {
            kind: "compute",
            descriptor: property.compute,
        };
    }
    if (property.computeStored !== undefined) {
        return {
            kind: "computeStored",
            descriptor: property.computeStored,
        };
    }

    return null;
}

export function isComputedProperty(property) {
    return computationEntry(property) !== null;
}

export function isStoredProperty(property) {
    return property?.compute === undefined;
}

export function isPropertyReadonly(property) {
    return !!property?.readonly || isComputedProperty(property);
}

// Проверяет контракт вычисляемых свойств и кэширует стабильный
// топологический порядок. Функции вычисления здесь не запускаются.
export function validateComputationSchema(schema) {
    buildComputationPlan(schema, { refresh: true });
}

export function recomputeModel(schema, baseModel) {
    const plan = buildComputationPlan(schema);

    if (baseModel === null || baseModel === undefined || plan.length === 0) {
        return {
            model: baseModel,
            changed: false,
            patches: [],
        };
    }

    switch (schema.config.storage) {
        case STORAGE_TYPES.CLUSTER: {
            const result = recomputeRecord(
                schema,
                baseModel,
                plan,
                null,
                null,
            );
            return {
                model: result.record,
                changed: result.changed,
                patches: result.patches,
            };
        }

        case STORAGE_TYPES.RECORDS: {
            if (!Array.isArray(baseModel)) {
                throw new Error(
                    `Schema '${schema.id}': RECORDS BaseModel must be an array.`
                );
            }

            const needsRecordsSnapshot = plan.some(
                entry => entry.scope === COMPUTATION_SCOPES.RECORDS
            );
            const recordsSnapshot = needsRecordsSnapshot
                ? readonlySnapshot(baseModel)
                : null;
            let changed = false;
            const patches = [];
            const records = baseModel.map((record, recordIndex) => {
                const result = recomputeRecord(
                    schema,
                    record,
                    plan,
                    recordIndex,
                    recordsSnapshot,
                );
                changed ||= result.changed;
                patches.push(...result.patches);
                return result.record;
            });

            return {
                model: changed ? records : baseModel,
                changed,
                patches,
            };
        }

        default:
            throw new Error(
                `Schema '${schema.id}': unsupported storage type '${schema.config.storage}'.`
            );
    }
}

function buildComputationPlan(schema, { refresh = false } = {}) {
    if (!refresh && planCache.has(schema)) {
        return planCache.get(schema);
    }

    const properties = schema.properties ?? {};
    const propertyNames = Object.keys(properties);
    const computedNames = [];
    const entries = new Map();

    for (const propertyName of propertyNames) {
        const property = properties[propertyName];
        const hasCompute = property.compute !== undefined;
        const hasComputeStored = property.computeStored !== undefined;

        if (!hasCompute && !hasComputeStored) continue;

        if (hasCompute && hasComputeStored) {
            throw schemaError(
                schema,
                propertyName,
                "compute and computeStored are mutually exclusive.",
            );
        }

        const entry = computationEntry(property);
        const descriptor = entry.descriptor;

        if (
            !descriptor ||
            typeof descriptor !== "object" ||
            Array.isArray(descriptor)
        ) {
            throw schemaError(
                schema,
                propertyName,
                `${entry.kind} must be an object.`,
            );
        }

        if (
            !Array.isArray(descriptor.dependencies) ||
            descriptor.dependencies.length === 0 ||
            descriptor.dependencies.some(
                dependency =>
                    typeof dependency !== "string" ||
                    dependency.length === 0
            ) ||
            new Set(descriptor.dependencies).size !==
                descriptor.dependencies.length
        ) {
            throw schemaError(
                schema,
                propertyName,
                `${entry.kind}.dependencies must be a non-empty array `
                + "of unique property names.",
            );
        }

        if (typeof descriptor.evaluate !== "function") {
            throw schemaError(
                schema,
                propertyName,
                `${entry.kind}.evaluate must be a function.`,
            );
        }

        const scope =
            descriptor.scope ?? COMPUTATION_SCOPES.RECORD;
        if (
            scope !== COMPUTATION_SCOPES.RECORD &&
            scope !== COMPUTATION_SCOPES.RECORDS
        ) {
            throw schemaError(
                schema,
                propertyName,
                `${entry.kind}.scope must be 'record' or 'records'.`,
            );
        }
        if (
            scope === COMPUTATION_SCOPES.RECORDS &&
            schema.config.storage !== STORAGE_TYPES.RECORDS
        ) {
            throw schemaError(
                schema,
                propertyName,
                `${entry.kind}.scope 'records' requires RECORDS storage.`,
            );
        }

        if (property.readonly === false) {
            throw schemaError(
                schema,
                propertyName,
                "computed property cannot declare readonly: false.",
            );
        }

        if (property.const !== undefined) {
            throw schemaError(
                schema,
                propertyName,
                "computed property cannot declare const.",
            );
        }

        if (entry.kind === "compute" && property.storageKey !== undefined) {
            throw schemaError(
                schema,
                propertyName,
                "non-stored compute property cannot declare storageKey.",
            );
        }

        for (const dependency of descriptor.dependencies) {
            if (dependency === propertyName || !properties[dependency]) {
                throw schemaError(
                    schema,
                    propertyName,
                    `unknown computation dependency '${dependency}'.`,
                );
            }
        }

        computedNames.push(propertyName);
        entries.set(propertyName, {
            propertyName,
            property,
            kind: entry.kind,
            descriptor,
            scope,
        });
    }

    for (const entry of entries.values()) {
        if (entry.scope !== COMPUTATION_SCOPES.RECORDS) continue;

        const computedDependency = entry.descriptor.dependencies.find(
            dependency => entries.has(dependency)
        );
        if (computedDependency) {
            throw schemaError(
                schema,
                entry.propertyName,
                `${entry.kind}.scope 'records' cannot depend on computed `
                + `property '${computedDependency}'.`,
            );
        }
    }

    const indegree = new Map(
        computedNames.map(propertyName => [propertyName, 0])
    );
    const dependents = new Map(
        computedNames.map(propertyName => [propertyName, []])
    );

    for (const propertyName of computedNames) {
        const entry = entries.get(propertyName);

        for (const dependency of entry.descriptor.dependencies) {
            if (!entries.has(dependency)) continue;

            indegree.set(propertyName, indegree.get(propertyName) + 1);
            dependents.get(dependency).push(propertyName);
        }
    }

    const queue = computedNames.filter(
        propertyName => indegree.get(propertyName) === 0
    );
    const order = [];

    for (let index = 0; index < queue.length; index++) {
        const propertyName = queue[index];
        order.push(entries.get(propertyName));

        for (const dependent of dependents.get(propertyName)) {
            const next = indegree.get(dependent) - 1;
            indegree.set(dependent, next);
            if (next === 0) queue.push(dependent);
        }
    }

    if (order.length !== computedNames.length) {
        const cyclic = computedNames.filter(
            propertyName => !order.some(
                entry => entry.propertyName === propertyName
            )
        );
        throw new Error(
            `Schema '${schema.id}': computation cycle: ${cyclic.join(", ")}.`
        );
    }

    planCache.set(schema, order);
    return order;
}

function recomputeRecord(
    schema,
    record,
    plan,
    recordIndex,
    recordsSnapshot,
) {
    if (
        record === null ||
        typeof record !== "object" ||
        Array.isArray(record)
    ) {
        throw new Error(
            `Schema '${schema.id}': BaseModel record must be an object.`
        );
    }

    let resultRecord = record;
    let changed = false;
    const patches = [];

    for (const entry of plan) {
        const values = {};

        for (const dependency of entry.descriptor.dependencies) {
            values[dependency] = structuredClone(
                resultRecord[dependency]
            );
        }

        const evaluated = entry.descriptor.evaluate({
            values: Object.freeze(values),
            property: entry.property,
            propertyName: entry.propertyName,
            recordIndex,
            records:
                entry.scope === COMPUTATION_SCOPES.RECORDS
                    ? recordsSnapshot
                    : undefined,
        });

        if (
            evaluated &&
            typeof evaluated === "object" &&
            typeof evaluated.then === "function"
        ) {
            throw schemaError(
                schema,
                entry.propertyName,
                `${entry.kind}.evaluate must be synchronous.`,
            );
        }

        if (evaluated === undefined) {
            throw schemaError(
                schema,
                entry.propertyName,
                `${entry.kind}.evaluate returned undefined.`,
            );
        }

        if (deepEqual(resultRecord[entry.propertyName], evaluated)) {
            continue;
        }

        if (!changed) {
            resultRecord = { ...record };
            changed = true;
        }

        const value = structuredClone(evaluated);
        resultRecord[entry.propertyName] = value;
        patches.push({
            recordIndex,
            propertyName: entry.propertyName,
            value,
        });
    }

    return {
        record: resultRecord,
        changed,
        patches,
    };
}

function readonlySnapshot(value) {
    return deepFreeze(structuredClone(value));
}

function deepFreeze(value) {
    if (
        value === null ||
        typeof value !== "object" ||
        Object.isFrozen(value)
    ) {
        return value;
    }

    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
}

function deepEqual(left, right) {
    if (Object.is(left, right)) return true;

    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right)) return false;
        if (left.length !== right.length) return false;

        for (let index = 0; index < left.length; index++) {
            const leftHas = Object.prototype.hasOwnProperty.call(
                left,
                index,
            );
            const rightHas = Object.prototype.hasOwnProperty.call(
                right,
                index,
            );

            if (leftHas !== rightHas) return false;
            if (
                leftHas &&
                !deepEqual(left[index], right[index])
            ) {
                return false;
            }
        }

        return true;
    }

    if (isPlainObject(left) || isPlainObject(right)) {
        if (!isPlainObject(left) || !isPlainObject(right)) return false;

        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);
        if (leftKeys.length !== rightKeys.length) return false;

        return leftKeys.every(
            key =>
                Object.prototype.hasOwnProperty.call(right, key) &&
                deepEqual(left[key], right[key])
        );
    }

    return false;
}

function isPlainObject(value) {
    if (
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function schemaError(schema, propertyName, message) {
    return new Error(
        `Schema '${schema.id}', property '${propertyName}': ${message}`
    );
}
