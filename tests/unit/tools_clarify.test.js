import assert from "node:assert";
import { describe, it, after } from "node:test";
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { StateGraph, START, END, Command, MemorySaver, Annotation } from "@langchain/langgraph";
import { clarifyImpl } from "../../src/tools/clarify/index.js";

const TEST_DIR = join(process.cwd(), "memory", "__test_clarify__");
const CLARIFICATION_FILE = join(TEST_DIR, "clarifications.md");

function setup() {
	rmSync(TEST_DIR, { recursive: true, force: true });
}

function teardown() {
	rmSync(TEST_DIR, { recursive: true, force: true });
}

describe("clarify", () => {
	const testOptions = {
		allowedPaths: [],
		maxReadSize: "1mb",
		clarificationsFile: "./memory/__test_clarify__/clarifications.md",
	};

	it("returns open_ended when no choices provided", async () => {
		const result = await runClarifyInGraph(
			{ question: "What is your name?" },
			testOptions,
			"Jason",
		);
		assert.strictEqual(result.answered, true);
		assert.strictEqual(result.source, "open_ended");
		assert.strictEqual(result.question, "What is your name?");
		assert.strictEqual(result.answer, "Jason");
	});

	it("returns choices when choices array provided", async () => {
		const result = await runClarifyInGraph(
			{ question: "Which language?", choices: ["Python", "JavaScript"] },
			testOptions,
			"Python",
		);
		assert.strictEqual(result.answered, true);
		assert.strictEqual(result.source, "choices");
		assert.strictEqual(result.question, "Which language?");
		assert.deepStrictEqual(result.choices, ["Python", "JavaScript"]);
		assert.strictEqual(result.answer, "Python");
	});

	it("creates clarifications file", async () => {
		setup();
		await runClarifyInGraph(
			{
				question: "Test question",
				choices: ["A", "B"],
			},
			testOptions,
		);
		assert.strictEqual(existsSync(CLARIFICATION_FILE), true);
	});

	it("defaults clarifications file to config.memory.toolsDir when no option provided", async () => {
		setup();
		await runClarifyInGraph(
			{
				question: "Default path question",
				choices: ["A", "B"],
			},
			{},
		);
		const defaultFile = join(process.cwd(), "memory", "tools", "clarifications.md");
		assert.strictEqual(existsSync(defaultFile), true);
	});

	it("interrupts the graph when no resume value is provided", async () => {
		setup();
		const result = await runClarifyInGraph(
			{ question: "What color?", choices: ["red", "blue"] },
			testOptions,
		);
		assert.strictEqual(result.interrupted, true);
		assert.strictEqual(result.value.question, "What color?");
		assert.deepStrictEqual(result.value.choices, ["red", "blue"]);
	});

	after(teardown);
});

/**
 * Run clarifyImpl inside a small LangGraph so interrupt() has a context.
 * @param {Object} input - The clarify tool input
 * @param {Object} options - Runtime options
 * @param {string} [resume] - Optional resume value to continue the graph
 * @returns {Promise<Object>} The result
 */
async function runClarifyInGraph(input, options, resume) {
	const State = Annotation.Root({ messages: Annotation() });

	let parsedResult = null;
	const node = async () => {
		const raw = await clarifyImpl(input, options);
		parsedResult = JSON.parse(raw);
		return { messages: [parsedResult.answer ?? "interrupted"] };
	};

	const graph = new StateGraph(State)
		.addNode("ask", node)
		.addEdge(START, "ask")
		.addEdge("ask", END)
		.compile({ checkpointer: new MemorySaver() });

	const config = { configurable: { thread_id: "t1" } };

	// First run — expect an interrupt.
	const firstStream = await graph.stream({ messages: [] }, { ...config, streamMode: ["values"] });
	let interruptValue;
	for await (const chunk of firstStream) {
		if (chunk && Array.isArray(chunk[1]?.__interrupt__)) {
			interruptValue = chunk[1].__interrupt__[0]?.value;
		}
	}

	if (resume === undefined) {
		return { interrupted: true, value: interruptValue };
	}

	// Resume with the answer on the same graph/thread.
	const stream = await graph.stream(new Command({ resume }), { ...config, streamMode: ["values"] });
	for await (const _chunk of stream) {
		// Drain the stream; the parsed result is captured in the node.
	}
	return { interrupted: false, ...parsedResult };
}
