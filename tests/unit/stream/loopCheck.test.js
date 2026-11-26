import { describe, it } from "node:test";
import assert from "node:assert";
import {
	checkLoop,
	hasRepeatedChain,
	hasRepeatedRun,
	hasRepeatedToolCall,
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

	it("flags a 5-word chain repeated more than threshold times", () => {
		assert.strictEqual(
			hasRepeatedChain(
				w("let me reconsider the plan let me reconsider the plan let me reconsider the plan"),
				2,
			),
			true,
		);
		assert.strictEqual(
			hasRepeatedChain(w("let me reconsider the plan let me reconsider the plan"), 2),
			false,
		);
	});

	it("does not flag a 3-word chain by default (minChain is 5)", () => {
		assert.strictEqual(
			hasRepeatedChain(w("let me reconsider let me reconsider let me reconsider"), 2),
			false,
		);
	});

	it("finds a chain across sentence and paragraph boundaries, not just at the tail", () => {
		const text =
			"Let me reconsider the approach here. Let me reconsider the plan here. " +
			"Let me reconsider the steps here. Let me reconsider the order here.";
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
		const text = "let me reconsider the plan ".repeat(3);
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
		const text = "ok ok ok ok ok }); ok ok ok ok ok";
		assert.strictEqual(hasRepeatedChain(w(text), 2), true);
	});

	it("does not flag an empty or short list", () => {
		assert.strictEqual(hasRepeatedChain([], 2), false);
		assert.strictEqual(hasRepeatedChain(w("a b c"), 2), false);
	});
});

describe("hasRepeatedRun", () => {
	const w = (s) => s.split(" ");

	it("flags a single word repeated back-to-back (stutter)", () => {
		assert.strictEqual(hasRepeatedRun(w("Ottawa Ottawa Ottawa Ottawa"), 2), true);
		assert.strictEqual(hasRepeatedRun(w("Ottawa Ottawa"), 2), false);
	});

	it("flags a phrase repeated back-to-back", () => {
		const text = "Turn off phone notifications so you don't get distracted. ".repeat(3);
		assert.strictEqual(hasRepeatedRun(w(text), 2), true);
	});

	it("flags a multi-word unit repeated back-to-back", () => {
		assert.strictEqual(hasRepeatedRun(w("a b c a b c a b c"), 2), true);
	});

	it("does not flag a unit that is not back-to-back", () => {
		assert.strictEqual(hasRepeatedRun(w("a b c x a b c y a b c"), 2), false);
	});

	it("does not flag distinct prose", () => {
		const text =
			"The quick brown fox jumps over the lazy dog near the riverbank. " +
			"The weather today is warm and sunny with a light breeze. " +
			"We should consider the budget carefully before committing to the plan.";
		assert.strictEqual(hasRepeatedRun(w(text), 2), false);
	});

	it("honours a higher threshold", () => {
		assert.strictEqual(hasRepeatedRun(w("ok ok ok ok"), 4), false);
		assert.strictEqual(hasRepeatedRun(w("ok ok ok ok ok"), 4), true);
	});

	it("does not flag an empty or short list", () => {
		assert.strictEqual(hasRepeatedRun([], 2), false);
		assert.strictEqual(hasRepeatedRun(w("a b c"), 2), false);
	});
});

describe("hasRepeatedToolCall", () => {
	it("flags the same tool name and target repeated more than threshold times", () => {
		const calls = Array.from({ length: 4 }, () => ({ name: "read", target: "file.txt" }));
		assert.strictEqual(hasRepeatedToolCall(calls, 3), true);
		assert.strictEqual(hasRepeatedToolCall(calls.slice(0, 3), 3), false);
	});

	it("does not flag calls with an intervening state change", () => {
		const calls = [
			{ name: "read", target: "file.txt" },
			{ name: "read", target: "other.txt" },
			{ name: "read", target: "file.txt" },
			{ name: "read", target: "file.txt" },
		];
		assert.strictEqual(hasRepeatedToolCall(calls, 3), false);
	});

	it("does not flag calls to different targets", () => {
		const calls = [
			{ name: "read", target: "a.txt" },
			{ name: "read", target: "b.txt" },
			{ name: "read", target: "c.txt" },
			{ name: "read", target: "d.txt" },
		];
		assert.strictEqual(hasRepeatedToolCall(calls, 3), false);
	});

	it("does not flag a single call", () => {
		assert.strictEqual(hasRepeatedToolCall([{ name: "read", target: "file.txt" }], 3), false);
	});

	it("does not flag an empty list", () => {
		assert.strictEqual(hasRepeatedToolCall([], 3), false);
	});

	it("ignores malformed tool-call records", () => {
		const calls = [
			{ name: "read", target: "file.txt" },
			{ name: "read", target: "file.txt" },
			{ name: "read", target: "file.txt" },
			{ name: "read", target: "file.txt" },
			{ name: "read" },
			{ target: "file.txt" },
			null,
		];
		assert.strictEqual(hasRepeatedToolCall(calls, 3), true);
	});
});

describe("checkLoop", () => {
	it("is true for a recurring chain and false otherwise", () => {
		assert.strictEqual(
			checkLoop({ words: "let me reconsider the plan ".repeat(3).split(" "), threshold: 2 }),
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
		const para =
			"For the tool implementation, I am mirroring the jira pattern. " +
			"The tools to read from the cached config object. " +
			"Tests can inject a policy through options to override the cached config. ";
		assert.strictEqual(checkLoop({ words: para.repeat(3).split(" "), threshold: 2 }), true);
	});

	it("flags a word stutter", () => {
		assert.strictEqual(
			checkLoop({ words: "Ottawa Ottawa Ottawa Ottawa".split(" "), threshold: 2 }),
			true,
		);
	});

	it("flags a phrase loop", () => {
		const text = "Turn off phone notifications so you don't get distracted. ".repeat(3);
		assert.strictEqual(checkLoop({ words: text.split(" "), threshold: 2 }), true);
	});

	it("does not flag a common short phrase recurring a few times at the default threshold (3)", () => {
		const text = "the end of the day the end of the day the end of the day";
		assert.strictEqual(checkLoop({ words: text.split(" "), threshold: 3 }), false);
	});

	it("flags a genuine sustained loop at the default threshold (3)", () => {
		const text = "let me reconsider the plan ".repeat(4);
		assert.strictEqual(checkLoop({ words: text.split(" "), threshold: 3 }), true);
	});

	it("flags a repeated identical tool call", () => {
		const toolCalls = Array.from({ length: 4 }, () => ({ name: "read", target: "file.txt" }));
		assert.strictEqual(checkLoop({ words: [], threshold: 3, toolCalls }), true);
	});

	it("does not flag tool calls with a state change", () => {
		const toolCalls = [
			{ name: "read", target: "file.txt" },
			{ name: "read", target: "other.txt" },
			{ name: "read", target: "file.txt" },
			{ name: "read", target: "file.txt" },
		];
		assert.strictEqual(checkLoop({ words: [], threshold: 3, toolCalls }), false);
	});

	it("does not flag when no tool calls are present", () => {
		assert.strictEqual(checkLoop({ words: [], threshold: 3 }), false);
	});
});
