const COLORS = Object.freeze([
    "#4e9af1",
    "#e36d67",
    "#5dbb75",
    "#d49b34",
    "#a27bd6",
    "#4fb8b3",
    "#df79b0",
    "#9aa347",
]);

export function fmmGraphDatasets(records) {
    if (!Array.isArray(records)) return [];

    return records.map((record, index) => {
        if (!Array.isArray(record?.tabl)) {
            throw new Error(`Характеристика '${record?.name ?? ""}' не содержит таблицу H–M.`);
        }
        const color = COLORS[index % COLORS.length];
        return {
            label: record.name || `Характеристика ${index + 1}`,
            data: record.tabl.map((row, rowIndex) => {
                if (
                    !Array.isArray(row)
                    || row.length !== 2
                    || !Number.isFinite(row[0])
                    || !Number.isFinite(row[1])
                ) {
                    throw new Error(
                        `Строка ${rowIndex + 1} характеристики '${record?.name ?? ""}' некорректна.`,
                    );
                }
                return { x: row[0], y: row[1] };
            }),
            borderColor: color,
            backgroundColor: color,
            pointRadius: 2,
            pointHoverRadius: 4,
            borderWidth: 2,
            fill: false,
            parsing: false,
        };
    });
}

export function fmmGraphConfig(records) {
    return {
        type: "line",
        data: { datasets: fmmGraphDatasets(records) },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            normalized: true,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: "#dce4ec" },
                },
            },
            scales: {
                x: {
                    type: "linear",
                    title: { display: true, text: "H, кА/м", color: "#dce4ec" },
                    ticks: { color: "#b8c3cd" },
                    grid: { color: "rgba(180, 195, 208, .16)" },
                },
                y: {
                    type: "linear",
                    title: { display: true, text: "M, кА/м", color: "#dce4ec" },
                    ticks: { color: "#b8c3cd" },
                    grid: { color: "rgba(180, 195, 208, .16)" },
                },
            },
        },
    };
}
