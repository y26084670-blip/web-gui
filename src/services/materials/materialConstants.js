export const HTC_PARAMETER_NAMES = Object.freeze([
    "j_HC0",
    "JC0",
    "JCa",
    "JCb",
    "j_type",
    "j_gmin",
    "j_gmax",
    "j1_delta",
    "j2_n",
    "m_type",
    "m_HC0",
    "m1_delta",
    "m3_Mmax",
    "m3_a",
    "m3_b",
    "KHabc",
    "Diag",
    "M3D",
]);

// solver/src/core/types.jl — defaults конструктора PropHTC.
export const HTC_EFFECTIVE_DEFAULTS = Object.freeze({
    KHabc: 1,
    Diag: 0,
    M3D: false,
});
