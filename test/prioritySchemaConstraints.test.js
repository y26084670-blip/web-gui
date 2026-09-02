import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const elementsUrl = new URL(
    "../src/services/schemas/elements.schema.js",
    import.meta.url,
);
const regionsUrl = new URL(
    "../src/services/schemas/regions.schema.js",
    import.meta.url,
);
const enumsUrl = new URL(
    "../src/services/schemas/common/enums.js",
    import.meta.url,
);
const dataServiceUrl = new URL(
    "../src/services/dataService.js",
    import.meta.url,
);

test("symmetry image counts have the requested minimum of one", async () => {
    const elements = await readFile(elementsUrl, "utf8");
    const regions = await readFile(regionsUrl, "utf8");
    for (const property of ["symLs", "symAs", "symPs"]) {
        assert.match(
            elements,
            new RegExp(`${property}: \\{[\\s\\S]*?minimum: 1,`, "u"),
        );
    }
    assert.match(regions, /symLs: \{[\s\S]*?minimum: 1,/u);
});

test("element material name is changed only through material selection", async () => {
    const elements = await readFile(elementsUrl, "utf8");
    assert.match(elements, /xapName: \{[\s\S]*?readonly: true,/u);
});

test("legacy xapType is input-only and has no element column", async () => {
    const [elements, enums, dataService] = await Promise.all([
        readFile(elementsUrl, "utf8"),
        readFile(enumsUrl, "utf8"),
        readFile(dataServiceUrl, "utf8"),
    ]);

    assert.doesNotMatch(elements, /^\s*xapType:\s*\{/mu);
    assert.doesNotMatch(elements, /\bEN_XAP\b/u);
    assert.doesNotMatch(enums, /\bEN_XAP\b/u);
    assert.match(
        elements,
        /obsoleteStoragePaths:\s*\["xapType"\]/u,
    );
    assert.match(
        dataService,
        /schema\.config\.obsoleteStoragePaths/u,
    );
});

test("region discretization is expressed as positive node counts", async () => {
    const regions = await readFile(regionsUrl, "utf8");
    const dp = regions.match(/dp: \{[\s\S]*?\n        \},/u)?.[0] ?? "";

    assert.match(dp, /description: "Число узлов разбиения/u);
    assert.match(dp, /columns: \["Число узлов"\]/u);
    assert.match(dp, /items: \{[\s\S]*?minimum: 1,/u);
    assert.doesNotMatch(dp, /Число интервалов/u);
});
