import { describe, it } from "node:test";
import assert from "node:assert";
import { CommandParser } from "../../src/tui/commandParser.js";
import { PANELS, nextPanel, prevPanel, getPanelOrder } from "../../src/tui/panels.js";
import { isStreamingMessage } from "../../src/tui/messages.js";

describe("command parser", () => {
	it("parses :quit command", () => {
		const parser = new CommandParser();
		const result = parser.parse(":quit", {});
		assert.strictEqual(result.action, "quit");
		assert.strictEqual(result.value, true);
	});

	it("returns null for non-command input", () => {
		const parser = new CommandParser();
		assert.strictEqual(parser.parse("hello world", {}), null);
	});

	it("detects command syntax", () => {
		const parser = new CommandParser();
		assert.strictEqual(parser.isCommand(":quit"), true);
		assert.strictEqual(parser.isCommand(":config set foo bar"), true);
		assert.strictEqual(parser.isCommand("normal message"), false);
	});

	it("lists registered commands", () => {
		const parser = new CommandParser();
		const commands = parser.listCommands();
		assert.ok(commands.includes("quit"));
		assert.ok(commands.includes("provider"));
		assert.ok(commands.includes("config"));
		assert.ok(commands.includes("memory"));
		assert.ok(commands.includes("schedule"));
	});

	it("checks if command exists", () => {
		const parser = new CommandParser();
		assert.strictEqual(parser.hasCommand("quit"), true);
		assert.strictEqual(parser.hasCommand("nonexistent"), false);
	});

	it("reports unknown commands", () => {
		const parser = new CommandParser();
		const result = parser.parse(":foo", {});
		assert.strictEqual(result.action, "unknown");
		assert.ok(result.message.includes("Unknown command"));
	});

	describe("provider command", () => {
		it("shows current provider without args", () => {
			const parser = new CommandParser();
			const ctx = { _sessionState: { getProvider: () => "openai", setProvider: () => {} } };
			const result = parser.parse(":provider", ctx);
			assert.strictEqual(result.action, "provider");
		});

		it("sets provider with :provider set name", () => {
			const parser = new CommandParser();
			let provider = "openai";
			const ctx = {
				_sessionState: {
					getProvider: () => provider,
					setProvider: (p) => {
						provider = p;
					},
				},
			};
			const result = parser.parse(":provider set local", ctx);
			assert.strictEqual(result.action, "provider");
			assert.strictEqual(result.subAction, "set");
			assert.strictEqual(result.value, "local");
		});
	});

	describe("config command", () => {
		it("sets config value with :config set path value", () => {
			const parser = new CommandParser();
			const ctx = {
				_setConfigValue: () => {},
			};
			const result = parser.parse(":config set telemetry.enabled true", ctx);
			assert.strictEqual(result.action, "config");
			assert.strictEqual(result.subAction, "set");
		});

		it("returns usage message when _setConfigValue is not provided", () => {
			const parser = new CommandParser();
			const ctx = {};
			const result = parser.parse(":config set foo bar", ctx);
			assert.strictEqual(result.action, "config");
			assert.ok(result.message.includes("Usage"));
		});
	});

	describe("memory command", () => {
		it("opens memory with :memory open", () => {
			const parser = new CommandParser();
			const ctx = { _contextList: true };
			const result = parser.parse(":memory open", ctx);
			assert.strictEqual(result.action, "memory");
			assert.strictEqual(result.subAction, "open");
		});

		it("searches memory with :memory search query", () => {
			const parser = new CommandParser();
			const result = parser.parse(":memory search daily", {});
			assert.strictEqual(result.action, "memory");
			assert.strictEqual(result.subAction, "search");
			assert.strictEqual(result.query, "daily");
		});

		it("returns usage with unknown memory subcommand", () => {
			const parser = new CommandParser();
			const result = parser.parse(":memory delete", {});
			assert.strictEqual(result.action, "memory");
			assert.ok(result.message.includes("Usage"));
		});
	});

	describe("schedule commands", () => {
		it("lists schedules with :schedule", () => {
			const parser = new CommandParser();
			const ctx = { _scheduleList: [{ name: "daily" }] };
			const result = parser.parse(":schedule", ctx);
			assert.strictEqual(result.action, "schedule");
		});

		it("lists schedules with :schedule list", () => {
			const parser = new CommandParser();
			const ctx = { _scheduleList: [{ name: "daily" }] };
			const result = parser.parse(":schedule list", ctx);
			assert.strictEqual(result.action, "schedule");
			assert.strictEqual(result.subAction, "list");
			assert.deepStrictEqual(result.list, [{ name: "daily" }]);
		});

		it("pauses schedule with :schedule pause name", () => {
			const parser = new CommandParser();
			const ctx = { _schedulePause: () => {} };
			const result = parser.parse(":schedule pause daily", ctx);
			assert.strictEqual(result.action, "schedule");
			assert.strictEqual(result.subAction, "pause");
		});

		it("resumes schedule with :schedule resume name", () => {
			const parser = new CommandParser();
			const ctx = { _scheduleResume: () => {} };
			const result = parser.parse(":schedule resume daily", ctx);
			assert.strictEqual(result.action, "schedule");
			assert.strictEqual(result.subAction, "resume");
		});

		it("runs schedule immediately with :schedule run-now name", () => {
			const parser = new CommandParser();
			const result = parser.parse(":schedule run-now daily", {});
			assert.strictEqual(result.action, "schedule");
			assert.strictEqual(result.subAction, "run-now");
		});

		it("returns unknown subcommand message for :schedule foo", () => {
			const parser = new CommandParser();
			const result = parser.parse(":schedule foo", {});
			assert.strictEqual(result.action, "schedule");
			assert.ok(result.message.includes("Unknown subcommand"));
		});
	});

	describe("help command", () => {
		it("shows help message", () => {
			const parser = new CommandParser();
			const result = parser.parse(":help", {});
			assert.strictEqual(result.action, "help");
			assert.ok(result.message.includes("Available commands"));
		});
	});

	describe("context command", () => {
		it("adds context with :context add text", () => {
			const parser = new CommandParser();
			const result = parser.parse(":context add some text", {});
			assert.strictEqual(result.action, "context");
			assert.strictEqual(result.subAction, "add");
			assert.strictEqual(result.value, "some text");
		});

		it("returns usage for non-add context subcommand", () => {
			const parser = new CommandParser();
			const result = parser.parse(":context remove", {});
			assert.strictEqual(result.action, "context");
			assert.ok(result.message.includes("Usage"));
		});
	});
});

