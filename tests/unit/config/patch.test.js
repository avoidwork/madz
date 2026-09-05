/**
 * Unit tests for config patching utilities.
 * @module tests/unit/config/patch.test
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { parseValue, assignPath, applyDotPathMutation } from "../../../src/config/patch.js";
import { ConfigSchema } from "../../../src/config/config.js";

/**
 * Create a minimal valid config for testing mutations.
 * Provides all required nested fields that ConfigSchema expects.
 */
function makeValidConfig() {
	return ConfigSchema.parse({
		telemetry: { enabled: false, sampling: { ratio: 0.1 }, redact: { paths: [] } },
		lru: { size: 100, ttl: 600000 },
		cwd: "/tmp",
		email: { provider: { type: "imap", user: "test", password: "test" } },
		sandbox: { timeout: { default: 30000 }, safety: { maxMemory: 100 }, env: {} },
		skillAgentMap: [],
	});
}

describe("parseValue", () => {
	it('parses "true" as boolean true', () => {
		assert.strictEqual(parseValue("true"), true);
	});

	it('parses "false" as boolean false', () => {
		assert.strictEqual(parseValue("false"), false);
	});

	it("parses integer strings as numbers", () => {
		assert.strictEqual(parseValue("42"), 42);
	});

	it("parses negative integer strings as numbers", () => {
		assert.strictEqual(parseValue("-42"), -42);
	});

	it("parses float strings as numbers", () => {
		assert.strictEqual(parseValue("3.14"), 3.14);
	});

	it("parses negative float strings as numbers", () => {
		assert.strictEqual(parseValue("-3.14"), -3.14);
	});

	it('parses "0" as number 0', () => {
		assert.strictEqual(parseValue("0"), 0);
	});

	it("parses non-numeric strings as strings", () => {
		assert.strictEqual(parseValue("hello"), "hello");
	});

	it("parses empty string as string", () => {
		assert.strictEqual(parseValue(""), "");
	});

	it("parses string with leading zeros as number (regex matches)", () => {
		assert.strictEqual(parseValue("0123"), 123);
	});

	it("parses string with spaces as string", () => {
		assert.strictEqual(parseValue("hello world"), "hello world");
	});

	it("parses string with special characters as string", () => {
		assert.strictEqual(parseValue("hello@world!"), "hello@world!");
	});

	it("parses string that looks like number but has trailing chars as string", () => {
		assert.strictEqual(parseValue("42abc"), "42abc");
	});

	it("parses string with leading plus sign as string (regex requires - or digit)", () => {
		assert.strictEqual(parseValue("+42"), "+42");
	});

	it("parses decimal starting with dot as string (regex requires leading digit or minus)", () => {
		assert.strictEqual(parseValue(".5"), ".5");
	});

	it("parses 'True' (capital T) as string (case-sensitive)", () => {
		assert.strictEqual(parseValue("True"), "True");
	});

	it("parses 'FALSE' (all caps) as string (case-sensitive)", () => {
		assert.strictEqual(parseValue("FALSE"), "FALSE");
	});
});

describe("assignPath", () => {
	it("assigns a value at a simple path", () => {
		const obj = {};
		assignPath(obj, "a", "value");
		assert.strictEqual(obj.a, "value");
	});

	it("assigns a value at a nested path", () => {
		const obj = {};
		assignPath(obj, "a.b", "value");
		assert.strictEqual(obj.a.b, "value");
	});

	it("creates intermediate objects for nested paths", () => {
		const obj = {};
		assignPath(obj, "a.b.c", "deep");
		assert.strictEqual(obj.a.b.c, "deep");
	});

	it("overwrites existing values", () => {
		const obj = { a: "old" };
		assignPath(obj, "a", "new");
		assert.strictEqual(obj.a, "new");
	});

	it("overwrites nested existing values", () => {
		const obj = { a: { b: "old" } };
		assignPath(obj, "a.b", "new");
		assert.strictEqual(obj.a.b, "new");
	});

	it("throws error for path exceeding max depth", () => {
		const obj = {};
		assert.throws(
			() => assignPath(obj, "a.b.c.d.e.f", "too-deep"),
			/Path depth exceeds maximum of 5/,
		);
	});

	it("handles single key path", () => {
		const obj = {};
		assignPath(obj, "x", 1);
		assert.strictEqual(obj.x, 1);
	});

	it("preserves existing nested objects", () => {
		const obj = { a: { b: "existing", c: "keep" } };
		assignPath(obj, "a.b", "updated");
		assert.strictEqual(obj.a.b, "updated");
		assert.strictEqual(obj.a.c, "keep");
	});

	it("handles path with null intermediate value", () => {
		const obj = { a: null };
		assignPath(obj, "a.b", "value");
		assert.strictEqual(obj.a.b, "value");
	});

	it("handles path with undefined intermediate value", () => {
		const obj = { a: undefined };
		assignPath(obj, "a.b", "value");
		assert.strictEqual(obj.a.b, "value");
	});

	it("assigns number value", () => {
		const obj = {};
		assignPath(obj, "count", 42);
		assert.strictEqual(obj.count, 42);
	});

	it("assigns boolean value", () => {
		const obj = {};
		assignPath(obj, "flag", true);
		assert.strictEqual(obj.flag, true);
	});

	it("assigns object value", () => {
		const obj = {};
		assignPath(obj, "nested", { x: 1 });
		assert.deepStrictEqual(obj.nested, { x: 1 });
	});

	it("assigns null value", () => {
		const obj = {};
		assignPath(obj, "nullable", null);
		assert.strictEqual(obj.nullable, null);
	});

	it("assigns array value", () => {
		const obj = {};
		assignPath(obj, "items", [1, 2, 3]);
		assert.deepStrictEqual(obj.items, [1, 2, 3]);
	});

	it("handles path at exact max depth (5)", () => {
		const obj = {};
		assignPath(obj, "a.b.c.d.e", "at-limit");
		assert.strictEqual(obj.a.b.c.d.e, "at-limit");
	});

	it("handles empty path by setting on root", () => {
		const obj = {};
		assignPath(obj, "", "root-value");
		assert.strictEqual(obj[""], "root-value");
	});
});

