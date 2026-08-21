/**
 * Tests for the spreadsheet formula parser.
 * @see {@link src/tools/spreadsheet/formulaParser.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { parseFormula, evaluateFormula } from "../../../src/tools/spreadsheet/formulaParser.js";

describe("formulaParser", () => {
	describe("parseFormula", () => {
		it("should parse a simple addition formula", () => {
			const parsed = parseFormula("=A1+B2");
			assert.ok(parsed);
			assert.strictEqual(parsed.type, "binary");
			assert.strictEqual(parsed.operator, "+");
		});

		it("should parse a multiplication formula", () => {
			const parsed = parseFormula("=A1*B2");
			assert.strictEqual(parsed.operator, "*");
		});

		it("should parse a function call", () => {
			const parsed = parseFormula("=SUM(A1:A5)");
			assert.strictEqual(parsed.type, "function");
			assert.strictEqual(parsed.name, "SUM");
		});

		it("should parse a nested function", () => {
			const parsed = parseFormula("=ROUND(AVERAGE(A1:A5), 2)");
			assert.strictEqual(parsed.type, "function");
			assert.strictEqual(parsed.name, "ROUND");
		});

		it("should parse a cell reference", () => {
			const parsed = parseFormula("=A1");
			assert.strictEqual(parsed.type, "cell");
			assert.strictEqual(parsed.ref, "A1");
		});

		it("should parse a numeric literal", () => {
			const parsed = parseFormula("=42");
			assert.strictEqual(parsed.type, "number");
			assert.strictEqual(parsed.value, 42);
		});

		it("should parse a string literal", () => {
			const parsed = parseFormula('="hello"');
			assert.strictEqual(parsed.type, "string");
			assert.strictEqual(parsed.value, "hello");
		});

		it("should parse a boolean literal", () => {
			const parsed = parseFormula("=TRUE");
			assert.strictEqual(parsed.type, "boolean");
			assert.strictEqual(parsed.value, true);
		});

		it("should parse a formula with parentheses", () => {
			const parsed = parseFormula("=(A1+B2)*C3");
			assert.strictEqual(parsed.type, "binary");
			assert.strictEqual(parsed.operator, "*");
		});

		it("should throw on empty formula", () => {
			assert.throws(() => parseFormula(""), /formula cannot be empty/);
		});

		it("should throw on formula without = prefix", () => {
			assert.throws(() => parseFormula("A1+B2"), /must start with '='/);
		});

		it("should throw on eval() usage", () => {
			assert.throws(() => parseFormula("=eval('1+1')"), /eval\(\) is forbidden/);
		});
	});

	describe("evaluateFormula", () => {
		it("should evaluate a simple addition", () => {
			const result = evaluateFormula("=A1+B2", { A1: 10, B2: 20 });
			assert.strictEqual(result, 30);
		});

		it("should evaluate a multiplication", () => {
			const result = evaluateFormula("=A1*B2", { A1: 5, B2: 6 });
			assert.strictEqual(result, 30);
		});

		it("should evaluate a SUM function", () => {
			const result = evaluateFormula("=SUM(A1,A2,A3)", { A1: 10, A2: 20, A3: 30 });
			assert.strictEqual(result, 60);
		});

		it("should evaluate an AVERAGE function", () => {
			const result = evaluateFormula("=AVERAGE(A1,A2)", { A1: 10, A2: 20 });
			assert.strictEqual(result, 15);
		});

		it("should evaluate a COUNT function", () => {
			const result = evaluateFormula("=COUNT(A1,A2,A3)", { A1: 10, A2: 20, A3: 30 });
			assert.strictEqual(result, 3);
		});

		it("should evaluate a MIN function", () => {
			const result = evaluateFormula("=MIN(A1,A2,A3)", { A1: 10, A2: 5, A3: 20 });
			assert.strictEqual(result, 5);
		});

		it("should evaluate a MAX function", () => {
			const result = evaluateFormula("=MAX(A1,A2,A3)", { A1: 10, A2: 5, A3: 20 });
			assert.strictEqual(result, 20);
		});

		it("should evaluate a ROUND function", () => {
			const result = evaluateFormula("=ROUND(A1, 1)", { A1: 3.14159 });
			assert.strictEqual(result, 3.1);
		});

		it("should evaluate an ABS function", () => {
			const result = evaluateFormula("=ABS(A1)", { A1: -42 });
			assert.strictEqual(result, 42);
		});

		it("should evaluate a SQRT function", () => {
			const result = evaluateFormula("=SQRT(A1)", { A1: 144 });
			assert.strictEqual(result, 12);
		});

		it("should evaluate a nested formula", () => {
			const result = evaluateFormula("=ROUND(AVERAGE(A1,A2), 2)", { A1: 10, A2: 20 });
			assert.strictEqual(result, 15);
		});

		it("should handle division by zero", () => {
			assert.throws(() => evaluateFormula("=A1/B2", { A1: 10, B2: 0 }), /division by zero/);
		});

		it("should handle missing cell references", () => {
			const result = evaluateFormula("=A1+B2", { A1: 10 });
			assert.strictEqual(result, 0);
		});

		it("should handle string concatenation", () => {
			const result = evaluateFormula('="hello" & " world"', {});
			assert.strictEqual(result, "hello world");
		});

		it("should handle boolean logic", () => {
			const result = evaluateFormula("=AND(A1>5, A2<20)", { A1: 10, A2: 15 });
			assert.strictEqual(result, true);
		});

		it("should handle IF function", () => {
			const result = evaluateFormula('=IF(A1>5, "yes", "no")', { A1: 10 });
			assert.strictEqual(result, "yes");
		});
	});
});
