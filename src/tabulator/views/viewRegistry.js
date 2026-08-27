export const viewRegistry = new Map();

export function getView(viewType) {
    return viewRegistry.get(viewType);
}