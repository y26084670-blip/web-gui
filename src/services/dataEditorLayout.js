export const DATA_EDITOR_SPLIT_LIMITS = Object.freeze({
    tableWidth: 480,
    generatorWidth: 280,
    splitterSize: 6,
});

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
}

export function resizedEditorTableRatio({
    pointerX,
    containerLeft,
    containerWidth,
    limits = DATA_EDITOR_SPLIT_LIMITS,
}) {
    const contentWidth = Math.max(
        1,
        containerWidth - limits.splitterSize,
    );
    const maximum = Math.max(
        limits.tableWidth,
        contentWidth - limits.generatorWidth,
    );
    const tableWidth = clamp(
        pointerX - containerLeft,
        limits.tableWidth,
        maximum,
    );
    return tableWidth / contentWidth;
}


export const TIME_GENERATOR_SPLIT_LIMITS = Object.freeze({
    graphHeight: 96,
    workspaceHeight: 270,
    splitterSize: 6,
});

export function resizedGeneratorGraphRatio({
    pointerY,
    containerTop,
    containerHeight,
    limits = TIME_GENERATOR_SPLIT_LIMITS,
}) {
    const contentHeight = Math.max(
        1,
        containerHeight - limits.splitterSize,
    );
    const minimum = Math.min(limits.graphHeight, contentHeight);
    const maximum = Math.max(
        minimum,
        contentHeight - limits.workspaceHeight,
    );
    const graphHeight = clamp(
        pointerY - containerTop,
        minimum,
        maximum,
    );
    return graphHeight / contentHeight;
}
