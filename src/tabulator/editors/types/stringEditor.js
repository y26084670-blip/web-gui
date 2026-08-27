//------------------------------------------------------------------------------
// Редактор строк.
//------------------------------------------------------------------------------
import { createInputEditor } from "../editorFactory";

export const stringEditor =
    createInputEditor({

        htmlType: "text",

        parse: value => String(value ?? "").trim(),

    });