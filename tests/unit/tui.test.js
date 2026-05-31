import { describe, it } from "node:test";
import assert from "node:assert";

const CONVERSATION_CLEAR = "CONVERSATION_CLEAR";
const CONSOLE_EXIT = "CONSOLE_EXIT";

function handleCommand(command) {
	const parts = command.slice(1).trim().split(/\s+/);
	const cmd = parts[0]?.toLowerCase();
	const commands = {
		help: "",
		clear: CONVERSATION_CLEAR,
		skill: (name) => (name ? `CONSOLE_SKILL_${name}` : "/skill <name> - Invoke a discovered skill"),
		exit: CONSOLE_EXIT,
	};
	const handler = commands[cmd];
	if (handler !== undefined) {
		return typeof handler === "function" ? handler(parts[1]) : handler;
	}
	return `Unknown command: /${cmd}. Type /help for available commands.`;
}

describe("inputPanel command handling", () => {
	it("resolves /help to empty string (handled by app)", () => {
		assert.strictEqual(handleCommand("/help"), "");
	});

	it("resolves /clear to CONVERSATION_CLEAR sentinel", () => {
		assert.strictEqual(handleCommand("/clear"), CONVERSATION_CLEAR);
	});

	it("resolves /exit to CONSOLE_EXIT sentinel", () => {
		assert.strictEqual(handleCommand("/exit"), CONSOLE_EXIT);
	});

	it("resolves /skill with name to CONSOLE_SKILL_<name>", () => {
		assert.strictEqual(handleCommand("/skill foo"), "CONSOLE_SKILL_foo");
		assert.strictEqual(handleCommand("/skill my-skill"), "CONSOLE_SKILL_my-skill");
	});

	it("resolves /skill without name to error message", () => {
		assert.strictEqual(handleCommand("/skill"), "/skill <name> - Invoke a discovered skill");
	});

	it("handles unknown commands with error message", () => {
		assert.ok(handleCommand("/foo").startsWith("Unknown command:"));
	});

	it("resolves /CLEAR case-insensitively to clear", () => {
		assert.strictEqual(handleCommand("/CLEAR"), CONVERSATION_CLEAR);
	});

	it("handles malformed commands", () => {
		assert.ok(handleCommand("/").startsWith("Unknown command:"));
	});
});

// Test command history extraction logic (mirrors React.useMemo in app.jsx)
describe("command history extraction", () => {
	it("extracts deduplicated user messages from conversation", () => {
		const conv = [
			{ role: "user", content: "hello" },
			{ role: "assistant", content: "hi" },
			{ role: "user", content: "world" },
			{ role: "assistant", content: "ok" },
			{ role: "user", content: "hello" }, // duplicate
		];
		const dedup = [];
		const seen = new Set();
		for (let i = conv.length - 1; i >= 0; i--) {
			const msg = conv[i];
			if (msg?.role === "user" && msg?.content && !seen.has(msg.content)) {
				seen.add(msg.content);
				dedup.push(msg.content);
			}
		}
		// Reversed for navigation
		const result = dedup.reverse();
		assert.deepStrictEqual(result, ["world", "hello"]);
	});

	it("respects max history limit of 20", () => {
		const conv = Array.from({ length: 30 }, (_, i) => ({
			role: "user",
			content: `msg-${i}`,
		}));
		const dedup = [];
		const seen = new Set();
		for (let i = conv.length - 1; i >= 0; i--) {
			const msg = conv[i];
			if (msg?.role === "user" && msg?.content && !seen.has(msg.content)) {
				seen.add(msg.content);
				dedup.push(msg.content);
			}
			if (dedup.length >= 20) break;
		}
		assert.strictEqual(dedup.length, 20);
	});

	it("returns empty array for non-user roles", () => {
		const conv = [
			{ role: "system", content: "hi" },
			{ role: "assistant", content: "hello" },
		];
		const dedup = [];
		for (let i = conv.length - 1; i >= 0; i--) {
			const msg = conv[i];
			if (msg?.role === "user" && msg?.content) {
				dedup.push(msg.content);
			}
		}
		assert.deepStrictEqual(dedup, []);
	});

	it("handles empty conversation", () => {
		const dedup = [];
		for (let i = [].length - 1; i >= 0; i--) {
			const msg = [][i];
			if (msg?.role === "user" && msg?.content) {
				dedup.push(msg.content);
			}
			if (dedup.length >= 20) break;
		}
		assert.deepStrictEqual(dedup, []);
	});
});

// Test streaming callback logic
describe("streaming callback accumulation", () => {
	it("accumulates text chunks into last AI streaming block", () => {
		let state = [
			{ id: "human-1", role: "human", content: "hello" },
			{ id: "ai-1", role: "ai", content: "", streaming: true },
		];

		function processChunk(text) {
			const lastIdx = state.length - 1;
			if (state[lastIdx]?.role === "ai" && state[lastIdx]?.streaming) {
				const updated = [...state];
				updated[lastIdx] = { ...updated[lastIdx], content: updated[lastIdx].content + text };
				state = updated;
			}
		}

		processChunk("hi ");
		processChunk("there!");

		assert.strictEqual(state[state.length - 1].content, "hi there!");
		assert.strictEqual(state[state.length - 1].streaming, true);
	});

	it("creates new streaming block when no prior AI block exists", () => {
		let state = [{ id: "human-1", role: "human", content: "hello" }];
		const events = [{ type: "text", text: "world" }];

		function processEvent(event) {
			if (event.type === "text" && event.text) {
				const lastIdx = state.length - 1;
				if (state[lastIdx]?.role === "ai" && state[lastIdx]?.streaming) {
					const updated = [...state];
					updated[lastIdx] = {
						...updated[lastIdx],
						content: updated[lastIdx].content + event.text,
					};
					state = updated;
				} else {
					state = [
						...state,
						{
							id: `streaming-${Date.now()}`,
							role: "ai",
							content: event.text,
							streaming: true,
							toolCalls: [],
						},
					];
				}
			}
		}

		events.forEach(processEvent);
		assert.strictEqual(state.length, 2);
		assert.strictEqual(state[1].role, "ai");
		assert.strictEqual(state[1].content, "world");
		assert.strictEqual(state[1].streaming, true);
	});

	it("creates tool call block on tool_start event", () => {
		let state = [{ id: "human-1", role: "human", content: "check cpu" }];

		const event = { type: "tool_start", toolCallId: "call-123", toolName: "terminal" };
		const lastIdx = state.length - 1;
		if (state[lastIdx]?.role === "ai" && state[lastIdx]?.streaming) {
			const updated = [...state];
			updated[lastIdx] = { ...updated[lastIdx], streaming: false };
			state = updated;
		}
		state = [
			...state,
			{
				id: `tool-${Date.now()}-${event.toolCallId}`,
				role: "ai",
				content: "",
				streaming: false,
				toolCalls: [{ id: event.toolCallId, name: event.toolName }],
			},
		];

		assert.strictEqual(state.length, 2);
		assert.strictEqual(state[1].toolCalls.length, 1);
		assert.strictEqual(state[1].toolCalls[0].name, "terminal");
		assert.strictEqual(state[1].toolCalls[0].id, "call-123");
	});

	it("marks final streaming block as non-streaming on completion", () => {
		let state = [
			{ id: "human-1", role: "human", content: "hello" },
			{ id: "ai-1", role: "ai", content: "some text", streaming: true },
		];

		const updated = [...state];
		for (let i = updated.length - 1; i >= 0; i--) {
			if (updated[i]?.streaming) updated[i] = { ...updated[i], streaming: false };
		}
		assert.strictEqual(updated[1].streaming, false);
	});
});
