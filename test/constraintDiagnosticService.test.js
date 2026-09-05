import assert from "node:assert/strict";
import test from "node:test";

import { diagnosticService } from "../src/services/diagnosticService.js";
import {
    VALIDATION_LEVELS,
} from "../src/services/schemas/common/constants.js";

const warning = {
    level: VALIDATION_LEVELS.WARNING,
    message: "Предупреждение проверки модели",
};
const constraintError = {
    level: VALIDATION_LEVELS.ERROR,
    message: "Вкладка: Элементы модели - нарушений ограничений: 1",
};

test("constraint errors take priority and restoring results restores color level", () => {
    diagnosticService.clearLoadResult();
    diagnosticService.setValidationResult([warning]);
    diagnosticService.setConstraintResults({
        elements: [constraintError],
    });

    assert.equal(
        diagnosticService.validationLevel(),
        VALIDATION_LEVELS.ERROR,
    );
    assert.deepEqual(
        diagnosticService.diagnostics(),
        [warning, constraintError],
    );

    diagnosticService.setConstraintResults({ elements: [] });
    assert.equal(
        diagnosticService.validationLevel(),
        VALIDATION_LEVELS.WARNING,
    );
    assert.deepEqual(diagnosticService.diagnostics(), [warning]);

    diagnosticService.clearDiagnostics();
    diagnosticService.clearLoadResult();
});

test("clean constraints retain the unchecked state and task changes clear old counts", () => {
    diagnosticService.clearDiagnostics();
    diagnosticService.clearLoadResult();
    diagnosticService.setConstraintResults({ elements: [], regions: [] });
    assert.equal(diagnosticService.validationLevel(), VALIDATION_LEVELS.UNKNOWN);

    diagnosticService.setConstraintResult("elements", [constraintError]);
    diagnosticService.setConstraintResult("elements", [constraintError]);
    assert.equal(diagnosticService.validationLevel(), VALIDATION_LEVELS.ERROR);
    assert.deepEqual(diagnosticService.diagnostics(), [constraintError]);

    diagnosticService.clearLoadResult();
    assert.equal(diagnosticService.validationLevel(), VALIDATION_LEVELS.UNKNOWN);
    assert.deepEqual(diagnosticService.diagnostics(), []);
});

test("successful model validation cannot hide outstanding constraint errors", () => {
    diagnosticService.setConstraintResult("elements", [constraintError]);
    diagnosticService.setValidationResult([]);
    assert.equal(diagnosticService.validationLevel(), VALIDATION_LEVELS.ERROR);
    assert.deepEqual(diagnosticService.diagnostics(), [constraintError]);

    diagnosticService.setConstraintResults({ elements: [] });
    assert.equal(diagnosticService.validationLevel(), VALIDATION_LEVELS.SUCCESS);
    diagnosticService.clearDiagnostics();
    diagnosticService.clearLoadResult();
});
