import { describe, it } from "node:test";
import assert from "node:assert";
import {
	checkLoop,
	hasDuplicateSentence,
	hasRepeatedWords,
	takeSentences,
	takeWords,
} from "../../../src/stream/loopCheck.js";

describe("takeSentences", () => {
	it("splits on sentence ends and newlines and returns the unfinished tail", () => {
		assert.deepStrictEqual(takeSentences("One. Two? Three!\nFour and"), {
			sentences: ["One.", "Two?", "Three!"],
			rest: "Four and",
		});
	});

	it("collapses whitespace and skips blanks", () => {
		assert.deepStrictEqual(takeSentences("  a   b.  \n\n  c d.  tail"), {
			sentences: ["a b.", "c d."],
			rest: "tail",
		});
	});

	it("returns nothing completed when no sentence has ended", () => {
		assert.deepStrictEqual(takeSentences("ok ok ok ok"), { sentences: [], rest: "ok ok ok ok" });
		assert.deepStrictEqual(takeSentences(""), { sentences: [], rest: "" });
	});

	it("scans only from the given index, so a boundary split across deltas is still found", () => {
		const first = takeSentences("Hello there.");
		assert.deepStrictEqual(first, { sentences: [], rest: "Hello there." });
		// The next delta starts with the whitespace that completes the sentence.
		const joined = first.rest + " Next";
		assert.deepStrictEqual(takeSentences(joined, first.rest.length), {
			sentences: ["Hello there."],
			rest: "Next",
		});
	});

	it("gives the same sentences however the text is chunked", () => {
		const text = "First one. Second one? Third one!\nFourth line\nFifth one. tail";
		const whole = takeSentences(text).sentences;
		for (const size of [1, 2, 3, 5, 7, 11]) {
			let pending = "";
			const got = [];
			for (let i = 0; i < text.length; i += size) {
				const delta = text.slice(i, i + size);
				const out = takeSentences(pending + delta, pending.length);
				pending = out.rest;
				got.push(...out.sentences);
			}
			assert.deepStrictEqual(got, whole, `chunk size ${size}`);
		}
	});
});

describe("takeWords", () => {
	it("returns completed words and carries the unfinished one", () => {
		assert.deepStrictEqual(takeWords("", "ok ok o"), { words: ["ok", "ok"], rest: "o" });
	});

	it("joins a word split across deltas", () => {
		const a = takeWords("", "hel");
		const b = takeWords(a.rest, "lo wor");
		assert.deepStrictEqual(a, { words: [], rest: "hel" });
		assert.deepStrictEqual(b, { words: ["hello"], rest: "wor" });
	});

	it("completes the word when the delta ends in whitespace", () => {
		assert.deepStrictEqual(takeWords("", "ok "), { words: ["ok"], rest: "" });
	});

	it("gives the same words however the text is chunked", () => {
		const text = "the quick brown fox jumps over the lazy dog ";
		const whole = takeWords("", text).words;
		for (const size of [1, 2, 3, 5, 7]) {
			let partial = "";
			const got = [];
			for (let i = 0; i < text.length; i += size) {
				const out = takeWords(partial, text.slice(i, i + size));
				partial = out.rest;
				got.push(...out.words);
			}
			assert.deepStrictEqual(got, whole, `chunk size ${size}`);
		}
	});
});

describe("hasDuplicateSentence", () => {
	it("flags a sentence repeated more than threshold times", () => {
		assert.strictEqual(
			hasDuplicateSentence(["Same thing.", "Same thing.", "Same thing."], 2),
			true,
		);
		assert.strictEqual(hasDuplicateSentence(["Same thing.", "Same thing."], 2), false);
	});

	it("does not need the repeats to be back-to-back", () => {
		assert.strictEqual(
			hasDuplicateSentence(["Alpha.", "Beta.", "Alpha.", "Gamma.", "Alpha."], 2),
			true,
		);
	});

	it("does not flag distinct sentences", () => {
		const list = Array.from({ length: 30 }, (_, i) => `Sentence number ${i}.`);
		assert.strictEqual(hasDuplicateSentence(list, 2), false);
	});

	it("does not lowercase: a differently-cased sentence is a different sentence", () => {
		assert.strictEqual(hasDuplicateSentence(["Ok then.", "ok then.", "OK THEN."], 2), false);
	});
});

describe("hasRepeatedWords", () => {
	const w = (s) => s.split(" ");

	it("flags 'ok' repeated with no punctuation", () => {
		assert.strictEqual(hasRepeatedWords(w("ok ok ok"), 2), true);
		assert.strictEqual(hasRepeatedWords(w("ok ok"), 2), false);
	});

	it("flags a multi-word run repeated back-to-back", () => {
		assert.strictEqual(hasRepeatedWords(w("so then we go so then we go so then we go"), 2), true);
	});

	it("flags a repeat at the tail even after unrelated words", () => {
		assert.strictEqual(hasRepeatedWords(w("something else entirely ok ok ok"), 2), true);
	});

	it("does not flag a repeat that is not at the tail", () => {
		assert.strictEqual(hasRepeatedWords(w("ok ok ok and then it moved on"), 2), false);
	});

	it("does not flag words with no repeat, or an empty list", () => {
		assert.strictEqual(
			hasRepeatedWords(w("the quick brown fox jumps over the lazy dog"), 2),
			false,
		);
		assert.strictEqual(hasRepeatedWords([], 2), false);
	});

	it("honours a higher threshold", () => {
		assert.strictEqual(hasRepeatedWords(w("ok ok ok ok"), 4), false);
		assert.strictEqual(hasRepeatedWords(w("ok ok ok ok ok"), 4), true);
	});
});

describe("checkLoop", () => {
	it("is true for either kind of repeat and false otherwise", () => {
		assert.strictEqual(
			checkLoop({ sentences: [], words: Array(20).fill("ok"), threshold: 2 }),
			true,
		);
		assert.strictEqual(
			checkLoop({ sentences: Array(5).fill("This is a test."), words: [], threshold: 2 }),
			true,
		);
		assert.strictEqual(
			checkLoop({
				sentences: ["A one.", "B two.", "C three."],
				words: ["a", "b", "c"],
				threshold: 2,
			}),
			false,
		);
	});
});
