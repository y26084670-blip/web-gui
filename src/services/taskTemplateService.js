import { tabRegistry } from "./tabRegistry.js";
import { dataService } from "./dataService.js";
import { taskApprovalService } from "./taskApprovalService.js";
import { writeTaskSummary } from "./taskSummaryService.js";
import { deserialize } from "./model/modelSerializer.js";

export async function initializeTaskDirectory(handle) {
  await taskApprovalService.markUnapproved(handle);
  const model = {};
  for (const schema of tabRegistry) {
    // Variable-length records start empty; fixed conrab profiles use defaults.
    const defaults = schema.id === "mhj" ? deserialize([{}], schema)
      : schema.config.storage === "records" && !schema.config.recordCount
        ? [] : dataService.createDefaultData(schema);
    // Только новый черновик: настройки существующих заданий задаёт их файл.
    const value = schema.id === "general" ? { ...defaults, htcMu: false, htcRo: false } : defaults;
    model[schema.id] = value;
    if (!await dataService.save(handle, schema, value)) throw new Error(`Не создан ${schema.config.file}`);
  }
  await writeTaskSummary(handle, model);
}
