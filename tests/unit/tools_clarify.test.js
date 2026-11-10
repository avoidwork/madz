import assert from "node:assert";
import { describe, it, before, after } from "node:test";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StateGraph, START, END, Command, MemorySaver, Annotation } from "@langchain/langgraph";
import { clarifyImpl, ClarifySchema } from "../../src/tools/clarify/index.js";

let dir;
let file;
let runId = 0;

before(async () => {
	dir = await mkdtemp(join(tmpdir(), "madz-clarify-"));
});

after(async () => {
	await rm(dir, { recursive: true, force: true });
});

/**
 * Run clarifyImpl inside a small LangGraph so interrupt() has a context.
 * @param {Object} input - The clarify tool input
 * @param {Object} options - Runtime options
 * @param {string} [resume] - Optional resume value to continue the graph
 * @returns {Promise<Object>} The interrupt value (when not resumed) or the tool result
 */
async function runClarifyInGraph(input, options, resume) {
	const State = Annotation.Root({ messages: Annotation() });

	let result = null;
	let nodeRuns = 0;
	const node = async () => {
		nodeRuns += 1;
		result = await clarifyImpl(input, options);
		return { messages: [result.answer ?? "interrupted"] };
	};

	const graph = new StateGraph(State)
		.addNode("ask", node)
		.addEdge(START, "ask")
		.addEdge("ask", END)
		.compile({ checkpointer: new MemorySaver() });

	const config = { configurable: { thread_id: `t${runId++}` } };

	let interruptValue;
	for await (const chunk of await graph.stream(
		{ messages: [] },
		{ ...config, streamMode: ["values"] },
	)) {
		if (chunk && Array.isArray(chunk[1]?.__interrupt__)) {
			interruptValue = chunk[1].__interrupt__[0]?.value;
		}
	}

	if (resume === undefined) {
		return { interrupted: true, value: interruptValue, nodeRuns };
	}

	for await (const _chunk of await graph.stream(new Command({ resume }), {
		...config,
		streamMode: ["values"],
	})) {
		// Drain the stream; the result is captured in the node.
	}
	return { interrupted: false, nodeRuns, ...result };
}

