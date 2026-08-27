import { FIELD_TYPES, STORAGE_TYPES } from "../schemas/common/constants.js";
import { isStoredProperty } from "./modelCompute.js";
import {
    fromStorage,
    hasMatrixShape,
    toStorage,
} from "./arrayShape.js";

// Преобразование модели хранения в Базовую модель
export function deserialize(storageModel, schema) {
    if (schema.config.storage === STORAGE_TYPES.CLUSTER) {
        return deserializeItem(storageModel, schema.properties);
    }
    if (schema.config.storage === STORAGE_TYPES.RECORDS) {
        return storageModel.map(item =>
            deserializeItem(item, schema.properties)
        );
    }
    throw new Error(
        `Неизвестный тип хранения '${schema.config.storage}'`
    );
}

// Преобразование Базовой модели в модель хранения
export function serialize(baseModel, schema) {
    if (schema.config.storage === STORAGE_TYPES.CLUSTER) {
        return serializeItem(
            baseModel,
            schema.properties,
        );
    }
    if (schema.config.storage === STORAGE_TYPES.RECORDS) {
        return baseModel.map(item =>
            serializeItem(
                item,
                schema.properties,
            )
        );
    }
    throw new Error(
        `Неизвестный тип хранения '${schema.config.storage}'`
    );
}

// Путь свойства в StorageModel.
export function propertyStoragePath(propertyName, property) {
    return property.storageKey ?? propertyName;
}

// Есть ли значение по составному пути.
export function hasStorageValue(storageItem, path) {
    let current = storageItem;

    for (const segment of storagePathSegments(path)) {
        if (!isStorageObject(current) ||
            !Object.prototype.hasOwnProperty.call(current, segment)) {
            return false;
        }
        current = current[segment];
    }

    return true;
}

// Чтение значения по составному пути.
export function getStorageValue(storageItem, path) {
    let current = storageItem;

    for (const segment of storagePathSegments(path)) {
        if (!isStorageObject(current) ||
            !Object.prototype.hasOwnProperty.call(current, segment)) {
            return undefined;
        }
        current = current[segment];
    }

    return current;
}

// Поиск неизвестных ключей с учётом объявленных составных путей.
// Если путь объявляет объект целиком, его внутреннее содержимое не проверяется.
export function findUnknownStoragePaths(storageItem, declaredPaths) {
    const root = createStoragePathTree(declaredPaths);
    const unknown = [];

    function visit(value, node, prefix) {
        if (!isStorageObject(value)) return;

        for (const key of Object.keys(value)) {
            const path = prefix ? `${prefix}.${key}` : key;
            const child = node.children.get(key);

            if (!child) {
                unknown.push(path);
                continue;
            }
            if (child.terminal) continue;

            visit(value[key], child, path);
        }
    }

    visit(storageItem, root, "");
    return unknown;
}

// -------------------------------------------------------

function deserializeItem(storageItem, properties) {
    const baseItem = {};

    for (const [key, property] of Object.entries(properties)) {
        if (!isStoredProperty(property)) {
            baseItem[key] = structuredClone(property.default);
            continue;
        }

        const path = propertyStoragePath(key, property);
        baseItem[key] = hasStorageValue(storageItem, path)
            ? structuredClone(getStorageValue(storageItem, path))
            : structuredClone(property.default);
    }

    reshapeArrays(baseItem, properties);
    return baseItem;
}

function reshapeArrays(item, properties) {
    for (const [key, property] of Object.entries(properties)) {
        if (property.type !== FIELD_TYPES.ARRAY) continue;
        if (!hasMatrixShape(property)) continue;

        const value = item[key];
        if (!Array.isArray(value)) continue;

        item[key] = fromStorage(value, property);
    }
}

// -------------------------------------------------------

function serializeItem(baseItem, properties) {
    const storageItem = {};

    for (const [key, property] of Object.entries(properties)) {
        if (!isStoredProperty(property)) continue;
        if (!(key in baseItem)) continue;

        let value = structuredClone(baseItem[key]);
        if (
            property.type === FIELD_TYPES.ARRAY &&
            hasMatrixShape(property)
        ) {
            value = toStorage(value, property);
        }

        setStorageValue(
            storageItem,
            propertyStoragePath(key, property),
            value,
        );
    }

    return storageItem;
}

function setStorageValue(storageItem, path, value) {
    const segments = storagePathSegments(path);
    let current = storageItem;

    for (let index = 0; index < segments.length - 1; index++) {
        const segment = segments[index];
        if (!isStorageObject(current[segment])) {
            current[segment] = {};
        }
        current = current[segment];
    }

    current[segments[segments.length - 1]] = value;
}

function storagePathSegments(path) {
    return path.split(".");
}

function isStorageObject(value) {
    return value !== null &&
        typeof value === "object" &&
        !Array.isArray(value);
}

function createStoragePathTree(paths) {
    const root = {
        terminal: false,
        children: new Map(),
    };

    for (const path of paths) {
        let node = root;

        for (const segment of storagePathSegments(path)) {
            if (!node.children.has(segment)) {
                node.children.set(segment, {
                    terminal: false,
                    children: new Map(),
                });
            }
            node = node.children.get(segment);
        }

        node.terminal = true;
    }

    return root;
}
