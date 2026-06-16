/**
 * Tests for TUI command parser — validation, execution, unknown commands.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { CommandRegistry } from "../../../src/tui/utils/commandParser.js";

describe("CommandRegistry", () => {
	let registry;

	beforeEach(() => {
		registry = new CommandRegistry();
	});

	it("should recognize commands starting with /", () => {
		assert.strictEqual(registry.isCommand("/quit"), true);
		assert.strictEqual(registry.isCommand("/help"), true);
		assert.strictEqual(registry.isCommand("hello"), false);
		assert.strictEqual(registry.isCommand(""), false);
	});

	it("should list registered commands", () => {
		const cmds = registry.listCommands();
		assert.ok(cmds.includes("quit"));
		assert.ok(cmds.includes("clear"));
		assert.ok(cmds.includes("new"));
		assert.ok(cmds.includes("help"));
		assert.ok(cmds.includes("config"));
		assert.ok(cmds.includes("provider"));
		assert.ok(cmds.includes("schedule"));
		assert.ok(cmds.includes("gc"));
		assert.ok(cmds.includes("toggle"));
		assert.ok(cmds.includes("skills"));
		assert.ok(cmds.includes("memory"));
	});

	it("should check if a command exists", () => {
		assert.strictEqual(registry.hasCommand("quit"), true);
		assert.strictEqual(registry.hasCommand("nonexistent"), false);
	});

	it("should parse /quit command", () => {
		const result = registry.parse("/quit", {});
		assert.strictEqual(result.action, "quit");
		assert.strictEqual(result.value, true);
	});

	it("should parse /clear command", () => {
		const result = registry.parse("/clear", {});
		assert.strictEqual(result.action, "clear");
		assert.strictEqual(result.message, "Conversation cleared.");
	});

	it("should parse /new command", () => {
		const result = registry.parse("/new", {});
		assert.strictEqual(result.action, "new");
		assert.strictEqual(result.message, "New session started.");
	});

	it("should parse /help command", () => {
		const result = registry.parse("/help", {});
		assert.strictEqual(result.action, "help");
		assert.ok(result.message.includes("Available commands"));
	});

	it("should parse /config set command", () => {
		const ctx = {
			_setConfigValue: (path, value) => {
				ctx.lastPath = path;
				ctx.lastValue = value;
			},
		};
		const result = registry.parse("/config set telemetry.enabled true", ctx);
		assert.strictEqual(result.action, "config");
		assert.strictEqual(result.subAction, "set");
		assert.strictEqual(result.path, "telemetry.enabled");
	});

	it("should validate /config set requires path", () => {
		const result = registry.parse("/config", {});
		assert.strictEqual(result.action, "unknown");
		assert.ok(result.message.includes("Usage"));
	});

	it("should parse /provider set command", () => {
		const mockSessionState = {
			setProvider: (p) => { ctx.lastProvider = p; },
			getProvider: () => ctx.lastProvider || "openai",
		};
		const ctx = { _sessionState: mockSessionState };
		const result = registry.parse("/provider set anthropic", ctx);
		assert.strictEqual(result.action, "provider");
		assert.strictEqual(result.subAction, "set");
		assert.strictEqual(result.value, "anthropic");
	});

	it("should parse /schedule list command", () => {
		const ctx = { _scheduleList: [{ name: "test" }] };
		const result = registry.parse("/schedule list", ctx);
		assert.strictEqual(result.action, "schedule");
		assert.strictEqual(result.subAction, "list");
		assert.deepStrictEqual(result.list, [{ name: "test" }]);
	});

	it("should parse /schedule pause command", () => {
		let paused = null;
		const ctx = {
			_schedulePause: (name) => { paused = name; },
			_scheduleList: [],
		};
		const result = registry.parse("/schedule pause test-task", ctx);
		assert.strictEqual(result.action, "schedule");
		assert.strictEqual(result.subAction, "pause");
		assert.strictEqual(result.name, "test-task");
		assert.strictEqual(paused, "test-task");
	});

	it("should parse /gc command", () => {
		let triggered = false;
		const ctx = { _gcTrigger: () => { triggered = true; return { triggered: true, hourCalls: 5 }; } };
		const result = registry.parse("/gc", ctx);
		assert.strictEqual(result.action, "gc");
		assert.strictEqual(result.subAction, "run");
		assert.strictEqual(triggered, true);
	});

	it("should parse /gc status command", () => {
		const ctx = {
			_gcStatus: () => ({ available: true, calls: [], hourCalls: 3 }),
		};
		const result = registry.parse("/gc status", ctx);
		assert.strictEqual(result.action, "gc");
		assert.strictEqual(result.subAction, "status");
		assert.strictEqual(result.available, true);
	});

	it("should parse /toggle with no args (show all)", () => {
		const ctx = { _toggles: { autoScroll: true, timestamps: false } };
		const result = registry.parse("/toggle", ctx);
		assert.strictEqual(result.action, "toggle");
		assert.ok(result.message.includes("Runtime Toggles"));
	});

	it("should parse /toggle with key (toggle setting)", () => {
		const ctx = { _toggles: { autoScroll: true, timestamps: true } };
		const result = registry.parse("/toggle autoScroll", ctx);
		assert.strictEqual(result.action, "toggle");
		assert.strictEqual(result.subAction, "set");
		assert.strictEqual(result.key, "autoScroll");
		assert.strictEqual(result.value, false);
		assert.strictEqual(ctx._toggles.autoScroll, false);
	});

	it("should reject unknown toggle key", () => {
		const result = registry.parse("/toggle nonexistent", {});
		assert.strictEqual(result.action, "unknown");
		assert.ok(result.message.includes("Unknown toggle"));
	});

	it("should parse /skills command", () => {
		const ctx = { _skillList: ["git-tag", "commit-push"] };
		const result = registry.parse("/skills", ctx);
		assert.strictEqual(result.action, "skills");
		assert.ok(result.message.includes("git-tag"));
	});

	it("should parse /memory command", () => {
		const result = registry.parse("/memory", {});
		assert.strictEqual(result.action, "memory");
	});

	it("should return unknown for unrecognized commands", () => {
		const result = registry.parse("/foobar", {});
		assert.strictEqual(result.action, "unknown");
		assert.ok(result.message.includes("Unknown command"));
	});

	it("should return null for non-command input", () => {
		assert.strictEqual(registry.parse("hello world", {}), null);
		assert.strictEqual(registry.parse("", {}), null);
		assert.strictEqual(registry.parse(null, {}), null);
	});

	it("should handle skill fallback when command matches skill name", () => {
		const ctx = {
			_skillList: ["git-tag", "commit-push"],
			_executeSkill: (name, args) => ({ action: "skill", subAction: "load", name, skillBody: "body" }),
		};
		const result = registry.parse("/git-tag", ctx);
		assert.strictEqual(result.action, "skill");
		assert.strictEqual(result.subAction, "load");
		assert.strictEqual(result.name, "git-tag");
	});

	it("should handle schedule subcommand validation", () => {
		const result = registry.parse("/schedule pause", {});
		assert.strictEqual(result.action, "unknown");
		assert.ok(result.message.includes("Usage"));
	});

	it("should handle schedule unknown subcommand", () => {
		const result = registry.parse("/schedule foobar", {});
		assert.strictEqual(result.action, "unknown");
		assert.ok(result.message.includes("Unknown subcommand"));
	});
});
