import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
    menu: new URL(
        "../src/components/graphs/GraphContextMenu.jsx",
        import.meta.url,
    ),
    recordGraph: new URL(
        "../src/components/graphs/RecordGraphRegion.jsx",
        import.meta.url,
    ),
    fmmGraph: new URL(
        "../src/components/materials/FmmGraphRegion.jsx",
        import.meta.url,
    ),
    generator: new URL(
        "../src/components/generator/TimeFunctionGenerator.jsx",
        import.meta.url,
    ),
    materials: new URL(
        "../src/tabs/MaterialLibraryTab.jsx",
        import.meta.url,
    ),
};

test("every Chart.js surface uses the common two-item menu", async () => {
    const [
        menu,
        recordGraph,
        fmmGraph,
        generator,
        materials,
    ] = await Promise.all(
        Object.values(files).map(file => readFile(file, "utf8")),
    );

    assert.match(menu, />\s*Копировать таблицу\s*</u);
    assert.match(menu, />\s*Копировать картинку\s*</u);
    assert.match(menu, /copyGraphTables/u);
    assert.match(menu, /copyGraphImage/u);

    for (const source of [recordGraph, fmmGraph, generator]) {
        assert.match(source, /GraphContextMenu/u);
        assert.match(source, /onContextMenu/u);
        assert.match(source, /getTables/u);
        assert.match(source, /getCanvas/u);
    }

    assert.match(recordGraph, /createDetailTableBlock/u);
    assert.match(fmmGraph, /createDetailTableBlock/u);
    assert.match(generator, /createGeneratedDetailTableBlock/u);
    assert.match(
        materials,
        /<FmmGraphRegion[\s\S]*property=\{[\s\S]*definition\.detail\.property/u,
    );
});
