import { describe, it } from "node:test";
import assert from "node:assert";
import React from "react";
import { renderToString } from "ink";
import {
	createSubagentStore,
	updateSubagentStore,
	namespaceKey,
} from "../../../src/tui/subagentStore.js";
import { SubagentsPanel } from "../../../src/tui/subagentsPanel.js";

describe("namespaceKey", () => {
	it("joins a populated namespace into a stable key", () => {
		assert.strictEqual(namespaceKey(["task:abc"]), "task:abc");
		assert.strictEqual(namespaceKey(["task:abc", "task:def"]), "task:abc/task:def");
	});

	it("returns empty string for empty or non-array namespace", () => {
		assert.strictEqual(namespaceKey([]), "");
		assert.strictEqual(namespaceKey(undefined), "");
		assert.strictEqual(namespaceKey(null), "");
	});
});

describe("createSubagentStore", () => {
	it("creates an empty store", () => {
		assert.deepStrictEqual(createSubagentStore(), {});
	});
});

describe("updateSubagentStore — namespace discrimination", () => {
	it("ignores events with an empty namespace (root graph)", () => {
		const store = createSubagentStore();
		const next = updateSubagentStore(store, {
			type: "subagent_message",
			namespace: [],
			text: "root message",
		});
		assert.deepStrictEqual(next, {});
	});

	it('ignores events with a blank-component namespace (root graph yields [""])', () => {
		// The store keys on the joined namespace; a blank component produces an
		// empty key and is ignored. This guards against the root graph's
		// `[""]` namespace leaking into the store.
		const store = createSubagentStore();
		const next = updateSubagentStore(store, {
			type: "subagent_message",
			namespace: [""],
			text: "root message",
		});
		assert.deepStrictEqual(next, {});
	});

	it("routes a subagent message to the namespace entry", () => {
		const store = createSubagentStore();
		const next = updateSubagentStore(store, {
			type: "subagent_message",
			namespace: ["task:abc"],
			text: "subagent says hi",
		});
		assert.ok(next["task:abc"]);
		assert.deepStrictEqual(next["task:abc"].segments, [
			{ type: "message", content: "subagent says hi" },
		]);
	});

	it("routes a subagent reasoning segment to the namespace entry", () => {
		const store = createSubagentStore();
		const next = updateSubagentStore(store, {
			type: "subagent_reasoning",
			namespace: ["task:abc"],
			text: "thinking...",
		});
		assert.deepStrictEqual(next["task:abc"].segments, [
			{ type: "reasoning", content: "thinking..." },
		]);
	});

	it("keeps distinct namespaces separate", () => {
		let store = createSubagentStore();
		store = updateSubagentStore(store, {
			type: "subagent_message",
			namespace: ["task:abc"],
			text: "first",
		});
		store = updateSubagentStore(store, {
			type: "subagent_message",
			namespace: ["task:def"],
			text: "second",
		});
		assert.deepStrictEqual(store["task:abc"].segments, [{ type: "message", content: "first" }]);
		assert.deepStrictEqual(store["task:def"].segments, [{ type: "message", content: "second" }]);
	});
});

describe("updateSubagentStore — tool-call redirection", () => {
	it("records a subagent tool start", () => {
		const store = createSubagentStore();
		const next = updateSubagentStore(store, {
			type: "subagent_tool_start",
			namespace: ["task:abc"],
			name: "read_file",
			data: { input: { path: "/tmp/x" } },
		});
		assert.deepStrictEqual(next["task:abc"].toolCalls, [
			{ name: "read_file", input: { path: "/tmp/x" }, status: "running" },
		]);
	});

	it("marks a running tool as done on tool end", () => {
		let store = createSubagentStore();
		store = updateSubagentStore(store, {
			type: "subagent_tool_start",
			namespace: ["task:abc"],
			name: "read_file",
			data: { input: { path: "/tmp/x" } },
		});
		store = updateSubagentStore(store, {
			type: "subagent_tool_end",
			namespace: ["task:abc"],
			name: "read_file",
			data: { output: "file contents" },
		});
		assert.strictEqual(store["task:abc"].toolCalls.length, 1);
		assert.strictEqual(store["task:abc"].toolCalls[0].status, "done");
		assert.strictEqual(store["task:abc"].toolCalls[0].output, "file contents");
	});

	it("routes a subagent tool text segment", () => {
		const store = createSubagentStore();
		const next = updateSubagentStore(store, {
			type: "subagent_tool",
			namespace: ["task:abc"],
			text: "tool output",
			name: "read_file",
		});
		assert.deepStrictEqual(next["task:abc"].segments, [
			{ type: "tool", content: "tool output", name: "read_file" },
		]);
	});

	it("records a tool end when no tool is running", () => {
		const store = createSubagentStore();
		const next = updateSubagentStore(store, {
			type: "subagent_tool_end",
			namespace: ["task:abc"],
			name: "read_file",
			data: { output: "file contents" },
		});
		assert.deepStrictEqual(next["task:abc"].toolCalls, [
			{ name: "read_file", output: "file contents", status: "done" },
		]);
	});

	it("ignores unknown event types", () => {
		const store = createSubagentStore();
		const next = updateSubagentStore(store, {
			type: "subagent_unknown",
			namespace: ["task:abc"],
			text: "ignored",
		});
		assert.deepStrictEqual(next["task:abc"].segments, []);
		assert.deepStrictEqual(next["task:abc"].toolCalls, []);
	});
});

describe("SubagentsPanel", () => {
	it("renders nothing when not active", () => {
		const result = renderToString(
			React.createElement(SubagentsPanel, {
				subagentStore: { "task:abc": { namespace: "task:abc", segments: [], toolCalls: [] } },
				activeView: "conversation",
			}),
		);
		assert.strictEqual(result, "");
	});

	it("renders an empty state when there are no subagents", () => {
		const result = renderToString(
			React.createElement(SubagentsPanel, {
				subagentStore: {},
				activeView: "subagents",
			}),
		);
		assert.ok(result.includes("No subagent activity yet."));
	});

	it("renders each subagent's message segments", () => {
		const result = renderToString(
			React.createElement(SubagentsPanel, {
				subagentStore: {
					"task:abc": {
						namespace: "task:abc",
						segments: [{ type: "message", content: "subagent says hi" }],
						toolCalls: [],
					},
				},
				activeView: "subagents",
			}),
		);
		assert.ok(result.includes("subagent says hi"));
	});

	it("renders subagent tool calls", () => {
		const result = renderToString(
			React.createElement(SubagentsPanel, {
				subagentStore: {
					"task:abc": {
						namespace: "task:abc",
						segments: [],
						toolCalls: [{ name: "read_file", status: "done" }],
					},
				},
				activeView: "subagents",
			}),
		);
		assert.ok(result.includes("read_file"));
	});
});
