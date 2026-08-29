import assert from "node:assert/strict";
import test from "node:test";

import { formatFixedSignificant } from
    "../src/tabulator/formatters/types/floatFormatter.js";

test("fixed significant formatting avoids exponential notation", () => {
    assert.equal(formatFixedSignificant(123.456, 6), "123.456");
    assert.equal(formatFixedSignificant(0.00123456, 6), "0.00123456");
    assert.equal(formatFixedSignificant(0, 6), "0.00000");
    assert.doesNotMatch(formatFixedSignificant(1.25e-20, 12), /e/i);
});
