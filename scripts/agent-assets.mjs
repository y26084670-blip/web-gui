import {
  cp,
  lstat,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const AGENT_MANIFEST_FILE = "manifest.json";
export const AGENT_MANIFEST_SCHEMA_VERSION = 1;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(scriptDirectory);
const defaultSourceRoot = process.env.CLARK_AGENT_SOURCE
  ? path.resolve(process.env.CLARK_AGENT_SOURCE)
  : path.resolve(projectRoot, "..", "clark.agent");
const defaultGeneratedRoot = path.join(projectRoot, ".generated", "clark-agent");
const defaultDistRoot = path.join(projectRoot, "dist", "clark-agent");

function isMissing(error) {
  return error?.code === "ENOENT";
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeManifest(outputRoot, manifest) {
  await mkdir(outputRoot, { recursive: true });
  await writeFile(
    path.join(outputRoot, AGENT_MANIFEST_FILE),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  return manifest;
}

function unavailableManifest(reason) {
  return {
    schemaVersion: AGENT_MANIFEST_SCHEMA_VERSION,
    available: false,
    reason,
  };
}

export async function prepareAgentAssets({
  sourceRoot = defaultSourceRoot,
  outputRoot = defaultGeneratedRoot,
} = {}) {
  const source = path.resolve(sourceRoot);
  const output = path.resolve(outputRoot);

  await rm(output, { recursive: true, force: true });

  let sourceStat;
  try {
    sourceStat = await lstat(source);
  } catch (error) {
    if (!isMissing(error)) throw error;
    return writeManifest(
      output,
      unavailableManifest(
        `Локальный репозиторий clark.agent не найден: ${source}`,
      ),
    );
  }

  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) {
    throw new Error(`Источник clark.agent не является обычным каталогом: ${source}`);
  }

  const packagePath = path.join(source, "package.json");
  const entryPath = path.join(source, "src", "index.js");
  const packageMetadata = await readJson(packagePath);
  const entryStat = await lstat(entryPath).catch((error) => {
    if (isMissing(error)) return null;
    throw error;
  });

  if (packageMetadata.name !== "@clark/agent") {
    throw new Error(
      `Некорректный пакет агента: ожидался '@clark/agent', `
      + `получено '${packageMetadata.name ?? ""}'.`,
    );
  }
  if (typeof packageMetadata.version !== "string" || !packageMetadata.version) {
    throw new Error("В package.json агента отсутствует версия.");
  }
  if (!entryStat?.isFile()) {
    throw new Error(`Точка входа clark.agent не найдена: ${entryPath}`);
  }

  await mkdir(output, { recursive: true });
  await cp(path.join(source, "src"), path.join(output, "src"), {
    recursive: true,
    force: true,
  });

  return writeManifest(output, {
    schemaVersion: AGENT_MANIFEST_SCHEMA_VERSION,
    available: true,
    packageName: packageMetadata.name,
    version: packageMetadata.version,
    entry: "src/index.js",
    source: "local-sibling",
  });
}

export async function verifyAgentAssets({ root = defaultDistRoot } = {}) {
  const manifestPath = path.join(root, AGENT_MANIFEST_FILE);
  const manifest = await readJson(manifestPath);

  if (manifest.schemaVersion !== AGENT_MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `Неподдерживаемая версия манифеста агента: ${manifest.schemaVersion}.`,
    );
  }
  if (!manifest.available) return manifest;

  if (typeof manifest.entry !== "string" || !manifest.entry) {
    throw new Error("Манифест агента не содержит точку входа.");
  }
  const entryStat = await lstat(path.join(root, ...manifest.entry.split("/")));
  if (!entryStat.isFile()) {
    throw new Error(`Точка входа агента не является файлом: ${manifest.entry}`);
  }

  return manifest;
}

async function main() {
  const command = process.argv[2];
  if (command === "prepare") {
    const manifest = await prepareAgentAssets();
    const status = manifest.available
      ? `clark.agent ${manifest.version} подготовлен.`
      : manifest.reason;
    console.log(status);
    return;
  }
  if (command === "verify") {
    const manifest = await verifyAgentAssets();
    const status = manifest.available
      ? `clark.agent ${manifest.version} присутствует в сборке.`
      : `Сборка выполнена без агента: ${manifest.reason}`;
    console.log(status);
    return;
  }

  throw new Error("Использование: node scripts/agent-assets.mjs prepare|verify");
}

if (
  process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
