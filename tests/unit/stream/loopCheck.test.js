import { describe, it } from "node:test";
import assert from "node:assert";
import {
	checkLoop,
	hasRepeatedChain,
	normalize,
	takeWords,
} from "../../../src/stream/loopCheck.js";

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

describe("normalize", () => {
	it("lowercases, strips punctuation, and collapses whitespace", () => {
		assert.strictEqual(normalize("Branch,"), "branch");
		assert.strictEqual(normalize("  a   b.  \n c d?  "), "a b c d");
	});

	it("returns an empty string for punctuation-only input", () => {
		assert.strictEqual(normalize("..."), "");
	});
});

describe("hasRepeatedChain", () => {
	const w = (s) => s.split(" ");

	it("flags a 3-word chain repeated more than threshold times", () => {
		assert.strictEqual(
			hasRepeatedChain(w("let me reconsider let me reconsider let me reconsider"), 2),
			true,
		);
		assert.strictEqual(hasRepeatedChain(w("let me reconsider let me reconsider"), 2), false);
	});

	it("finds a chain across sentence and paragraph boundaries, not just at the tail", () => {
		const text =
			"Let me reconsider the approach here. Let me reconsider the plan now. " +
			"Let me reconsider the steps again. Let me reconsider the order next.";
		assert.strictEqual(hasRepeatedChain(w(text), 2), true);
	});

	it("does not flag distinct prose", () => {
		const text =
			"The quick brown fox jumps over the lazy dog near the riverbank. " +
			"The weather today is warm and sunny with a light breeze. " +
			"We should consider the budget carefully before committing to the plan.";
		assert.strictEqual(hasRepeatedChain(w(text), 2), false);
	});

	it("honours a higher threshold", () => {
		const text = "let me reconsider ".repeat(3);
		assert.strictEqual(hasRepeatedChain(w(text), 3), false);
		assert.strictEqual(hasRepeatedChain(w(text), 2), true);
	});

	it("detects chains of the configured lengths", () => {
		// A 2-word chain recurs but 3- and 4-word chains do not.
		const text = "one two three one two four one two five";
		assert.strictEqual(hasRepeatedChain(w(text), 2, 3, 4), false);
		assert.strictEqual(hasRepeatedChain(w(text), 2, 2, 2), true);
	});

	it("ignores words with no letters or digits", () => {
		const text = "ok ok ok }); ok ok ok";
		assert.strictEqual(hasRepeatedChain(w(text), 2), true);
	});

	it("does not flag an empty or short list", () => {
		assert.strictEqual(hasRepeatedChain([], 2), false);
		assert.strictEqual(hasRepeatedChain(w("a b c"), 2), false);
	});
});

describe("checkLoop", () => {
	it("is true for a recurring chain and false otherwise", () => {
		assert.strictEqual(
			checkLoop({ words: "let me reconsider ".repeat(3).split(" "), threshold: 2 }),
			true,
		);
		assert.strictEqual(
			checkLoop({ words: "the quick brown fox jumps over the lazy dog".split(" "), threshold: 2 }),
			false,
		);
	});

	it("flags 'ok' repeated with no punctuation", () => {
		assert.strictEqual(checkLoop({ words: Array(20).fill("ok"), threshold: 2 }), true);
	});

	it("flags a chain that recurs across multiple paragraphs", () => {
		const text =
			"For the tool implementation, I am mirroring the jira pattern. " +
			"The tools to read from the cached config object. " +
			"Tests can inject a policy through options to override the cached config. " +
			"For the tool implementation, I am mirroring the jira pattern. " +
			"The tools to read from the cached config object. " +
			"Tests can inject a policy through options to override the cached config.";
		assert.strictEqual(checkLoop({ words: text.split(" "), threshold: 2 }), true);
	});
});
