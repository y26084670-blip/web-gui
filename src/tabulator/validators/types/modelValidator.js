//==============================================================================
// Проверка логической согласованности модели
//
// Перечень вкладок задаётся tabRegistry; modelRegistry сопоставляет
// идентификатор вкладки её прикладному валидатору.
//==============================================================================

import { tabRegistry } from "../../../services/tabRegistry.js";
import { modelRegistry } from "../models/modelRegistry.js";

/**
 * Проверка логической согласованности модели.
 *
 * @param {Object} service
 * @returns {Array} diagnostics
 */
export function modelValidator(service) {
    const diagnostics = [];
    for (const schema of tabRegistry) {
        const validator = modelRegistry[schema.id];
        if (!validator) continue;
        validator(
            service,
            diagnostics,
        );
    }
    return diagnostics;
}