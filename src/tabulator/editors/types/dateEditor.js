//------------------------------------------------------------------------------
// Редактор даты.
//------------------------------------------------------------------------------
import { createInputEditor } from "../editorFactory";

export const dateEditor =
    createInputEditor({

        htmlType: "date",

    });