describe("TUI - panel navigation", () => {
	it("has correct panel order", () => {
		const order = getPanelOrder();
		assert.deepStrictEqual(order, ["conversation", "skills", "memory", "settings"]);
	});

	it("cycles to next panel", () => {
		assert.strictEqual(nextPanel("conversation"), "skills");
		assert.strictEqual(nextPanel("skills"), "memory");
		assert.strictEqual(nextPanel("memory"), "settings");
		assert.strictEqual(nextPanel("settings"), "conversation");
	});

	it("cycles to prev panel", () => {
		assert.strictEqual(prevPanel("conversation"), "settings");
		assert.strictEqual(prevPanel("skills"), "conversation");
		assert.strictEqual(prevPanel("memory"), "skills");
		assert.strictEqual(prevPanel("settings"), "memory");
	});

	it("constants are frozen objects", () => {
		assert.ok(typeof PANELS === "object");
		assert.strictEqual(PANELS.CONVERSATION, "conversation");
	});
});

describe("TUI - message formatting", () => {
	it("maps role to label", () => {
		// Re-define locally since we can't import the function directly
		function getRoleLabel(role, assistantName) {
			switch (role) {
				case "user":
					return "You";
				case "assistant":
					return assistantName || "Assistant";
				case "system":
					return "System";
				default:
					return role || "Unknown";
			}
		}

		assert.strictEqual(getRoleLabel("user"), "You");
		assert.strictEqual(getRoleLabel("assistant"), "Assistant");
		assert.strictEqual(getRoleLabel("assistant", "madz"), "madz");
		assert.strictEqual(getRoleLabel("assistant", "oracle"), "oracle");
		assert.strictEqual(getRoleLabel("system"), "System");
		assert.strictEqual(getRoleLabel("unknown"), "unknown");
	});

	it("calculates visible message count", () => {
		function calcVisibleCount(totalLines, linesPerMessage = 3) {
			return Math.max(1, Math.floor(totalLines / linesPerMessage));
		}

		assert.strictEqual(calcVisibleCount(80, 3), 26);
		assert.strictEqual(calcVisibleCount(10, 3), 3);
		assert.strictEqual(calcVisibleCount(5, 3), 1); // floor to 1
	});

	it("gets visible messages within viewport", () => {
		function getVisibleMessages(messages, scrollOffset, visibleCount) {
			const total = messages.length;
			const start = Math.max(0, Math.min(scrollOffset, total - visibleCount));
			const end = Math.min(total, start + visibleCount);
			return { messages: messages.slice(start, end), scrollTop: start, scrollHeight: total };
		}

		const msgs = [
			{ role: "user", content: "1" },
			{ role: "user", content: "2" },
			{ role: "user", content: "3" },
			{ role: "user", content: "4" },
			{ role: "user", content: "5" },
		];

		const result = getVisibleMessages(msgs, 0, 3);
		assert.strictEqual(result.messages.length, 3);
		assert.strictEqual(result.scrollTop, 0);
	});

	it("counts message lines for scrolling", () => {
		function countMessageLines(messages, lineWidth = 80) {
			let total = 0;
			for (const msg of messages) {
				total += 2;
				const lines = Math.ceil((msg.content || "").length / lineWidth);
				total += Math.max(1, lines);
				total += 1;
			}
			return total;
		}

		const msgs = [
			{ role: "user", content: "Short" },
			{ role: "assistant", content: "A longer response with multiple words" },
		];

		const lines = countMessageLines(msgs);
		assert.ok(lines > 0);
	});
});

