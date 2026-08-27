/*
{"impuls":[0.0,4.0,5.0,6.0,7.0,8.0,1.0,1.0,0.9659,0.866,0.7071,0.0],"n":6}
...
json_amplitude = JSON_Amplitude()
me.amplitudes = Amplitude[]
while !eof(f)
    json_str = readline(f)
    JSON3.read!(json_str, json_amplitude)
    # копирование данных из 1d json массивов в матрицы
    amplitude.impuls = fcopy(json_amplitude.impuls, 2)
    amplitude.n = json_amplitude.n
    push!(me.amplitudes, deepcopy(amplitude))
end    
...
mutable struct JSON_Amplitude
    impuls::VEC = VNULL()
    n::INT = 0
end
mutable struct Amplitude
    impuls::APPROX = MNULL()
    n::INT = 0
end
amplitudes::Vector{Amplitude} = Amplitude[]
*/
import { VIEW_TYPES, TABS, STORAGE_TYPES, FIELD_TYPES, FILES } from "../../services/schemas/common/constants";
import { createSchema } from "../schemaFactory";
import { nodeCount } from "../solver/kvDerived";

function impulsePairsSummary({ presentation }) {
    const rows = presentation?.rows;
    if (!Array.isArray(rows)) return "";

    return rows
        .map(row => {
            const time = row?.[0] ?? "";
            const amplitude = row?.[1] ?? "";
            return `(${time}, ${amplitude})`;
        })
        .join(", ");
}

export default createSchema({

    id: TABS.AMPS.id,

    title: TABS.AMPS.label,

    file: FILES.AMPLITUDES,

    storage: STORAGE_TYPES.RECORDS,

    required: false,
    stretchLastColumn: true,

    properties: {

        impuls: {
            type: FIELD_TYPES.ARRAY,
            view: VIEW_TYPES.TABLE,
            label: "Amplitude",
            description: "Amplitude points",
            default: [],
            digits: 6,
            nColumns: 2,
            columns: ["Время, сек", "Амплитуда",],
            items: {
                type: FIELD_TYPES.FLOAT,
                default: 0,
                digits: 6,
                description: "Amplitude value",
            },
            summary: impulsePairsSummary,
        },

        n: {
            type: FIELD_TYPES.INTEGER,
            label: "Число узлов",
            description: "Число строк таблицы амплитуды",
            default: 0,
            readonly: true,
            hidden: true,
            computeStored: {
                dependencies: ["impuls"],
                evaluate: ({ values }) => nodeCount(values.impuls),
            },
        },

    }
});