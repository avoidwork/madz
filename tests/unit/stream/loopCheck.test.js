import { describe, it } from "node:test";
import assert from "node:assert";
import {
	checkLoop,
	hasDuplicateSentence,
	hasRepeatedSentences,
	hasRepeatedWords,
	hasSimilarSentence,
	normalize,
	similarity,
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

describe("normalize", () => {
	it("lowercases, strips punctuation, and collapses whitespace", () => {
		assert.strictEqual(
			normalize("The Skill, Says: Branch Creation!"),
			"the skill says branch creation",
		);
		assert.strictEqual(normalize("  a   b.  \n c d?  "), "a b c d");
	});

	it("returns an empty string for punctuation-only input", () => {
		assert.strictEqual(normalize("..."), "");
	});
});

describe("similarity", () => {
	it("returns 1 for identical normalized sentences", () => {
		assert.strictEqual(
			similarity("the skill says branch creation", "the skill says branch creation"),
			1,
		);
	});

	it("returns a high value for garbled variants of the same content", () => {
		const a = normalize("the skill savs branch creation happens BEFORE staging");
		const b = normalize("the skill says branch creation happens BEFUKE staging");
		assert.ok(similarity(a, b) >= 0.85, `similarity ${similarity(a, b)}`);
	});

	it("returns a low value for distinct sentences", () => {
		const a = normalize("the quick brown fox jumps over the lazy dog");
		const b = normalize("completely unrelated content about weather patterns");
		assert.ok(similarity(a, b) < 0.5, `similarity ${similarity(a, b)}`);
	});

	it("returns 0 when either sentence has no tokens", () => {
		assert.strictEqual(similarity("", "the skill says branch creation"), 0);
		assert.strictEqual(similarity("the skill says branch creation", ""), 0);
	});
});

describe("hasSimilarSentence", () => {
	it("flags garbled repetition above the similarity threshold", () => {
		const sentences = [
			"The skill savs branch creation happens BEFORE staging.",
			"The skill says branch creation happens BEFUKE staging.",
			"The skill says branch creation happens BEFORE staging.",
		];
		assert.strictEqual(hasSimilarSentence(sentences, 2, 0.85), true);
	});

	it("does not flag distinct sentences", () => {
		const list = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is unique.`);
		assert.strictEqual(hasSimilarSentence(list, 2, 0.85), false);
	});

	it("does not flag below the similarity threshold", () => {
		const sentences = [
			"The quick brown fox jumps over the lazy dog.",
			"Completely unrelated content about weather patterns.",
			"Another entirely different sentence here.",
		];
		assert.strictEqual(hasSimilarSentence(sentences, 2, 0.85), false);
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

describe("hasRepeatedSentences", () => {
	const unit = (p) => Array.from({ length: p }, (_, i) => `Distinct sentence ${"abcde"[i]} here.`);
	const repeat = (list, times) => Array.from({ length: times }, () => list).flat();

	it("flags a 2-sentence loop repeated more than threshold times", () => {
		assert.strictEqual(hasRepeatedSentences(repeat(unit(2), 11), 10, 0.85), true);
		assert.strictEqual(hasRepeatedSentences(repeat(unit(2), 10), 10, 0.85), false);
	});

	it("flags loops up to the maximum period and not beyond it", () => {
		assert.strictEqual(hasRepeatedSentences(repeat(unit(5), 3), 2, 0.85), true);
		assert.strictEqual(hasRepeatedSentences(repeat(unit(5), 3), 2, 0.85, 4), false);
	});

	it("matches garbled copies of the unit", () => {
		const a = ["The skill says branch creation happens BEFORE staging.", "Then it commits."];
		const b = ["The skill savs branch creation happens BErURE staging.", "Then it commits."];
		assert.strictEqual(hasRepeatedSentences([...a, ...b, ...a], 2, 0.85), true);
	});

	it("only looks at the tail", () => {
		const list = [...repeat(unit(2), 5), "Something else entirely."];
		assert.strictEqual(hasRepeatedSentences(list, 2, 0.85), false);
	});

	it("ignores lines with no letters or digits between the copies", () => {
		const list = repeat([...unit(2), "});"], 3);
		assert.strictEqual(hasRepeatedSentences(list, 2, 0.85), true);
	});

	it("does not flag an empty list", () => {
		assert.strictEqual(hasRepeatedSentences([], 2, 0.85), false);
	});
});

describe("false positives on legitimate output", () => {
	const flagged = (text) => {
		const { sentences } = takeSentences(`${text}\n`);
		const { words } = takeWords("", `${text}\n`);
		return checkLoop({
			sentences: sentences.slice(-55),
			words: words.slice(-1000),
			threshold: 10,
			similarityThreshold: 0.85,
		});
	};
	const lines = (n, make) => Array.from({ length: n }, (_, i) => make(i)).join("\n");

	it("does not flag repeated closing braces", () => {
		assert.strictEqual(flagged(lines(11, () => "});")), false);
	});

	it("does not flag markdown table separator rows", () => {
		assert.strictEqual(flagged(lines(11, () => "| --- | --- |")), false);
	});

	it("does not flag one-per-line file paths", () => {
		assert.strictEqual(flagged(lines(12, (i) => `src/stream/file${i}.js`)), false);
		assert.strictEqual(flagged(lines(12, (i) => `src/stream/file${"abcdefghijkl"[i]}.js`)), false);
	});

	it("does not flag sentences that differ only in a number", () => {
		const text = lines(12, (i) => `Step ${i} of the process completed successfully now.`);
		assert.strictEqual(flagged(text), false);
	});

	it("still flags an identical prose line repeated", () => {
		assert.strictEqual(flagged(lines(12, () => "Everything is fine here.")), true);
	});
});

describe("genuine loops at production values", () => {
	const flagged = (text) => {
		const { sentences } = takeSentences(`${text}\n`);
		const { words } = takeWords("", `${text}\n`);
		return checkLoop({
			sentences: sentences.slice(-55),
			words: words.slice(-1000),
			threshold: 10,
			similarityThreshold: 0.85,
		});
	};
	const sentence = (n, len = 6) =>
		Array.from({ length: len }, (_, w) => `word${"abcdefghij"[n]}${"klmnopqrst"[w % 10]}x`).join(
			" ",
		) + ".";
	const unit = (n, len) => Array.from({ length: n }, (_, i) => sentence(i, len)).join(" ");

	it("flags one sentence repeated 40 times", () => {
		assert.strictEqual(flagged(Array(40).fill("The same thing again.").join(" ")), true);
	});

	it("flags a 2-sentence loop repeated 40 times", () => {
		assert.strictEqual(flagged(Array(40).fill(unit(2, 6)).join(" ")), true);
	});

	it("flags a 5-sentence loop repeated 40 times", () => {
		assert.strictEqual(flagged(Array(40).fill(unit(5, 6)).join(" ")), true);
	});

	it("flags a loop of five 60-word sentences repeated 30 times", () => {
		assert.strictEqual(flagged(Array(30).fill(unit(5, 60)).join(" ")), true);
	});

	it("flags 'ok' repeated 40 times", () => {
		assert.strictEqual(flagged("ok ".repeat(40)), true);
	});

	it("flags a garbled single sentence repeated", () => {
		const text = Array.from({ length: 14 }, (_, i) =>
			i % 2
				? "The skill says branch creation happens BEFORE staging."
				: "The skill savs branch creation happens BErURE staging.",
		).join(" ");
		assert.strictEqual(flagged(text), true);
	});
});
