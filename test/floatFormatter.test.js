import assert from "node:assert/strict";
import test from "node:test";

import {
    displaySignificantDigits,
    floatFormatter,
    formatFixedSignificant,
    MAX_DISPLAY_SIGNIFICANT_DIGITS,
} from
    "../src/tabulator/formatters/types/floatFormatter.js";

test("fixed significant formatting avoids exponential notation", () => {
    assert.equal(formatFixedSignificant(123.456, 6), "123.456");
    assert.equal(formatFixedSignificant(0.00123456, 6), "0.00123456");
    assert.equal(formatFixedSignificant(0, 6), "0.00000");
    assert.doesNotMatch(formatFixedSignificant(1.25e-20, 12), /e/i);
});

test("display formatting never exceeds eight significant digits", () => {
    assert.equal(MAX_DISPLAY_SIGNIFICANT_DIGITS, 8);
    assert.equal(displaySignificantDigits(6), 6);
    assert.equal(displaySignificantDigits(12), 8);
    assert.equal(formatFixedSignificant(1.234567891, 12), "1.2345679");
    assert.equal(
        floatFormatter(
            { getValue: () => 123.4567891 },
            { property: { digits: 12 } },
        ),
        "123.45679",
    );
});
