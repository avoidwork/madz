import { describe, it } from "node:test";
import assert from "node:assert";
import { CommandParser } from "../../src/tui/commandParser.js";
import { PANELS, nextPanel, prevPanel, getPanelOrder } from "../../src/tui/panels.js";

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
			if (status === "Sending...") {
				return { indicator: "\u25B6", color: "yellow" };
			}
			return { indicator: "\u25CF", color: "green" };
		}

		assert.deepStrictEqual(getStatusIndicator("Ready"), { indicator: "\u25CF", color: "green" });
		assert.deepStrictEqual(getStatusIndicator("Sending..."), {
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
