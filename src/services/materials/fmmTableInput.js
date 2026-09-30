import { createFmmMaterialFile, XAP_TABLE_ROWS } from "../materialImport/xapLibImporter.js";

export function emptyFmmRecord() {
  return {
    name: "Новая",
    tabl: Array.from({ length: XAP_TABLE_ROWS }, () => [0, 0]),
    hip: 0,
    comment: "",
  };
}

// Preserve empty cells and interior blank lines: selecting a block must never
// silently shift its columns or join rows separated by invalid data.
export function parseFmmClipboardText(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Буфер обмена пуст. Скопируйте таблицу H–M.");
  }
  const lines = text.replace(/^\uFEFF/u, "").split(/\r\n|\n|\r/u);
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  if (lines.length < XAP_TABLE_ROWS) {
    throw new Error(`В буфере требуется не менее ${XAP_TABLE_ROWS} строк; получено ${lines.length}.`);
  }
  const separator = lines.some(line => line.includes("\t")) ? "\t"
    : lines.some(line => line.includes(";")) ? ";" : null;
  return lines.map(line => separator
    ? line.split(separator).map(cell => cell.trim())
    : line.trim().split(/\s+/u));
}

function clipboardNumber(cell, row, column) {
  const value = String(cell ?? "").trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eEdD][+-]?\d+)?$/u.test(value)) {
    throw new Error(`Строка ${row}, колонка ${column}: требуется число, получено «${value}».`);
  }
  const number = Number(value.replace(",", ".").replace(/[dD]/u, "e"));
  if (!Number.isFinite(number)) {
    throw new Error(`Строка ${row}, колонка ${column}: число вне допустимого диапазона.`);
  }
  return number;
}

export function fmmClipboardBlock(rows, startRow = 1) {
  if (!Array.isArray(rows) || !Number.isInteger(startRow)
      || startRow < 1 || startRow + XAP_TABLE_ROWS - 1 > rows.length) {
    throw new Error(`Выберите начальную строку блока из ${XAP_TABLE_ROWS} строк.`);
  }
  return rows.slice(startRow - 1, startRow - 1 + XAP_TABLE_ROWS)
    .map((row, index) => [
      clipboardNumber(row?.[0], startRow + index, 1),
      clipboardNumber(row?.[1], startRow + index, 2),
    ]);
}

export function firstFmmClipboardBlock(rows) {
  for (let start = 1; start <= rows.length - XAP_TABLE_ROWS + 1; start += 1) {
    try {
      fmmClipboardBlock(rows, start);
      return start;
    } catch {
      // Headers and invalid rows remain selectable and visible in the preview.
    }
  }
  return 1;
}

function savedRecord(record, material, result) {
  return {
    ...record,
    _taskLibraryRecord: {
      ...record._taskLibraryRecord,
      source: "task",
      kind: "FMM",
      name: record.name,
      fileName: result.fileName ?? material.fileName,
      relativePath: result.path,
      byteSize: result.byteSize,
      sha256: result.sha256,
      data: material.data,
    },
  };
}

export async function createEmptyFmmMaterial({ taskHandle, service, isCurrent = () => true }) {
  const record = emptyFmmRecord();
  const existing = await service.loadMaterials({ taskHandle, kind: "FMM" });
  if (!isCurrent()) return null;
  if (existing.some(item => item.name.toLocaleLowerCase("ru-RU") === record.name.toLocaleLowerCase("ru-RU"))) {
    throw new Error("Характеристика «Новая» уже существует. Переименуйте её перед созданием следующей.");
  }
  const material = createFmmMaterialFile(record);
  const batch = await service.writeImportedBatch({
    taskHandle, kind: "FMM", materials: [material], overwrite: false,
  });
  const result = batch.results[0];
  if (result.status !== "created") {
    throw new Error("Характеристика «Новая» уже существует.");
  }
  return savedRecord(record, material, result);
}

export async function saveFmmClipboardBlock({ taskHandle, record, rows, startRow, service }) {
  if (!record?._taskLibraryRecord) {
    throw new Error("Выберите локальную характеристику для вставки.");
  }
  // Validate and write before changing the UI model. Failed writes leave its
  // current table and all other unsaved materials intact.
  const updated = { ...record, tabl: fmmClipboardBlock(rows, startRow) };
  const material = createFmmMaterialFile(updated);
  const result = await service.saveMaterial({
    taskHandle, material, sourceRecord: record._taskLibraryRecord,
  });
  return savedRecord(updated, material, result);
}