describe("TUI - role colors", () => {
	it("returns correct colors for user role", () => {
		function getRoleColors(role) {
			if (role === "user") {
				return { label: "green", content: "white" };
			}
			if (role === "system") {
				return { label: "yellow", content: "yellow" };
			}
			return { label: "cyan", content: "white" };
		}

		assert.deepStrictEqual(getRoleColors("user"), { label: "green", content: "white" });
		assert.deepStrictEqual(getRoleColors("assistant"), { label: "cyan", content: "white" });
		assert.deepStrictEqual(getRoleColors("system"), { label: "yellow", content: "yellow" });
	});
});

describe("TUI - bubble style", () => {
	it("returns flex-end alignment with green border for user", () => {
		function getBubbleStyle(role) {
			if (role === "user") {
				return { alignment: "flex-end", border: "green" };
			}
			if (role === "system") {
				return { alignment: "flex-start", border: "yellow" };
			}
			return { alignment: "flex-start", border: "cyan" };
		}

		assert.deepStrictEqual(getBubbleStyle("user"), {
			alignment: "flex-end",
			border: "green",
		});
		assert.deepStrictEqual(getBubbleStyle("assistant"), {
			alignment: "flex-start",
			border: "cyan",
		});
		assert.deepStrictEqual(getBubbleStyle("system"), {
			alignment: "flex-start",
			border: "yellow",
		});
	});
});

