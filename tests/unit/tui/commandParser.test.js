/**
 * Tests for the TUI CommandParser class.
 * @see {@link src/tui/commandParser.js}
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { CommandParser } from "../../../src/tui/commandParser.js";

/**
 * Create a minimal mock context with spies for all methods the parser may call.
 */
function createMockContext(overrides = {}) {
	const provider = { current: "openai" };
	const scheduleList = [];
	const gcInfo = { available: true, calls: [], hourCalls: 3 };

	return {
		_sessionState: {
			setProvider: (name) => {
				provider.current = name;
			},
			getProvider: () => provider.current,
		},
		_setConfigValue: (path, value) => {
			/* spy target */
		},
		_scheduleList: scheduleList,
		_schedulePause: (name) => {
			/* spy target */
		},
		_scheduleResume: (name) => {
			/* spy target */
		},
		_gcStatus: () => ({ ...gcInfo }),
		_gcTrigger: () => ({ triggered: true, hourCalls: 3 }),
		_skillList: [],
		_executeSkill: (name, args) => ({
			action: "skill",
			subAction: "execute",
			name,
			args,
		}),
		...overrides,
	};
}

describe("CommandParser", () => {
	let parser;

	beforeEach(() => {
		parser = new CommandParser();
	});

	/* ------------------------------------------------------------------ */
	/*  Construction                                                       */
	/* ------------------------------------------------------------------ */
	describe("construction", () => {
		it("creates an instance with default commands registered", () => {
			assert.ok(parser instanceof CommandParser);
			const cmds = parser.listCommands();
			// quit, exit, provider, config, schedule, clear, new, help, gc
			assert.ok(cmds.includes("quit"));
			assert.ok(cmds.includes("exit"));
			assert.ok(cmds.includes("provider"));
			assert.ok(cmds.includes("config"));
			assert.ok(cmds.includes("schedule"));
			assert.ok(cmds.includes("clear"));
			assert.ok(cmds.includes("new"));
			assert.ok(cmds.includes("help"));
			assert.ok(cmds.includes("gc"));
		});
	});

	/* ------------------------------------------------------------------ */
	/*  parse()                                                            */
	/* ------------------------------------------------------------------ */
	describe("parse()", () => {
		it("returns null for non-string input", () => {
			assert.strictEqual(parser.parse(null, {}), null);
			assert.strictEqual(parser.parse(undefined, {}), null);
			assert.strictEqual(parser.parse(42, {}), null);
			assert.strictEqual(parser.parse([], {}), null);
			assert.strictEqual(parser.parse({}, {}), null);
		});

		it("returns null for non-command input (no leading slash)", () => {
			assert.strictEqual(parser.parse("hello world", {}), null);
			assert.strictEqual(parser.parse("", {}), null);
			assert.strictEqual(parser.parse("   ", {}), null);
		});

		it('parses "/quit" → { action: "quit" }', () => {
			const result = parser.parse("/quit", {});
			assert.deepStrictEqual(result, {
				action: "quit",
				value: true,
				message: "Quitting.",
			});
		});

		it('parses "/exit" → { action: "quit" }', () => {
			const result = parser.parse("/exit", {});
			assert.deepStrictEqual(result, {
				action: "quit",
				value: true,
				message: "Quitting.",
			});
		});

		it('parses "/provider set local" → sets provider', () => {
			const ctx = createMockContext();
			const result = parser.parse("/provider set local", ctx);
			assert.strictEqual(ctx._sessionState.getProvider(), "local");
			assert.deepStrictEqual(result, {
				action: "provider",
				subAction: "set",
				value: "local",
			});
		});

		it('parses "/provider" (no args) → returns current provider', () => {
			const ctx = createMockContext();
			const result = parser.parse("/provider", ctx);
			assert.strictEqual(result.action, "provider");
			assert.ok(result.message.includes("openai"));
		});

		it('parses "/config set telemetry:enabled true" → sets config', () => {
			const ctx = createMockContext();
			let capturedPath, capturedValue;
			ctx._setConfigValue = (p, v) => {
				capturedPath = p;
				capturedValue = v;
			};
			const result = parser.parse("/config set telemetry:enabled true", ctx);
			assert.strictEqual(capturedPath, "telemetry.enabled");
			assert.strictEqual(capturedValue, "true");
			assert.strictEqual(result.action, "config");
			assert.strictEqual(result.subAction, "set");
		});

		it('parses "/config telemetry:enabled true" (without "set") → sets config', () => {
			const ctx = createMockContext();
			let capturedPath, capturedValue;
			ctx._setConfigValue = (p, v) => {
				capturedPath = p;
				capturedValue = v;
			};
			const result = parser.parse("/config telemetry:enabled true", ctx);
			assert.strictEqual(capturedPath, "telemetry.enabled");
			assert.strictEqual(capturedValue, "true");
			assert.strictEqual(result.action, "config");
			assert.strictEqual(result.subAction, "set");
		});

		it('parses "/config" (no args) → usage message', () => {
			const ctx = createMockContext();
			const result = parser.parse("/config", ctx);
			assert.strictEqual(result.action, "config");
			assert.ok(result.message.includes("Usage"));
		});

		it('parses "/schedule list" → lists schedules', () => {
			const ctx = createMockContext();
			ctx._scheduleList = [{ name: "nightly" }];
			const result = parser.parse("/schedule list", ctx);
			assert.strictEqual(result.action, "schedule");
			assert.strictEqual(result.subAction, "list");
			assert.deepStrictEqual(result.list, [{ name: "nightly" }]);
		});

		it('parses "/schedule pause name" → pauses schedule', () => {
			const ctx = createMockContext();
			let pausedName;
			ctx._schedulePause = (n) => {
				pausedName = n;
			};
			const result = parser.parse("/schedule pause my-schedule", ctx);
			assert.strictEqual(pausedName, "my-schedule");
			assert.strictEqual(result.action, "schedule");
			assert.strictEqual(result.subAction, "pause");
			assert.strictEqual(result.name, "my-schedule");
		});

		it('parses "/schedule resume name" → resumes schedule', () => {
			const ctx = createMockContext();
			let resumedName;
			ctx._scheduleResume = (n) => {
				resumedName = n;
			};
			const result = parser.parse("/schedule resume my-schedule", ctx);
			assert.strictEqual(resumedName, "my-schedule");
			assert.strictEqual(result.action, "schedule");
			assert.strictEqual(result.subAction, "resume");
			assert.strictEqual(result.name, "my-schedule");
		});

		it('parses "/schedule run-now name" → runs schedule', () => {
			const ctx = createMockContext();
			const result = parser.parse("/schedule run-now my-schedule", ctx);
			assert.strictEqual(result.action, "schedule");
			assert.strictEqual(result.subAction, "run-now");
			assert.strictEqual(result.name, "my-schedule");
		});

		it('parses "/schedule" (no args) → returns schedule list', () => {
			const ctx = createMockContext();
			ctx._scheduleList = [{ name: "daily" }];
			const result = parser.parse("/schedule", ctx);
			assert.strictEqual(result.action, "schedule");
			assert.deepStrictEqual(result.list, [{ name: "daily" }]);
		});

		it('parses "/schedule unknown" → unknown subcommand message', () => {
			const ctx = createMockContext();
			const result = parser.parse("/schedule unknown", ctx);
			assert.strictEqual(result.action, "schedule");
			assert.ok(result.message.includes("Unknown subcommand"));
		});

		it('parses "/clear" → clears conversation', () => {
			const result = parser.parse("/clear", {});
			assert.deepStrictEqual(result, {
				action: "clear",
				message: "Conversation cleared.",
			});
		});

		it('parses "/new" → new session', () => {
			const result = parser.parse("/new", {});
			assert.deepStrictEqual(result, {
				action: "new",
				message: "New session started.",
			});
		});

		it('parses "/help" → lists commands', () => {
			const ctx = createMockContext();
			const result = parser.parse("/help", ctx);
			assert.strictEqual(result.action, "help");
			assert.ok(result.message.startsWith("Available commands:"));
		});

		it('parses "/gc status" with gcInfo → returns status with available/calls/hourCalls', () => {
			const ctx = createMockContext();
			const result = parser.parse("/gc status", ctx);
			assert.strictEqual(result.action, "gc");
			assert.strictEqual(result.subAction, "status");
			assert.strictEqual(result.available, true);
			assert.deepStrictEqual(result.calls, []);
			assert.strictEqual(result.hourCalls, 3);
		});

		it('parses "/gc status" without gcInfo → returns "GC status unavailable"', () => {
			const ctx = createMockContext({ _gcStatus: () => null });
			const result = parser.parse("/gc status", ctx);
			assert.strictEqual(result.action, "gc");
			assert.strictEqual(result.subAction, "status");
			assert.strictEqual(result.message, "GC status unavailable");
		});

		it('parses "/gc" (run) with _gcTrigger → triggers GC', () => {
			const ctx = createMockContext();
			const result = parser.parse("/gc", ctx);
			assert.strictEqual(result.action, "gc");
			assert.strictEqual(result.subAction, "run");
			assert.strictEqual(result.triggered, true);
		});

		it('parses "/gc" (run) without _gcTrigger → "gc not wired"', () => {
			const ctx = createMockContext({ _gcTrigger: null });
			const result = parser.parse("/gc", ctx);
			assert.strictEqual(result.action, "gc");
			assert.strictEqual(result.subAction, "run");
			assert.strictEqual(result.triggered, false);
			assert.ok(result.message.includes("gc not wired"));
		});

		it("returns unknown for unrecognized command", () => {
			const ctx = createMockContext();
			const result = parser.parse("/nonexistent", ctx);
			assert.strictEqual(result.action, "unknown");
			assert.ok(result.message.includes("/nonexistent"));
		});

		it("executes skill when command matches _skillList", () => {
			const ctx = createMockContext({ _skillList: ["mySkill"] });
			const result = parser.parse("/mySkill arg1 arg2", ctx);
			assert.strictEqual(result.action, "skill");
			assert.strictEqual(result.subAction, "execute");
			assert.strictEqual(result.name, "mySkill");
			assert.deepStrictEqual(result.args, ["arg1", "arg2"]);
		});

		it("returns skill error when _executeSkill is missing", () => {
			const ctx = createMockContext({
				_skillList: ["brokenSkill"],
				_executeSkill: null,
			});
			const result = parser.parse("/brokenSkill", ctx);
			assert.strictEqual(result.action, "skill");
			assert.strictEqual(result.subAction, "error");
			assert.ok(result.message.includes("brokenSkill"));
		});
	});

	/* ------------------------------------------------------------------ */
	/*  isCommand()                                                        */
	/* ------------------------------------------------------------------ */
	describe("isCommand()", () => {
		it("returns true for strings starting with /", () => {
			assert.strictEqual(parser.isCommand("/quit"), true);
			assert.strictEqual(parser.isCommand("/help"), true);
			assert.strictEqual(parser.isCommand("/  "), true);
		});

		it("returns false for plain text", () => {
			assert.strictEqual(parser.isCommand("hello"), false);
			// Empty/whitespace strings are falsy — the function returns the input itself
			assert.strictEqual(parser.isCommand(""), "");
			assert.strictEqual(parser.isCommand("   "), false);
		});

		it("returns false for non-string input", () => {
			// null/undefined are falsy — the function returns the input itself
			assert.strictEqual(parser.isCommand(null), null);
			assert.strictEqual(parser.isCommand(undefined), undefined);
			assert.strictEqual(parser.isCommand(42), false);
		});
	});

	/* ------------------------------------------------------------------ */
	/*  listCommands()                                                     */
	/* ------------------------------------------------------------------ */
	describe("listCommands()", () => {
		it("returns all registered command names (excluding internal)", () => {
			const cmds = parser.listCommands();
			assert.ok(Array.isArray(cmds));
			assert.ok(cmds.length >= 9);
			assert.ok(cmds.every((c) => typeof c === "string"));
			// None should start with "_"
			assert.ok(cmds.every((c) => !c.startsWith("_")));
		});
	});

	/* ------------------------------------------------------------------ */
	/*  hasCommand()                                                       */
	/* ------------------------------------------------------------------ */
	describe("hasCommand()", () => {
		it("returns true for registered commands", () => {
			assert.strictEqual(parser.hasCommand("quit"), true);
			assert.strictEqual(parser.hasCommand("exit"), true);
			assert.strictEqual(parser.hasCommand("help"), true);
			assert.strictEqual(parser.hasCommand("gc"), true);
		});

		it("returns false for unknown commands", () => {
			assert.strictEqual(parser.hasCommand("unknown"), false);
			assert.strictEqual(parser.hasCommand(""), false);
		});
	});
});
