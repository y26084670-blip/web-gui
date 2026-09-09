import { DIRECTORIES } from "./schemas/common/constants.js";

const SUMMARY_FILE_NAME = "_summary.txt";
const RESULTS_SUMMARY_FILE_NAME = "_summary_out.txt";

export const TASK_SUMMARY_TEXT = Object.freeze({
  NO_INFORMATION: "нет информации, т.к. расчет не проводился",
  NO_CURRENT_FORMAT: "не содержит данных актуального формата",
  NO_RESULTS: "нет данных по результатам или расчет не проводился",
});

function isMissingEntry(error) {
  return error?.name === "NotFoundError" || error?.name === "TypeMismatchError";
}

async function readSummaryText(taskHandle) {
  let inputHandle;
  try {
    inputHandle = await taskHandle.getDirectoryHandle(DIRECTORIES.INPUT);
  } catch (error) {
    if (isMissingEntry(error)) return TASK_SUMMARY_TEXT.NO_CURRENT_FORMAT;
    throw error;
  }

  try {
    const summaryHandle = await inputHandle.getFileHandle(SUMMARY_FILE_NAME);
    const summaryFile = await summaryHandle.getFile();
    return await summaryFile.text();
  } catch (error) {
    if (isMissingEntry(error)) return TASK_SUMMARY_TEXT.NO_INFORMATION;
    throw error;
  }
}

export async function readTaskSummary(taskHandle) {
  return {
    summaryText: await readSummaryText(taskHandle),
  };
}

// Read results independently of input metadata and preserve the file's text.
export async function readTaskResultsSummary(taskHandle) {
  try {
    const outputHandle = await taskHandle.getDirectoryHandle(DIRECTORIES.OUTPUT);
    const summaryHandle = await outputHandle.getFileHandle(RESULTS_SUMMARY_FILE_NAME);
    const summaryFile = await summaryHandle.getFile();
    return await summaryFile.text();
  } catch (error) {
    if (isMissingEntry(error)) return TASK_SUMMARY_TEXT.NO_RESULTS;
    throw error;
  }
}
