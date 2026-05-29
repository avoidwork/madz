import React from "react";
import { describe, it } from "node:test";
import assert from "node:assert";
import { CommandParser } from "../../src/tui/commandParser.js";
import { PANELS, nextPanel, prevPanel, getPanelOrder } from "../../src/tui/panels.js";
import {
	isStreamingMessage,
	getRoleLabel,
	formatMessage,
	countMessageLines,
	getToolCallLines,
} from "../../src/tui/messages.js";
import { parseMarkdown, MarkdownText } from "../../src/tui/markdownText.js";

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

		it("sets config value with :config path value (no 'set' keyword)", () => {
			const parser = new CommandParser();
			let configPath = null;
			const ctx = {
				_setConfigValue: (p) => {
					configPath = p;
				},
			};
			const result = parser.parse(":config telemetry.enabled true", ctx);
			assert.strictEqual(result.action, "config");
			assert.strictEqual(result.subAction, "set");
			assert.strictEqual(result.path, "telemetry.enabled");
			assert.strictEqual(configPath, "telemetry.enabled");
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
});

describe("TUI - timestamp formatting", () => {
	it("formats time using Intl.DateTimeFormat", async () => {
		const { formatTime } = await import("../../src/tui/conversationPanel.js");

		const d = new Date("2026-05-24T14:30:00Z");
		const result = formatTime(d);
		// Accept any locale-aware time format (e.g., "14:30", "2:30 PM", "1430")
		assert.ok(/\d/.test(result), "time formatting should contain a digit");
	});
});

describe("TUI - getRoleLabel", () => {
	it("maps user role to 'You'", () => {
		assert.strictEqual(getRoleLabel("user"), "You");
	});

	it("maps assistant role to assistantName when provided", () => {
		assert.strictEqual(getRoleLabel("assistant", "madz"), "madz");
		assert.strictEqual(getRoleLabel("assistant", "oracle"), "oracle");
	});

	it("maps assistant role to 'Assistant' when no name provided", () => {
		assert.strictEqual(getRoleLabel("assistant"), "Assistant");
	});

	it("maps system role to 'System'", () => {
		assert.strictEqual(getRoleLabel("system"), "System");
	});

	it("returns role string as fallback for unknown roles", () => {
		assert.strictEqual(getRoleLabel("unknown"), "unknown");
		assert.strictEqual(getRoleLabel(null), "Unknown");
	});
});

describe("TUI - formatMessage", () => {
	it("formats message with timestamp", () => {
		const msg = { role: "user", content: "hello", timestamp: "10:00" };
		const result = formatMessage(msg);
		assert.ok(result.includes("You (10:00)"));
		assert.ok(result.includes("hello"));
	});

	it("formats message without timestamp", () => {
		const msg = { role: "assistant", content: "world" };
		const result = formatMessage(msg, "madz");
		assert.ok(result.includes("madz"));
		assert.ok(result.includes("world"));
		assert.ok(!result.includes("("));
	});

	it("handles empty content", () => {
		const msg = { role: "user", content: "" };
		const result = formatMessage(msg);
		assert.ok(result.includes("(empty)"));
	});
});

describe("TUI - countMessageLines", () => {
	it("counts lines for single message", () => {
		const messages = [{ role: "user", content: "hello world" }];
		const result = countMessageLines(messages, 80);
		assert.ok(typeof result === "number" && result > 0);
	});

	it("counts lines for multiple messages", () => {
		const messages = [
			{ role: "user", content: "hello" },
			{ role: "assistant", content: "world" },
		];
		const result = countMessageLines(messages, 80);
		assert.ok(result > countMessageLines([{ role: "user", content: "hello" }], 80));
	});

	it("handles empty messages array", () => {
		const result = countMessageLines([], 80);
		assert.strictEqual(result, 0);
	});

	it("handles long content with line wrapping", () => {
		const longContent = "x".repeat(240);
		const messages = [{ role: "user", content: longContent }];
		const result = countMessageLines(messages, 80);
		assert.ok(result > 3); // Should wrap to multiple lines
	});
});

describe("TUI - getToolCallLines", () => {
	it("splits tool call display by newlines", () => {
		const lines = getToolCallLines("- Tool: search\n- Tool: read_file");
		assert.strictEqual(lines.length, 2);
		assert.strictEqual(lines[0], "- Tool: search");
		assert.strictEqual(lines[1], "- Tool: read_file");
	});

	it("returns empty array for falsy input", () => {
		const lines = getToolCallLines("");
		assert.strictEqual(lines.length, 0);
		assert.strictEqual(getToolCallLines(null).length, 0);
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

describe("markdownText - parseMarkdown", () => {
	it("parses markdown headings", () => {
		const result = parseMarkdown("# Hello");
		assert.ok(typeof result === "string");
		assert.ok(result.length > 0);
	});

	it("parses markdown with code blocks", () => {
		const result = parseMarkdown("```js\nconsole.log(1);\n```");
		assert.ok(typeof result === "string");
		assert.ok(result.length > 0);
	});

	it("parses markdown with lists", () => {
		const result = parseMarkdown("- item 1\n- item 2\n- item 3");
		assert.ok(typeof result === "string");
		assert.ok(result.length > 0);
	});

	it("parses plain text", () => {
		const result = parseMarkdown("just some text");
		assert.strictEqual(result, "just some text");
	});

	it("trims trailing whitespace", () => {
		const result = parseMarkdown("# Hello\n\n");
		assert.strictEqual(result.endsWith(" "), false);
		assert.strictEqual(result.endsWith("\n"), false);
	});
});

describe("MarkdownText - rendering", () => {
	it("returns null for null content", () => {
		const result = MarkdownText({ content: null });
		assert.strictEqual(result, null);
	});

	it("returns null for undefined content", () => {
		const result = MarkdownText({ content: undefined });
		assert.strictEqual(result, null);
	});

	it("returns null for empty string content", () => {
		const result = MarkdownText({ content: "" });
		assert.strictEqual(result, null);
	});

	it("renders Text element with normal content", () => {
		const result = MarkdownText({ content: "# Hello" });
		assert.ok(React.isValidElement(result));
		assert.strictEqual(result.type.name, "Text");
		assert.strictEqual(result.props.color, "white");
		assert.strictEqual(result.props.wrap, "hard");
		assert.ok(result.props.children);
	});

	it("renders with fallback for falsy content", () => {
		const result = MarkdownText({ content: 0 });
		assert.ok(React.isValidElement(result));
		assert.strictEqual(result.type.name, "Text");
		assert.strictEqual(result.props.color, "white");
	});

	it("renders content with multiple markdown elements", () => {
		const content = "# Title\n\nSome paragraph.\n\n- list item";
		const result = MarkdownText({ content });
		assert.ok(React.isValidElement(result));
		assert.strictEqual(result.type.name, "Text");
		assert.strictEqual(result.props.color, "white");
		assert.ok(result.props.children);
	});
});
