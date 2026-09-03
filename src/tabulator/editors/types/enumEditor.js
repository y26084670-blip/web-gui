//------------------------------------------------------------------------------
// Редактор именованных перечислений.
// В DOM хранится индекс варианта, в модель возвращается исходный typed value.
//------------------------------------------------------------------------------
function hasImageOptions(options) {
    return options.every(entry =>
        typeof entry?.image === "string" && entry.image.length > 0
    );
}

function imageEnumEditor(
    cell,
    onRendered,
    success,
    cancel,
    options,
) {
    const container = document.createElement("div");
    container.className = "image-enum-editor";
    const currentValue = cell.getValue();
    const buttons = [];

    options.forEach((entry) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "image-enum-option";
        button.disabled = entry.disabled === true;
        button.title = entry.description ?? entry.label;
        button.setAttribute("aria-label", entry.description ?? entry.label);
        button.setAttribute(
            "aria-pressed",
            entry.value === currentValue ? "true" : "false",
        );
        if (entry.value === currentValue) button.classList.add("selected");

        const image = document.createElement("img");
        image.src = entry.image;
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        button.appendChild(image);
        button.addEventListener("pointerdown", event => event.preventDefault());
        button.addEventListener("click", () => success(entry.value));
        container.appendChild(button);
        buttons.push(button);
    });

    container.addEventListener("keydown", (event) => {
        if (event.key === "Escape") cancel();
    });
    onRendered(() => {
        const selected = buttons.find(button =>
            button.getAttribute("aria-pressed") === "true"
        );
        (selected ?? buttons.find(button => !button.disabled))?.focus();
    });

    return container;
}

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

    if (hasImageOptions(options)) {
        return imageEnumEditor(cell, onRendered, success, cancel, options);
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
