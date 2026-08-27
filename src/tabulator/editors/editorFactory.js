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

                if (e.key === "Enter") {
                    save();
                }

                if (e.key === "Escape") {
                    cancel();
                }

            }
        );

        return input;

    };

}