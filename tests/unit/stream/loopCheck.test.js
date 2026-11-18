import { describe, it } from "node:test";
import assert from "node:assert";
import {
	checkLoop,
	completedSentences,
	hasDuplicateSentence,
	hasRepeatedWords,
} from "../../../src/stream/loopCheck.js";

const OPTS = { windowSize: 20, threshold: 2 };

describe("completedSentences", () => {
	it("splits on sentence ends and newlines and drops the unfinished tail", () => {
		assert.deepStrictEqual(completedSentences("One. Two? Three!\nFour and"), [
			"One.",
			"Two?",
			"Three!",
		]);
	});

	it("collapses whitespace and skips blanks", () => {
		assert.deepStrictEqual(completedSentences("  a   b.  \n\n  c d.  tail"), ["a b.", "c d."]);
	});

	it("returns nothing when no sentence has ended", () => {
		assert.deepStrictEqual(completedSentences("ok ok ok ok"), []);
		assert.deepStrictEqual(completedSentences(""), []);
	});
});

describe("hasDuplicateSentence", () => {
	it("flags a sentence repeated more than threshold times", () => {
		assert.strictEqual(hasDuplicateSentence("Same thing. ".repeat(3) + "tail", 20, 2), true);
		assert.strictEqual(hasDuplicateSentence("Same thing. ".repeat(2) + "tail", 20, 2), false);
	});

	it("does not need the repeats to be back-to-back", () => {
		const text = "Alpha one. Beta two. Alpha one. Gamma three. Alpha one. tail";
		assert.strictEqual(hasDuplicateSentence(text, 20, 2), true);
	});

	it("only compares the last windowSize sentences", () => {
		const text =
			"Same thing. " + "Filler a. Filler b. Filler c. ".repeat(1) + "Same thing. Same thing. tail";
		// 3 copies exist, but a window of 3 only sees the last 3 sentences.
		assert.strictEqual(hasDuplicateSentence(text, 3, 2), false);
		assert.strictEqual(hasDuplicateSentence(text, 20, 2), true);
	});

	it("does not flag distinct sentences", () => {
		const text = Array.from({ length: 30 }, (_, i) => `Sentence number ${i}.`).join(" ") + " tail";
		assert.strictEqual(hasDuplicateSentence(text, 20, 2), false);
	});

	it("does not lowercase: a differently-cased sentence is a different sentence", () => {
		assert.strictEqual(hasDuplicateSentence("Ok then. ok then. OK THEN. tail", 20, 2), false);
	});
});

describe("hasRepeatedWords", () => {
	it("flags 'ok' repeated with no punctuation", () => {
		assert.strictEqual(hasRepeatedWords("ok ok ok", 2), true);
		assert.strictEqual(hasRepeatedWords("ok ok", 2), false);
	});

	it("flags a multi-word run repeated back-to-back", () => {
		assert.strictEqual(hasRepeatedWords("so then we go so then we go so then we go", 2), true);
	});

	it("flags a repeat at the tail even after unrelated text", () => {
		assert.strictEqual(hasRepeatedWords("something else entirely ok ok ok", 2), true);
	});

	it("does not flag a repeat that is not at the tail", () => {
		assert.strictEqual(hasRepeatedWords("ok ok ok and then it moved on", 2), false);
	});

	it("does not flag text with no repeat", () => {
		assert.strictEqual(hasRepeatedWords("the quick brown fox jumps over the lazy dog", 2), false);
		assert.strictEqual(hasRepeatedWords("", 2), false);
	});

	it("honours a higher threshold", () => {
		assert.strictEqual(hasRepeatedWords("ok ok ok ok", 4), false);
		assert.strictEqual(hasRepeatedWords("ok ok ok ok ok", 4), true);
	});
});

describe("checkLoop", () => {
	it("is true for either kind of repeat and false otherwise", () => {
		assert.strictEqual(checkLoop("ok ".repeat(20), OPTS), true);
		assert.strictEqual(checkLoop("This is a test. ".repeat(5), OPTS), true);
		assert.strictEqual(
			checkLoop("A normal paragraph. With different sentences. Nothing repeats.", OPTS),
			false,
		);
	});
});
