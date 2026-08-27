export const valueViewAdapter = {
    render(cell) {
        const value = cell.getValue();
        if (value === null || value === undefined) return "";
        return String(value);
    },
};
