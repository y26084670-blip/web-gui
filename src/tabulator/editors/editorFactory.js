//==============================================================================
// Фабрика редакторов, основанных на HTML-элементе <input>.
//
// Параметры:
//
//     htmlType
//         значение input.type
//
//     parse(value)
//         преобразование строки в сохраняемое значение
//==============================================================================

export function createInputEditor({

    htmlType,
    parse = value => value,
    configure = (input, cell) => { },

}) {

    return function (

        cell,
        onRendered,
        success,
        cancel

    ) {

        const input = document.createElement("input");
        input.type = htmlType;
        input.value = cell.getValue();
        if (configure) {
            configure(
                input,
                cell
            );
        }

        onRendered(() => {

            input.focus();
            input.select();

        });

        function save() {

            success(
                parse(input.value)
            );

        }

        input.addEventListener(
            "blur",
            save
        );

        input.addEventListener(
            "keydown",
            e => {

                // Tabulator binds Home/End to scrolling and focusing the table.
                // Keep the browser's caret/selection action inside this input;
                // numeric inputs do not support setSelectionRange().
                // Numpad codes need their navigation meaning with NumLock off;
                // the same physical keys must still insert digits with it on.
                const caretBoundaryKey = e.code === "Home" || e.code === "End"
                    || (e.code === "Numpad7" && e.key === "Home")
                    || (e.code === "Numpad1" && e.key === "End");
                if (caretBoundaryKey) {
                    e.stopPropagation();
                    return;
                }

                if (e.code === "Enter" || e.code === "NumpadEnter") {
                    save();
                }

                if (e.code === "Escape") {
                    cancel();
                }

            }
        );

        return input;

    };

}
