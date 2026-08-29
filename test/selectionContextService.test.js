import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const serviceUrl = new URL(
    "../src/services/selectionContextService.js",
    import.meta.url,
).href;

test("activating a detail table does not retrigger the main-table effect", () => {
    const script = `
        import { createComputed, createRoot } from "solid-js";
        import { selectionContextService } from ${JSON.stringify(serviceUrl)};

        let result;
        createRoot(dispose => {
            const main = { name: "main" };
            const detail = { name: "detail" };
            let runs = 0;

            createComputed(() => {
                runs += 1;
                selectionContextService.setActiveTable(main);
            });

            selectionContextService.setActiveTable(detail);
            result = {
                runs,
                active: selectionContextService.getActiveTable()?.name,
            };
            dispose();
        });

        console.log(JSON.stringify(result));
    `;
    const execution = spawnSync(
        process.execPath,
        ["--conditions=browser", "--input-type=module", "-e", script],
        { encoding: "utf8" },
    );

    assert.equal(execution.status, 0, execution.stderr);
    assert.deepEqual(
        JSON.parse(execution.stdout),
        { runs: 1, active: "detail" },
    );
});
