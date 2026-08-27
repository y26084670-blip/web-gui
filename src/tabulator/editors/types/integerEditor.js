import { createInputEditor } from "../editorFactory";

export const integerEditor =
    createInputEditor({

        htmlType: "number",

        parse: value => Number.parseInt(
            value,
            10
        ),

    });