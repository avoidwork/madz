/**
 * Tests for the spreadsheet formula parser.
 * @see {@link src/tools/spreadsheet/formulaParser.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { parseFormula } from "../../../../src/tools/spreadsheet/formulaParser.js";

describe("formulaParser", () => {
	describe("parseFormula", () => {
		it("should return an object with evaluate function", () => {
			const result = parseFormula("=A1+B2");
			assert.ok(result);
			assert.strictEqual(typeof result.evaluate, "function");
		});

		it("should parse formula without leading =", () => {
			const result = parseFormula("A1+B2");
			assert.ok(result);
			assert.strictEqual(typeof result.evaluate, "function");
		});

		it("should throw on empty formula", () => {
			assert.throws(() => parseFormula(""), /Formula must be a non-empty string/);
		});

		it("should throw on null formula", () => {
			assert.throws(() => parseFormula(null), /Formula must be a non-empty string/);
		});

		it("should throw on non-string formula", () => {
			assert.throws(() => parseFormula(42), /Formula must be a non-empty string/);
		});
	});

	describe("evaluate - arithmetic", () => {
		it("should evaluate addition", () => {
			const { evaluate } = parseFormula("=A1+B2");
			assert.strictEqual(evaluate({ A1: 10, B2: 20 }), 30);
		});

		it("should evaluate subtraction", () => {
			const { evaluate } = parseFormula("=A1-B2");
			assert.strictEqual(evaluate({ A1: 50, B2: 20 }), 30);
		});

		it("should evaluate multiplication", () => {
			const { evaluate } = parseFormula("=A1*B2");
			assert.strictEqual(evaluate({ A1: 5, B2: 6 }), 30);
		});

		it("should evaluate division", () => {
			const { evaluate } = parseFormula("=A1/B2");
			assert.strictEqual(evaluate({ A1: 100, B2: 4 }), 25);
		});

		it("should evaluate exponentiation", () => {
			const { evaluate } = parseFormula("=A1^B2");
			assert.strictEqual(evaluate({ A1: 2, B2: 3 }), 8);
		});

		it("should respect operator precedence (multiplication before addition)", () => {
			const { evaluate } = parseFormula("=A1+B2*C3");
			assert.strictEqual(evaluate({ A1: 10, B2: 5, C3: 6 }), 40);
		});

		it("should respect parentheses", () => {
			const { evaluate } = parseFormula("=(A1+B2)*C3");
			assert.strictEqual(evaluate({ A1: 10, B2: 5, C3: 6 }), 90);
		});

		it("should handle deeply nested parentheses", () => {
			const { evaluate } = parseFormula("=((A1+B2)*C3)/D4");
			assert.strictEqual(evaluate({ A1: 10, B2: 5, C3: 6, D4: 3 }), 30);
		});

		it("should handle division by zero", () => {
			const { evaluate } = parseFormula("=A1/B2");
			assert.throws(() => evaluate({ A1: 10, B2: 0 }), /Division by zero/);
		});

		it("should handle unary minus", () => {
			const { evaluate } = parseFormula("=-A1");
			assert.strictEqual(evaluate({ A1: 42 }), -42);
		});

		it("should handle double unary minus", () => {
			const { evaluate } = parseFormula("=--A1");
			assert.strictEqual(evaluate({ A1: 42 }), 42);
		});

		it("should handle unary not", () => {
			const { evaluate } = parseFormula("=!A1");
			assert.strictEqual(evaluate({ A1: true }), false);
		});
	});

	describe("evaluate - comparison operators", () => {
		it("should evaluate equality (==)", () => {
			const { evaluate } = parseFormula("=A1==B2");
			assert.strictEqual(evaluate({ A1: 10, B2: 10 }), true);
			assert.strictEqual(evaluate({ A1: 10, B2: 20 }), false);
		});

		it("should evaluate inequality (!=)", () => {
			const { evaluate } = parseFormula("=A1!=B2");
			assert.strictEqual(evaluate({ A1: 10, B2: 20 }), true);
			assert.strictEqual(evaluate({ A1: 10, B2: 10 }), false);
		});

		it("should evaluate less than (<)", () => {
			const { evaluate } = parseFormula("=A1<B2");
			assert.strictEqual(evaluate({ A1: 5, B2: 10 }), true);
			assert.strictEqual(evaluate({ A1: 10, B2: 5 }), false);
		});

		it("should evaluate greater than (>)", () => {
			const { evaluate } = parseFormula("=A1>B2");
			assert.strictEqual(evaluate({ A1: 10, B2: 5 }), true);
		});

		it("should evaluate less than or equal (<=)", () => {
			const { evaluate } = parseFormula("=A1<=B2");
			assert.strictEqual(evaluate({ A1: 5, B2: 5 }), true);
			assert.strictEqual(evaluate({ A1: 6, B2: 5 }), false);
		});

		it("should evaluate greater than or equal (>=)", () => {
			const { evaluate } = parseFormula("=A1>=B2");
			assert.strictEqual(evaluate({ A1: 5, B2: 5 }), true);
			assert.strictEqual(evaluate({ A1: 4, B2: 5 }), false);
		});
	});

	describe("evaluate - logical operators", () => {
		it("should evaluate AND (&&)", () => {
			const { evaluate } = parseFormula("=A1&&B2");
			assert.strictEqual(evaluate({ A1: true, B2: true }), true);
			assert.strictEqual(evaluate({ A1: true, B2: false }), false);
		});

		it("should evaluate OR (||)", () => {
			const { evaluate } = parseFormula("=A1||B2");
			assert.strictEqual(evaluate({ A1: true, B2: false }), true);
			assert.strictEqual(evaluate({ A1: false, B2: false }), false);
		});
	});

	describe("evaluate - built-in functions", () => {
		it("should evaluate SUM", () => {
			const { evaluate } = parseFormula("=SUM(A1,A2,A3)");
			assert.strictEqual(evaluate({ A1: 10, A2: 20, A3: 30 }), 60);
		});

		it("should evaluate SUM with single argument", () => {
			const { evaluate } = parseFormula("=SUM(A1)");
			assert.strictEqual(evaluate({ A1: 42 }), 42);
		});

		it("should evaluate AVERAGE", () => {
			const { evaluate } = parseFormula("=AVERAGE(A1,A2)");
			assert.strictEqual(evaluate({ A1: 10, A2: 20 }), 15);
		});

		it("should evaluate AVERAGE with empty values", () => {
			const { evaluate } = parseFormula("=AVERAGE(A1,A2)");
			// Missing cells evaluate to 0, so AVERAGE(10, 0) = 5
			assert.strictEqual(evaluate({ A1: 10, A2: undefined }), 5);
		});

		it("should evaluate COUNT", () => {
			const { evaluate } = parseFormula("=COUNT(A1,A2,A3)");
			assert.strictEqual(evaluate({ A1: 10, A2: 20, A3: 30 }), 3);
		});

		it("should evaluate COUNT with null/undefined", () => {
			const { evaluate } = parseFormula("=COUNT(A1,A2,A3)");
			// null/undefined cells evaluate to 0, so COUNT sees 3 values
			assert.strictEqual(evaluate({ A1: 10, A2: null, A3: undefined }), 3);
		});

		it("should evaluate COUNTA", () => {
			const { evaluate } = parseFormula("=COUNTA(A1,A2,A3)");
			assert.strictEqual(evaluate({ A1: 10, A2: "", A3: 0 }), 1);
		});

		it("should evaluate COUNTBLANK", () => {
			const { evaluate } = parseFormula("=COUNTBLANK(A1,A2,A3)");
			// null/undefined cells evaluate to 0 (not blank), only empty string is blank
			assert.strictEqual(evaluate({ A1: 10, A2: null, A3: "" }), 1);
		});

		it("should evaluate MIN", () => {
			const { evaluate } = parseFormula("=MIN(A1,A2,A3)");
			assert.strictEqual(evaluate({ A1: 10, A2: 5, A3: 20 }), 5);
		});

		it("should evaluate MIN with empty values", () => {
			const { evaluate } = parseFormula("=MIN(A1,A2)");
			assert.strictEqual(evaluate({ A1: undefined, A2: undefined }), 0);
		});

		it("should evaluate MAX", () => {
			const { evaluate } = parseFormula("=MAX(A1,A2,A3)");
			assert.strictEqual(evaluate({ A1: 10, A2: 5, A3: 20 }), 20);
		});

		it("should evaluate ROUND", () => {
			const { evaluate } = parseFormula("=ROUND(A1, 1)");
			assert.strictEqual(evaluate({ A1: 3.14159 }), 3.1);
		});

		it("should evaluate ROUND with default decimals", () => {
			const { evaluate } = parseFormula("=ROUND(A1)");
			assert.strictEqual(evaluate({ A1: 3.7 }), 4);
		});

		it("should throw ROUND with too many arguments", () => {
			const { evaluate } = parseFormula("=ROUND(A1, A2, A3)");
			assert.throws(() => evaluate({ A1: 1, A2: 2, A3: 3 }), /ROUND requires 1-2 arguments/);
		});

		it("should evaluate ABS", () => {
			const { evaluate } = parseFormula("=ABS(A1)");
			assert.strictEqual(evaluate({ A1: -42 }), 42);
		});

		it("should evaluate SQRT", () => {
			const { evaluate } = parseFormula("=SQRT(A1)");
			assert.strictEqual(evaluate({ A1: 144 }), 12);
		});

		it("should throw SQRT on negative number", () => {
			const { evaluate } = parseFormula("=SQRT(A1)");
			assert.throws(() => evaluate({ A1: -1 }), /Cannot compute square root of negative number/);
		});

		it("should evaluate IF (true branch)", () => {
			const { evaluate } = parseFormula('=IF(A1>5, "yes", "no")');
			assert.strictEqual(evaluate({ A1: 10 }), "yes");
		});

		it("should evaluate IF (false branch)", () => {
			const { evaluate } = parseFormula('=IF(A1>5, "yes", "no")');
			assert.strictEqual(evaluate({ A1: 3 }), "no");
		});

		it("should evaluate IF with no else", () => {
			const { evaluate } = parseFormula('=IF(A1>5, "yes")');
			assert.strictEqual(evaluate({ A1: 10 }), "yes");
			assert.strictEqual(evaluate({ A1: 3 }), undefined);
		});

		it("should throw IF with wrong argument count", () => {
			const { evaluate } = parseFormula("=IF(A1)");
			assert.throws(() => evaluate({ A1: 10 }), /IF requires 2-3 arguments/);
		});

		it("should evaluate AND function", () => {
			const { evaluate } = parseFormula("=AND(A1>5, A2<20)");
			assert.strictEqual(evaluate({ A1: 10, A2: 15 }), true);
			assert.strictEqual(evaluate({ A1: 3, A2: 15 }), false);
		});

		it("should evaluate OR function", () => {
			const { evaluate } = parseFormula("=OR(A1>5, A2>20)");
			assert.strictEqual(evaluate({ A1: 10, A2: 15 }), true);
			assert.strictEqual(evaluate({ A1: 3, A2: 15 }), false);
		});

		it("should evaluate NOT function", () => {
			const { evaluate } = parseFormula("=NOT(A1)");
			assert.strictEqual(evaluate({ A1: true }), false);
			assert.strictEqual(evaluate({ A1: false }), true);
		});

		it("should evaluate CEILING", () => {
			const { evaluate } = parseFormula("=CEILING(A1, 0.1)");
			assert.strictEqual(evaluate({ A1: 3.14159 }), 3.2);
		});

		it("should evaluate CEILING with default significance", () => {
			const { evaluate } = parseFormula("=CEILING(A1)");
			assert.strictEqual(evaluate({ A1: 3.14 }), 4);
		});

		it("should evaluate FLOOR", () => {
			const { evaluate } = parseFormula("=FLOOR(A1, 0.1)");
			assert.strictEqual(evaluate({ A1: 3.14159 }), 3.1);
		});

		it("should evaluate MOD", () => {
			const { evaluate } = parseFormula("=MOD(A1, A2)");
			assert.strictEqual(evaluate({ A1: 10, A2: 3 }), 1);
		});

		it("should throw MOD division by zero", () => {
			const { evaluate } = parseFormula("=MOD(A1, A2)");
			assert.throws(() => evaluate({ A1: 10, A2: 0 }), /Division by zero in MOD/);
		});

		it("should evaluate INT", () => {
			const { evaluate } = parseFormula("=INT(A1)");
			assert.strictEqual(evaluate({ A1: 3.9 }), 3);
		});

		it("should evaluate LEN", () => {
			const { evaluate } = parseFormula("=LEN(A1)");
			assert.strictEqual(evaluate({ A1: "hello" }), 5);
		});

		it("should evaluate UPPER", () => {
			const { evaluate } = parseFormula("=UPPER(A1)");
			assert.strictEqual(evaluate({ A1: "hello" }), "HELLO");
		});

		it("should evaluate LOWER", () => {
			const { evaluate } = parseFormula("=LOWER(A1)");
			assert.strictEqual(evaluate({ A1: "HELLO" }), "hello");
		});

		it("should evaluate TRIM", () => {
			const { evaluate } = parseFormula("=TRIM(A1)");
			assert.strictEqual(evaluate({ A1: "  hello  " }), "hello");
		});

		it("should evaluate CONCATENATE", () => {
			const { evaluate } = parseFormula("=CONCATENATE(A1, A2)");
			assert.strictEqual(evaluate({ A1: "hello", A2: " world" }), "hello world");
		});

		it("should evaluate MID", () => {
			const { evaluate } = parseFormula("=MID(A1, A2, A3)");
			assert.strictEqual(evaluate({ A1: "hello", A2: 2, A3: 3 }), "ell");
		});

		it("should evaluate LEFT", () => {
			const { evaluate } = parseFormula("=LEFT(A1, A2)");
			assert.strictEqual(evaluate({ A1: "hello", A2: 2 }), "he");
		});

		it("should evaluate LEFT with default length", () => {
			const { evaluate } = parseFormula("=LEFT(A1)");
			assert.strictEqual(evaluate({ A1: "hello" }), "h");
		});

		it("should evaluate RIGHT", () => {
			const { evaluate } = parseFormula("=RIGHT(A1, A2)");
			assert.strictEqual(evaluate({ A1: "hello", A2: 2 }), "lo");
		});

		it("should evaluate FIND", () => {
			const { evaluate } = parseFormula("=FIND(A1, A2)");
			assert.strictEqual(evaluate({ A1: "ell", A2: "hello" }), 2);
		});

		it("should evaluate FIND with no match", () => {
			const { evaluate } = parseFormula("=FIND(A1, A2)");
			assert.strictEqual(evaluate({ A1: "xyz", A2: "hello" }), 0);
		});

		it("should evaluate NOW", () => {
			const { evaluate } = parseFormula("=NOW()");
			const result = evaluate({});
			assert.strictEqual(typeof result, "string");
			assert.ok(result.includes("T"));
		});

		it("should evaluate TODAY", () => {
			const { evaluate } = parseFormula("=TODAY()");
			const result = evaluate({});
			assert.strictEqual(typeof result, "string");
			assert.ok(!result.includes("T"));
		});

		it("should throw on unknown function", () => {
			const { evaluate } = parseFormula("=UNKNOWN(A1)");
			assert.throws(() => evaluate({ A1: 10 }), /Unknown function: UNKNOWN/);
		});
	});

	describe("evaluate - cell references and ranges", () => {
		it("should resolve cell references", () => {
			const { evaluate } = parseFormula("=A1");
			assert.strictEqual(evaluate({ A1: 42 }), 42);
		});

		it("should return 0 for missing cell reference", () => {
			const { evaluate } = parseFormula("=A1");
			assert.strictEqual(evaluate({}), 0);
		});

		it("should convert string numbers from cells", () => {
			const { evaluate } = parseFormula("=A1");
			assert.strictEqual(evaluate({ A1: "42" }), 42);
		});

		it("should handle range references (A1:B3)", () => {
			const { evaluate } = parseFormula("=SUM(A1:B3)");
			assert.strictEqual(evaluate({ A1: 1, A2: 2, A3: 3, B1: 4, B2: 5, B3: 6 }), 21);
		});

		it("should handle sheet-qualified references (Sheet1!A1)", () => {
			const { evaluate } = parseFormula("=Sheet1!A1");
			assert.strictEqual(evaluate({ "Sheet1!A1": 42 }), 42);
		});

		it("should detect circular references", () => {
			const { evaluate } = parseFormula("=A1+B2");
			assert.throws(
				() => evaluate({ A1: 10, B2: 20 }, { maxDepth: 0 }),
				/Maximum recursion depth exceeded/,
			);
		});
	});

	describe("evaluate - literals", () => {
		it("should evaluate numeric literals", () => {
			const { evaluate } = parseFormula("=42");
			assert.strictEqual(evaluate({}), 42);
		});

		it("should evaluate decimal literals", () => {
			const { evaluate } = parseFormula("=3.14");
			assert.strictEqual(evaluate({}), 3.14);
		});

		it("should evaluate string literals", () => {
			const { evaluate } = parseFormula('="hello"');
			assert.strictEqual(evaluate({}), "hello");
		});

		it("should evaluate string literals with escaped quotes", () => {
			const { evaluate } = parseFormula('="hello \\"world\\""');
			assert.strictEqual(evaluate({}), 'hello "world"');
		});

		it("should evaluate boolean TRUE", () => {
			const { evaluate } = parseFormula("=TRUE");
			assert.strictEqual(evaluate({}), true);
		});

		it("should evaluate boolean FALSE", () => {
			const { evaluate } = parseFormula("=FALSE");
			assert.strictEqual(evaluate({}), false);
		});
	});

	describe("evaluate - error handling", () => {
		it("should throw on unexpected character", () => {
			assert.throws(() => parseFormula("=A1@B2"), /Unexpected character/);
		});

		it("should throw on unexpected token", () => {
			assert.throws(() => parseFormula("=)"), /Unexpected token/);
		});

		it("should throw on missing closing paren in function call", () => {
			assert.throws(() => parseFormula("=SUM(A1"), /Expected '\)' in function call/);
		});

		it("should throw on missing closing paren in expression", () => {
			assert.throws(() => parseFormula("=(A1+B2"), /Expected '\)'/);
		});
	});

	describe("evaluate - maxDepth option", () => {
		it("should respect custom maxDepth", () => {
			const { evaluate } = parseFormula("=A1");
			assert.strictEqual(evaluate({ A1: 42 }, { maxDepth: 100 }), 42);
		});
	});
});