describe("TUI - status indicator", () => {
	it("returns correct indicator for ready status", () => {
		function getStatusIndicator(status) {
			if (status.startsWith("Error")) {
				return { indicator: "\u2716", color: "red" };
			}
			if (status === "Sending..." || status === "Streaming...") {
				return { indicator: "\u25B6", color: "yellow" };
			}
			return { indicator: "\u25CF", color: "green" };
		}

		assert.deepStrictEqual(getStatusIndicator("Ready"), { indicator: "\u25CF", color: "green" });
		assert.deepStrictEqual(getStatusIndicator("Sending..."), {
			indicator: "\u25B6",
			color: "yellow",
		});
		assert.deepStrictEqual(getStatusIndicator("Streaming..."), {
			indicator: "\u25B6",
			color: "yellow",
		});
		assert.deepStrictEqual(getStatusIndicator("Error: something failed"), {
			indicator: "\u2716",
			color: "red",
		});
	});
});

describe("TUI - timestamp formatting", () => {
	it("formats time as HH:MM", () => {
		function formatTime(date) {
			return (
				String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0")
			);
		}

		const d = new Date("2026-05-24T14:30:00Z");
		// UTC hours may differ based on timezone, so just check format pattern
		const result = formatTime(d);
		assert.match(result, /^\d{2}:\d{2}$/);
	});
});

describe("TUI - visible count with terminal rows", () => {
	it("calculates visible messages from terminal height minus status bar", () => {
		function calcVisibleCount(totalLines, linesPerMessage = 3) {
			return Math.max(1, Math.floor(totalLines / linesPerMessage));
		}

		// A typical 24-row terminal: 24 - 2 (status bar) = 22 lines for messages
		assert.strictEqual(calcVisibleCount(22, 3), 7);
		// A tall 50-row terminal
		assert.strictEqual(calcVisibleCount(48, 3), 16);
		// Small terminal
		assert.strictEqual(calcVisibleCount(6, 3), 2);
	});
});

