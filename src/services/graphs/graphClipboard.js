const DEFAULT_IMAGE_BACKGROUND = "#20262d";

function cleanCell(value) {
    return String(value ?? "").replace(/[\t\r\n]+/gu, " ");
}
function valueColumns(property, rows) {
    const declared = Array.isArray(property?.columns)
        ? property.columns
        : [];
    const rowWidth = Array.isArray(rows)
        ? rows.reduce(
            (maximum, row) => Math.max(
                maximum,
                Array.isArray(row) ? row.length : 0,
            ),
            0,
        )
        : 0;
    const count = Math.max(
        Number.isInteger(property?.nColumns) ? property.nColumns : 0,
        declared.length,
        rowWidth,
    );

    return Array.from(
        { length: count },
        (_item, index) => declared[index] ?? `C${index + 1}`,
    );
}

export function createDetailTableBlock({
    title,
    property,
    rows,
    itemLabels,
}) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const columns = valueColumns(property, sourceRows);

    return {
        title: title ?? property?.label ?? "",
        headers: [
            property?.itemLabelTitle ?? "#",
            ...columns,
        ],
        rows: sourceRows.map((row, index) => [
            itemLabels?.[index] ?? index + 1,
            ...columns.map((_column, column) => row?.[column] ?? ""),
        ]),
    };
}

export function createGeneratedDetailTableBlock({
    title,
    property,
    points,
    valueColumn,
}) {
    const columnCount = valueColumns(property, []).length;
    const rows = (Array.isArray(points) ? points : []).map((point) => {
        const row = Array.from({ length: columnCount }, () => "");
        row[0] = point?.[0] ?? "";
        if (Number.isInteger(valueColumn) && valueColumn >= 0) {
            row[valueColumn] = point?.[1] ?? "";
        }
        return row;
    });

    return createDetailTableBlock({
        title,
        property,
        rows,
    });
}

export function graphTablesToTsv(tables) {
    return (Array.isArray(tables) ? tables : [])
        .map((table) => [
            cleanCell(table?.title),
            (table?.headers ?? []).map(cleanCell).join("\t"),
            ...(table?.rows ?? []).map(
                row => row.map(cleanCell).join("\t"),
            ),
        ].join("\n"))
        .join("\n\n");
}

export async function copyGraphTables(
    tables,
    { clipboard = globalThis.navigator?.clipboard } = {},
) {
    const text = graphTablesToTsv(tables);
    if (!text) {
        throw new Error("Нет данных для копирования.");
    }
    if (typeof clipboard?.writeText !== "function") {
        throw new Error("Текстовый буфер обмена недоступен.");
    }

    await clipboard.writeText(text);
}

function canvasToPng(canvas, background) {
    const document = canvas?.ownerDocument;
    const exportCanvas = document?.createElement?.("canvas");
    if (!exportCanvas) {
        throw new Error("Не удалось создать изображение графика.");
    }

    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const context = exportCanvas.getContext("2d");
    if (!context) {
        throw new Error("Не удалось подготовить изображение графика.");
    }

    context.fillStyle = background;
    context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    context.drawImage(canvas, 0, 0);

    return new Promise((resolve, reject) => {
        exportCanvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error("Не удалось сформировать PNG графика."));
            }
        }, "image/png");
    });
}

export async function copyGraphImage(
    canvas,
    {
        background = DEFAULT_IMAGE_BACKGROUND,
        clipboard = globalThis.navigator?.clipboard,
        ClipboardItemType = globalThis.ClipboardItem,
    } = {},
) {
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
        throw new Error("График ещё не построен.");
    }
    if (
        typeof clipboard?.write !== "function"
        || typeof ClipboardItemType !== "function"
    ) {
        throw new Error("Копирование изображений в буфер недоступно.");
    }

    const blob = await canvasToPng(canvas, background);
    await clipboard.write([
        new ClipboardItemType({ "image/png": blob }),
    ]);
}
