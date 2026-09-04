import { DIRECTORIES } from "./schemas/common/constants.js";

const SUMMARY_FILE_NAME = "_summary.txt";
const LEGACY_FILE_NAME = "kv.in";

export const TASK_SUMMARY_TEXT = Object.freeze({
  NO_INFORMATION: "нет информации",
  NO_CURRENT_FORMAT: "не содержит данных актуального формата",
  LEGACY_IMPORT: "доступен импорт из legacy - формата",
});

function isMissingEntry(error) {
  return error?.name === "NotFoundError" || error?.name === "TypeMismatchError";
}

async function hasFile(directoryHandle, fileName) {
  try {
    await directoryHandle.getFileHandle(fileName);
    return true;
  } catch (error) {
    if (isMissingEntry(error)) return false;
    throw error;
  }
}

async function hasDirectory(directoryHandle, directoryName) {
  try {
    await directoryHandle.getDirectoryHandle(directoryName);
    return true;
  } catch (error) {
    if (isMissingEntry(error)) return false;
    throw error;
  }
}

export function hasTaskResults(taskHandle) {
  return hasDirectory(taskHandle, DIRECTORIES.OUTPUT);
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
  const [summaryText, legacyImportAvailable, resultsAvailable] =
    await Promise.all([
      readSummaryText(taskHandle),
      hasFile(taskHandle, LEGACY_FILE_NAME),
      hasTaskResults(taskHandle),
    ]);

  return {
    summaryText,
    legacyImportAvailable,
    resultsAvailable,
  };
}