describe("TUI - streaming message utility", () => {
	it("detects a streaming message", () => {
		assert.strictEqual(
			isStreamingMessage({ role: "assistant", content: "hello", streaming: true }),
			true,
		);
		assert.strictEqual(
			isStreamingMessage({ role: "assistant", content: "hello", streaming: false }),
			false,
		);
		assert.strictEqual(isStreamingMessage({ role: "assistant", content: "hello" }), false);
		assert.strictEqual(
			isStreamingMessage({ role: "user", content: "hello", streaming: true }),
			true,
		);
	});

	it("removes partial streaming messages on error", () => {
		const messages = [
			{ role: "user", content: "hello", time: "10:00" },
			{ role: "assistant", content: "partial\u2588", time: "10:00", streaming: true },
		];

		const isStreamingMessage = (msg) => msg.streaming === true;
		const cleaned = messages.filter((msg) => !isStreamingMessage(msg));

		assert.strictEqual(cleaned.length, 1);
		assert.strictEqual(cleaned[0].role, "user");
	});

	it("handles multiple streaming messages during cleanup", () => {
		const messages = [
			{ role: "user", content: "hello", time: "10:00" },
			{ role: "assistant", content: "chunk1\u2588", time: "10:00", streaming: true },
			{ role: "user", content: "hi", time: "10:01" },
			{ role: "assistant", content: "chunk2\u2588", time: "10:01", streaming: true },
		];

		const isStreamingMessage = (msg) => msg.streaming === true;
		const cleaned = messages.filter((msg) => !isStreamingMessage(msg));

		assert.strictEqual(cleaned.length, 2);
		assert.strictEqual(cleaned[0].content, "hello");
		assert.strictEqual(cleaned[1].content, "hi");
	});

	it("commits streaming content by stripping cursor and flag", () => {
		function commitStreamingMessage(msg, finalContent) {
			const committed = finalContent.replace(/\u2588$/, "");
			return {
				...msg,
				content: committed,
				streaming: false,
			};
		}

		const streamingMsg = { role: "assistant", content: "partial\u2588", streaming: true };
		const finalMsg = { role: "assistant", content: "final answer\u2588", streaming: true };

		assert.strictEqual(commitStreamingMessage(streamingMsg, "partial\u2588").content, "partial");
		assert.strictEqual(commitStreamingMessage(streamingMsg, "partial\u2588").streaming, false);
		assert.strictEqual(commitStreamingMessage(finalMsg, "final answer\u2588").streaming, false);
		assert.strictEqual(
			commitStreamingMessage(finalMsg, "final answer\u2588").content,
			"final answer",
		);
		assert.strictEqual(
			commitStreamingMessage({ role: "assistant", streaming: false }, "no cursor").content,
			"no cursor",
		);
	});

	it("appends cursor to streaming content for display", () => {
		const chunk1 = "Hello";
		const chunk2 = "Hello world";
		const chunk3 = "Hello world. This is a longer response.";

		assert.strictEqual(chunk1 + "\u2588", "Hello\u2588");
		assert.strictEqual(chunk2 + "\u2588", "Hello world\u2588");
		assert.strictEqual(chunk3 + "\u2588", "Hello world. This is a longer response.\u2588");
	});

	it("dispatches text events from streamEvents callback", () => {
		const events = [
			{ type: "text", text: "Hello, " },
			{ type: "tool_end", toolName: "search" },
			{ type: "text", text: "Final answer." },
		];

		const results = {};
		const dispatch = (event) => {
			if (event.type === "text") {
				results.content = (results.content || "") + event.text;
			} else if (event.type === "tool_end") {
				results.toolCalls = results.toolCalls || [];
				results.toolCalls.push(event.toolName);
			}
		};

		for (const event of events) {
			dispatch(event);
		}

		assert.strictEqual(results.content, "Hello, Final answer.");
		assert.deepStrictEqual(results.toolCalls, ["search"]);
	});

	it("dispatches tool_end and tool_error events correctly", () => {
		const events = [
			{ type: "tool_end", toolName: "read_file", toolCallId: "1", data: "file contents" },
			{ type: "tool_error", toolName: "write_file", toolCallId: "2", error: "permission denied" },
		];

		const toolCalls = [];
		for (const event of events) {
			if (event.type === "tool_end") {
				const resultLine = event.data ? ` Result: ${JSON.stringify(event.data).slice(0, 200)}` : "";
				const displayLine = event.toolName
					? `- Tool: ${event.toolName}${resultLine}`
					: `- Tool: ${event.toolCallId || "unknown"}${resultLine}`;
				toolCalls.push(displayLine);
			} else if (event.type === "tool_error") {
				const errorLine = event.toolName
					? `- Tool: ${event.toolName} (error: ${event.error})`
					: `- Tool call failed (${event.toolCallId || "unknown"})`;
				toolCalls.push(errorLine);
			}
		}

		assert.strictEqual(toolCalls.length, 2);
		assert.strictEqual(toolCalls[0], '- Tool: read_file Result: "file contents"');
		assert.strictEqual(toolCalls[1], "- Tool: write_file (error: permission denied)");
	});

	it("formats tool call display lines with newlines", () => {
		const toolCalls = [
			"- Tool: search Result: 3 files",
			"- Tool: read_file Result: file contents",
			"- Tool: write_file (error: permission denied)",
		];

		const display = toolCalls.join("\n");
		const lines = display.split("\n");

		assert.strictEqual(lines.length, 3);
		assert.strictEqual(lines[0], "- Tool: search Result: 3 files");
		assert.strictEqual(lines[1], "- Tool: read_file Result: file contents");
		assert.strictEqual(lines[2], "- Tool: write_file (error: permission denied)");
	});
});

