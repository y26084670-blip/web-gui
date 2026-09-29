// Параметры геометрической проверки из активного профиля conrab.txt.
export const GEOMETRY_VALIDATION_DEFAULTS = Object.freeze({
    GEO_ANGLE: 0.1,
});

export function geometryValidationSettings(profile = {}) {
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
        return { settings: {}, invalid: Object.keys(GEOMETRY_VALIDATION_DEFAULTS) };
    }
    const settings = {};
    const invalid = [];
    for (const [key, fallback] of Object.entries(GEOMETRY_VALIDATION_DEFAULTS)) {
        const value = Object.hasOwn(profile, key) ? profile[key] : fallback;
        settings[key] = value;
        if (!Number.isFinite(value)
            || value <= 0 || value >= 90) {
            invalid.push(key);
        }
    }
    return { settings, invalid };
}

export function modelGeometrySettings(model) {
    const index = model?.general?.doubleFloat === true ? 1 : 0;
    const profiles = model?.conrab;
    if (profiles == null) return geometryValidationSettings();
    if (!Array.isArray(profiles) || profiles.length !== 2
        || !profiles[index] || typeof profiles[index] !== "object"
        || Array.isArray(profiles[index])) return null;
    return geometryValidationSettings(profiles[index]);
}
