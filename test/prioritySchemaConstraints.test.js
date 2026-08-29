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