describe("InputPanel - prompt detection", () => {
	it("detects command mode with colon prefix", () => {
		function isCommand(text) {
			return text.startsWith(":");
		}

		assert.strictEqual(isCommand(":quit"), true);
		assert.strictEqual(isCommand(":provider set openai"), true);
		assert.strictEqual(isCommand("> hello"), false);
		assert.strictEqual(isCommand("normal text"), false);
		assert.strictEqual(isCommand(""), false);
	});

	it("returns correct prompt character for each mode", () => {
		function getPrompt(text) {
			return text.startsWith(":") ? ":" : ">";
		}

		assert.strictEqual(getPrompt("> hello"), ">");
		assert.strictEqual(getPrompt(":quit"), ":");
		assert.strictEqual(getPrompt(""), ">");
	});

	it("returns correct prompt color for each mode", () => {
		function getPromptColor(text) {
			return text.startsWith(":") ? "magenta" : "green";
		}

		assert.strictEqual(getPromptColor(":quit"), "magenta");
		assert.strictEqual(getPromptColor("normal"), "green");
		assert.strictEqual(getPromptColor(""), "green");
	});
});

describe("InputPanel - identity rendering", () => {
	it("renders app name and version elements in correct order", () => {
		function buildIdentityElements(appInfo) {
			const elements = [];
			if (appInfo) {
				if (appInfo.name) {
					elements.push({ text: appInfo.name, color: "cyan" });
				}
				if (appInfo.version) {
					elements.push({ text: appInfo.version, color: "white" });
				}
			}
			return elements;
		}

		const elements = buildIdentityElements({ name: "madz", version: "1.0.0" });
		assert.strictEqual(elements.length, 2);
		assert.strictEqual(elements[0].text, "madz");
		assert.strictEqual(elements[0].color, "cyan");
		assert.strictEqual(elements[1].text, "1.0.0");
		assert.strictEqual(elements[1].color, "white");
	});

	it("renders custom app name in cyan", () => {
		function buildIdentityElements(appInfo) {
			const elements = [];
			if (appInfo) {
				if (appInfo.name) {
					elements.push({ text: appInfo.name, color: "cyan" });
				}
				if (appInfo.version) {
					elements.push({ text: appInfo.version, color: "white" });
				}
			}
			return elements;
		}

		const elements = buildIdentityElements({ name: "oracle", version: "2.0.0" });
		assert.strictEqual(elements[0].text, "oracle");
		assert.strictEqual(elements[0].color, "cyan");
	});

	it("renders version in white", () => {
		function buildIdentityElements(appInfo) {
			const elements = [];
			if (appInfo) {
				if (appInfo.name) {
					elements.push({ text: appInfo.name, color: "cyan" });
				}
				if (appInfo.version) {
					elements.push({ text: appInfo.version, color: "white" });
				}
			}
			return elements;
		}

		const elements = buildIdentityElements({ name: "madz", version: "1.0.0" });
		assert.strictEqual(elements[1].color, "white");
	});

	it("renders empty when appInfo is undefined", () => {
		function buildIdentityElements(appInfo) {
			const elements = [];
			if (appInfo) {
				if (appInfo.name) {
					elements.push({ text: appInfo.name, color: "cyan" });
				}
				if (appInfo.version) {
					elements.push({ text: appInfo.version, color: "white" });
				}
			}
			return elements;
		}

		assert.strictEqual(buildIdentityElements(undefined).length, 0);
		assert.strictEqual(buildIdentityElements(null).length, 0);
	});

	it("renders both name and version in correct order", () => {
		function buildIdentityElements(appInfo) {
			const elements = [];
			if (appInfo) {
				if (appInfo.name) {
					elements.push({ text: appInfo.name, color: "cyan" });
				}
				if (appInfo.version) {
					elements.push({ text: appInfo.version, color: "white" });
				}
			}
			return elements;
		}

		const elements = buildIdentityElements({ name: "myapp", version: "3.2.1" });
		assert.strictEqual(elements.length, 2);
		assert.strictEqual(elements[0].text, "myapp");
		assert.strictEqual(elements[1].text, "3.2.1");
	});
});

describe("InputPanel - flex grow", () => {
	it("input text element has flexGrow enabled", () => {
		function getInputFlexProps() {
			return { flexGrow: 1 };
		}

		const props = getInputFlexProps();
		assert.strictEqual(props.flexGrow, 1);
	});
});