describe("applyDotPathMutation", () => {
	it("applies a boolean mutation", () => {
		const config = makeValidConfig();
		config.telemetry.enabled = false;
		applyDotPathMutation(config, "telemetry.enabled", "true");
		assert.strictEqual(config.telemetry.enabled, true);
	});

	it("applies a numeric mutation", () => {
		const config = makeValidConfig();
		config.lru.size = 100;
		applyDotPathMutation(config, "lru.size", "500");
		assert.strictEqual(config.lru.size, 500);
	});

	it("applies a string mutation", () => {
		const config = makeValidConfig();
		config.cwd = "/old/path";
		applyDotPathMutation(config, "cwd", "/new/path");
		assert.strictEqual(config.cwd, "/new/path");
	});

	it("creates intermediate objects when applying mutation", () => {
		const config = makeValidConfig();
		applyDotPathMutation(config, "sandbox.timeout.default", "60000");
		assert.strictEqual(config.sandbox.timeout.default, 60000);
	});

	it("throws error for invalid path (exceeds max depth)", () => {
		const config = makeValidConfig();
		assert.throws(
			() => applyDotPathMutation(config, "a.b.c.d.e.f", "value"),
			/Path depth exceeds maximum of 5/,
		);
	});

	it("throws error when zod validation fails", () => {
		const config = makeValidConfig();
		config.telemetry.enabled = false;
		assert.throws(() => applyDotPathMutation(config, "telemetry.enabled", "not-a-boolean"));
	});

	it("mutates the original config object in place", () => {
		const config = makeValidConfig();
		config.telemetry.enabled = false;
		const originalRef = config;
		applyDotPathMutation(config, "telemetry.enabled", "true");
		assert.strictEqual(config, originalRef);
		assert.strictEqual(config.telemetry.enabled, true);
	});

	it("handles deeply nested paths within depth limit", () => {
		const config = makeValidConfig();
		applyDotPathMutation(config, "sandbox.timeout.default", "60000");
		assert.strictEqual(config.sandbox.timeout.default, 60000);
	});

	it("applies mutation to email provider type", () => {
		const config = makeValidConfig();
		applyDotPathMutation(config, "email.provider.type", "gmail");
		assert.strictEqual(config.email.provider.type, "gmail");
	});

	it("applies mutation to telemetry sampling ratio", () => {
		const config = makeValidConfig();
		applyDotPathMutation(config, "telemetry.sampling.ratio", "0.5");
		assert.strictEqual(config.telemetry.sampling.ratio, 0.5);
	});

	it("applies mutation to sandbox max memory", () => {
		const config = makeValidConfig();
		applyDotPathMutation(config, "sandbox.safety.maxMemory", "200");
		assert.strictEqual(config.sandbox.safety.maxMemory, 200);
	});

	it("does not mutate config when zod validation fails", () => {
		const config = makeValidConfig();
		const originalEnabled = config.telemetry.enabled;
		assert.throws(() => applyDotPathMutation(config, "telemetry.enabled", "not-a-boolean"));
		assert.strictEqual(config.telemetry.enabled, originalEnabled);
	});

	it("applies false boolean mutation", () => {
		const config = makeValidConfig();
		config.telemetry.enabled = true;
		applyDotPathMutation(config, "telemetry.enabled", "false");
		assert.strictEqual(config.telemetry.enabled, false);
	});

	it("applies zero numeric mutation", () => {
		const config = makeValidConfig();
		config.telemetry.sampling.ratio = 0.5;
		applyDotPathMutation(config, "telemetry.sampling.ratio", "0");
		assert.strictEqual(config.telemetry.sampling.ratio, 0);
	});

	it("applies negative numeric mutation (rejected by schema)", () => {
		const config = makeValidConfig();
		config.telemetry.sampling.ratio = 0.5;
		// telemetry.sampling.ratio must be between 0 and 1, so -1 should fail
		assert.throws(
			() => applyDotPathMutation(config, "telemetry.sampling.ratio", "-1"),
			/Too small/,
		);
	});
});