describe("clarify", () => {
	const opts = () => ({ clarificationsFile: file });

	it("returns open_ended when no choices provided", async () => {
		file = join(dir, "open.md");
		const result = await runClarifyInGraph({ question: "What is your name?" }, opts(), "Jason");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.answered, true);
		assert.strictEqual(result.source, "open_ended");
		assert.strictEqual(result.question, "What is your name?");
		assert.strictEqual(result.answer, "Jason");
		assert.strictEqual("choices" in result, false);
		assert.strictEqual("raw" in result, false);
	});

	it("returns choices when a choices array is provided", async () => {
		file = join(dir, "choices.md");
		const result = await runClarifyInGraph(
			{ question: "Which language?", choices: ["Python", "JavaScript"] },
			opts(),
			"Python",
		);
		assert.strictEqual(result.source, "choices");
		assert.deepStrictEqual(result.choices, ["Python", "JavaScript"]);
		assert.strictEqual(result.answer, "Python");
		assert.strictEqual("raw" in result, false);
	});

	it("interrupts with the question and choices when there is no resume value", async () => {
		file = join(dir, "interrupt.md");
		const result = await runClarifyInGraph(
			{ question: "What color?", choices: ["red", "blue"] },
			opts(),
		);
		assert.strictEqual(result.interrupted, true);
		assert.strictEqual(result.value.question, "What color?");
		assert.deepStrictEqual(result.value.choices, ["red", "blue"]);
	});

	it("omits choices from the interrupt for an open-ended question", async () => {
		file = join(dir, "no-choices.md");
		const result = await runClarifyInGraph({ question: "Why?" }, opts());
		assert.deepStrictEqual(result.value, { question: "Why?" });
	});

	it("returns a native object with ok false on failure", async () => {
		const result = await clarifyImpl(null, opts());
		assert.strictEqual(result.ok, false);
		assert.strictEqual(typeof result.error, "string");
	});

	describe("numeric replies", () => {
		const choices = ["Python", "JavaScript", "Go"];
		const ask = async (reply) => {
			file = join(dir, `num-${runId}.md`);
			return runClarifyInGraph({ question: "Which?", choices }, opts(), reply);
		};

		for (const [reply, expected] of [
			["1", "Python"],
			["2", "JavaScript"],
			["3", "Go"],
			["2.", "JavaScript"],
			["2)", "JavaScript"],
			[" 2 ", "JavaScript"],
		]) {
			it(`resolves ${JSON.stringify(reply)} to ${expected}`, async () => {
				const result = await ask(reply);
				assert.strictEqual(result.answer, expected);
				assert.strictEqual(result.raw, reply);
			});
		}

		for (const reply of ["0", "4", "-1", "option 2", "2 please", "javascript", "1.5"]) {
			it(`leaves ${JSON.stringify(reply)} unchanged`, async () => {
				const result = await ask(reply);
				assert.strictEqual(result.answer, reply);
				assert.strictEqual("raw" in result, false);
			});
		}

		it("does not resolve a number for an open-ended question", async () => {
			file = join(dir, "open-num.md");
			const result = await runClarifyInGraph({ question: "How many?" }, opts(), "2");
			assert.strictEqual(result.answer, "2");
			assert.strictEqual("raw" in result, false);
		});

		it("returns a non-string reply unchanged", async () => {
			file = join(dir, "obj.md");
			const result = await runClarifyInGraph({ question: "Which?", choices }, opts(), {
				pick: 2,
			});
			assert.deepStrictEqual(result.answer, { pick: 2 });
		});
	});

	describe("choice cleanup", () => {
		it("strips numbers the model added and drops empty choices", async () => {
			file = join(dir, "clean.md");
			const result = await runClarifyInGraph(
				{ question: "Which?", choices: ["1. Python", "2) Go", "  ", "Rust"] },
				opts(),
				"2",
			);
			assert.deepStrictEqual(result.choices, ["Python", "Go", "Rust"]);
			assert.strictEqual(result.answer, "Go");
		});

		it("treats a choices array that cleans to nothing as open-ended", async () => {
			file = join(dir, "empty.md");
			const result = await runClarifyInGraph({ question: "Why?", choices: ["", " "] }, opts());
			assert.deepStrictEqual(result.value, { question: "Why?" });
		});
	});

	describe("clarifications file", () => {
		it("records the question, options and answer", async () => {
			file = join(dir, "record.md");
			await runClarifyInGraph(
				{ question: "Which language?", choices: ["Python", "Go"] },
				opts(),
				"2",
			);
			const text = await readFile(file, "utf-8");
			assert.match(text, /## Clarification: Which language\?/);
			assert.match(text, /- Options: 1\. Python, 2\. Go/);
			assert.match(text, /- Answer: Go/);
			assert.strictEqual(text.includes(", , "), false);
			assert.strictEqual(text.includes("Options:,"), false);
		});

		it("records an open-ended question without an Options line", async () => {
			file = join(dir, "record-open.md");
			await runClarifyInGraph({ question: "Name?" }, opts(), "Jason");
			const text = await readFile(file, "utf-8");
			assert.strictEqual(text.includes("Options"), false);
			assert.match(text, /- Answer: Jason/);
		});

		it("records nothing until the question is answered", async () => {
			file = join(dir, "unanswered.md");
			await runClarifyInGraph({ question: "Pending?", choices: ["a", "b"] }, opts());
			assert.strictEqual(existsSync(file), false);
		});

		it("records the question once, even though the node re-runs on resume", async () => {
			file = join(dir, "once.md");
			const result = await runClarifyInGraph({ question: "Once?" }, opts(), "yes");
			assert.strictEqual(result.nodeRuns, 2);
			const text = await readFile(file, "utf-8");
			assert.strictEqual(text.match(/## Clarification: Once\?/g).length, 1);
		});

		it("appends to an existing file without rewriting it", async () => {
			file = join(dir, "append.md");
			await writeFile(file, "# earlier\n", "utf-8");
			await runClarifyInGraph({ question: "Second?" }, opts(), "ok");
			const text = await readFile(file, "utf-8");
			assert.ok(text.startsWith("# earlier\n"));
			assert.match(text, /## Clarification: Second\?/);
		});

		it("keeps multi-line questions and answers on one line", async () => {
			file = join(dir, "lines.md");
			await runClarifyInGraph({ question: "Line one\n## Injected" }, opts(), "a\nb");
			const text = await readFile(file, "utf-8");
			assert.match(text, /## Clarification: Line one ## Injected/);
			assert.match(text, /- Answer: a b/);
			assert.strictEqual(/^## Injected/m.test(text), false);
		});

		it("creates the directory when it is missing", async () => {
			file = join(dir, "nested", "deeper", "made.md");
			await runClarifyInGraph({ question: "Dir?" }, opts(), "yes");
			assert.strictEqual(existsSync(file), true);
		});

		it("defaults the file to config.memory.toolsDir", async () => {
			await runClarifyInGraph({ question: "Default path?" }, {}, "yes");
			const defaultFile = join(process.cwd(), "memory", "tools", "clarifications.md");
			assert.strictEqual(existsSync(defaultFile), true);
		});

		it("still returns the answer when the file cannot be written", async () => {
			// A directory where the file should be makes the append fail.
			file = join(dir, "blocked.md");
			await mkdir(file);
			const result = await runClarifyInGraph({ question: "Blocked?" }, opts(), "yes");
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.answer, "yes");
		});
	});
});

describe("ClarifySchema", () => {
	it("accepts a question alone", () => {
		assert.strictEqual(ClarifySchema.safeParse({ question: "Why?" }).success, true);
	});

	it("trims the question and choices", () => {
		const result = ClarifySchema.parse({ question: "  Why?  ", choices: [" a ", "b"] });
		assert.strictEqual(result.question, "Why?");
		assert.deepStrictEqual(result.choices, ["a", "b"]);
	});

	it("rejects an empty question", () => {
		assert.strictEqual(ClarifySchema.safeParse({ question: "  " }).success, false);
	});

	it("rejects an empty choice", () => {
		assert.strictEqual(
			ClarifySchema.safeParse({ question: "q", choices: ["a", ""] }).success,
			false,
		);
	});

	it("rejects duplicate choices", () => {
		assert.strictEqual(
			ClarifySchema.safeParse({ question: "q", choices: ["a", "a"] }).success,
			false,
		);
	});

	it("accepts an empty choices array", () => {
		assert.strictEqual(ClarifySchema.safeParse({ question: "q", choices: [] }).success, true);
	});
});
