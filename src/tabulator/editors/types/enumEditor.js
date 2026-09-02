//------------------------------------------------------------------------------
// Редактор именованных перечислений.
// В DOM хранится индекс варианта, в модель возвращается исходный typed value.
//------------------------------------------------------------------------------
export function enumEditor(
    cell,
    onRendered,
    success,
    cancel,
    property,
) {
    const options = property?.enum;
    if (!Array.isArray(options) || options.length === 0) {
        cancel();
        return false;
    }

    const select = document.createElement("select");
    const currentValue = cell.getValue();

    options.forEach((entry, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = entry.label;
        option.disabled = entry.disabled === true;
        if (entry.value === currentValue) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    onRendered(() => {
        select.focus();
    });

    function save() {
        const entry = options[Number(select.value)];
        if (!entry) {
            cancel();
            return;
        }

        success(entry.value);
    }

    select.addEventListener(
        "change",
        save
    );

    select.addEventListener(
        "blur",
        save
    );

    select.addEventListener(
        "keydown",
        e => {
            if (e.key === "Enter") {
                save();
            }
            if (e.key === "Escape") {
                cancel();
            }
        }
    );

    return select;
}
