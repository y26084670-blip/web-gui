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
    const value = schema.id === "mhj" ? deserialize([{}], schema)
      : schema.config.storage === "records" && !schema.config.recordCount
        ? [] : dataService.createDefaultData(schema);
    model[schema.id] = value;
    if (!await dataService.save(handle, schema, value)) throw new Error(`Не создан ${schema.config.file}`);
  }
  await writeTaskSummary(handle, model);
}
