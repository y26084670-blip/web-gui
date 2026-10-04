import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

test("general HTS aliases use the real schema and file diagnostics accept legacy keys", async () => {
    const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom" });
    try {
        const { default: schema } = await server.ssrLoadModule("/src/services/schemas/general.schema.js");
        const { deserialize, serialize } = await server.ssrLoadModule("/src/services/model/modelSerializer.js");
        const { dataService } = await server.ssrLoadModule("/src/services/dataService.js");
        const current = serialize(deserialize({}, schema), schema);
        const legacy = { ...current };
        for (const suffix of ["RegimFC", "Mu", "Ro"]) {
            legacy[`htc${suffix}`] = !current[`hts${suffix}`];
            delete legacy[`hts${suffix}`];
        }
        const diagnostics = [];
        dataService.checkStorageKeys(legacy, schema, diagnostics, "general");
        assert.deepEqual(diagnostics, []);
        const read = deserialize(legacy, schema);
        for (const suffix of ["RegimFC", "Mu", "Ro"]) {
            assert.equal(read[`hts${suffix}`], legacy[`htc${suffix}`]);
            assert.equal(Object.hasOwn(serialize(read, schema), `htc${suffix}`), false);
            const mixed = { ...legacy, [`hts${suffix}`]: false };
            assert.equal(deserialize(mixed, schema)[`hts${suffix}`], false);
        }

        const { createSchema } = await server.ssrLoadModule("/src/services/schemaFactory.js");
        const property = { type: "boolean", default: true, storageAliases: ["old"] };
        assert.throws(() => createSchema({ id: "invalid", properties: {
            current: property, other: { ...property },
        } }), /conflicting storage paths/);
        assert.throws(() => createSchema({ id: "invalid", properties: {
            current: { ...property, storageAliases: "old" },
        } }), /storageAliases/);
    } finally {
        await server.close();
    }
});
