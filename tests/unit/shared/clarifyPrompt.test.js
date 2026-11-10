import { describe, it } from "node:test";
import assert from "node:assert";
import {
	normalizeChoices,
	formatChoices,
	formatClarifyPrompt,
	resolveChoice,
} from "../../../src/shared/clarifyPrompt.js";

describe("normalizeChoices", () => {
	it("returns an empty array for a non-array", () => {
		assert.deepStrictEqual(normalizeChoices(undefined), []);
		assert.deepStrictEqual(normalizeChoices("a"), []);
	});

	it("strips leading numbers and trims", () => {
		assert.deepStrictEqual(normalizeChoices(["1. A", "2) B", "  3.  C  ", "D"]), [
			"A",
			"B",
			"C",
			"D",
		]);
	});

	it("keeps a number that is part of the text", () => {
		assert.deepStrictEqual(normalizeChoices(["3 apples", "2024 plan", "v1.2"]), [
			"3 apples",
			"2024 plan",
			"v1.2",
		]);
	});

	it("drops empty choices", () => {
		assert.deepStrictEqual(normalizeChoices(["A", "", "  ", "1. "]), ["A"]);
	});
});

describe("formatChoices", () => {
	it("numbers each choice on its own line", () => {
		assert.strictEqual(formatChoices(["A", "B", "C"]), "1. A\n2. B\n3. C");
	});

	it("returns an empty string for no choices", () => {
		assert.strictEqual(formatChoices([]), "");
	});
});

describe("formatClarifyPrompt", () => {
	it("returns just the question without choices", () => {
		assert.strictEqual(formatClarifyPrompt("Why?"), "Why?");
		assert.strictEqual(formatClarifyPrompt("Why?", []), "Why?");
	});

	it("appends the choices as a numbered markdown list", () => {
		assert.strictEqual(formatClarifyPrompt("Which?", ["A", "B"]), "Which?\n\nOptions:\n1. A\n2. B");
	});
});

describe("resolveChoice", () => {
	const choices = ["A", "B", "C"];

	it("maps an in-range number to its choice", () => {
		assert.strictEqual(resolveChoice("1", choices), "A");
		assert.strictEqual(resolveChoice("3", choices), "C");
	});

	it("accepts a trailing dot or paren and surrounding space", () => {
		assert.strictEqual(resolveChoice("2.", choices), "B");
		assert.strictEqual(resolveChoice("2)", choices), "B");
		assert.strictEqual(resolveChoice("  2  ", choices), "B");
	});

	it("leaves out-of-range numbers and other text unchanged", () => {
		for (const reply of ["0", "4", "option 2", "2 please", "B", ""]) {
			assert.strictEqual(resolveChoice(reply, choices), reply);
		}
	});

	it("leaves everything unchanged when there are no choices", () => {
		assert.strictEqual(resolveChoice("1", []), "1");
	});

	it("returns a non-string reply unchanged", () => {
		const reply = { pick: 1 };
		assert.strictEqual(resolveChoice(reply, choices), reply);
		assert.strictEqual(resolveChoice(undefined, choices), undefined);
	});
});
