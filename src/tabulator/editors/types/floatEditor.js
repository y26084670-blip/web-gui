import { createInputEditor } from "../editorFactory";

export const floatEditor =
    createInputEditor({

        htmlType: "number",

        parse: Number,

    });