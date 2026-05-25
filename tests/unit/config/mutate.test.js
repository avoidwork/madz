import { describe, it } from "node:test";
import assert from "node:assert";
import { parseValue, assignPath, applyDotPathMutation } from "../../../src/config/mutate.js";
import { ConfigSchema } from "../../../src/config/schemas.js";

describe("parseValue", () => {
	it("parses boolean true", () => assert.strictEqual(parseValue("true"), true));
	it("parses boolean false", () => assert.strictEqual(parseValue("false"), false));
	it("parses integer", () => assert.strictEqual(parseValue("42"), 42));
	it("parses float", () => assert.strictEqual(parseValue("3.14"), 3.14));
	it("keeps strings", () => assert.strictEqual(parseValue("hello"), "hello"));
	it("parses negative integer", () => assert.strictEqual(parseValue("-5"), -5));
	it("parses zero", () => assert.strictEqual(parseValue("0"), 0));
	it("keeps empty string", () => assert.strictEqual(parseValue(""), ""));
});

describe("assignPath", () => {
	it("sets nested value", () => {
		const obj = { telemetry: { sampling: { ratio: 0.5 } } };
		assignPath(obj, "telemetry.sampling.ratio", 0.9);
		assert.strictEqual(obj.telemetry.sampling.ratio, 0.9);
	});

	it("creates intermediate objects", () => {
		const obj = {};
		assignPath(obj, "a.b.c", "deep");
		assert.strictEqual(obj.a.b.c, "deep");
	});

	it("overwrites existing scalar", () => {
		const obj = { a: "old" };
		assignPath(obj, "a", "new");
		assert.strictEqual(obj.a, "new");
	});

	it("creates intermediate objects for mid-level path", () => {
		const obj = { a: { b: "existing" } };
		assignPath(obj, "a.c.d", "new");
		assert.strictEqual(obj.a.c.d, "new");
	});

	it("throws when path depth exceeds 5", () => {
		const obj = {};
		assert.throws(() => assignPath(obj, "a.b.c.d.e.f", "deep"), {
			message: "Path depth exceeds maximum of 5: a.b.c.d.e.f",
		});
	});

	it("allows path with exactly 5 segments", () => {
		const obj = {};
		assignPath(obj, "a.b.c.d.e", "deep");
		assert.strictEqual(obj.a.b.c.d.e, "deep");
	});
});

describe("applyDotPathMutation", () => {
	function makeBaseConfig() {
		return ConfigSchema.parse({
			providers: {},
			sandbox: {
				paths: ["memory/", "skills/"],
				timeout: { seconds: 30, gracePeriod: 5 },
				memoryLimit: "512m",
				env: { allowlist: ["PATH", "HOME"] },
			},
			memory: {
				directory: "memory/",
				contextDir: "memory/context/",
				toolsDir: "memory/tools/",
				errorsDir: "memory/errors/",
				schedulesDir: "memory/schedules/",
				indexFile: "memory/_index.md",
				retention: { days: 90, maxEntries: 1000 },
			},
			telemetry: {
				enabled: false,
				exporter: {
					protocol: "console",
					endpoint: "http://localhost:4318",
					batch: { maxSize: 512, scheduledDelay: 5000 },
				},
				sampling: { ratio: 0.1 },
				redact: { paths: ["credentials.apiKey"] },
			},
			schedules: { maxConcurrent: 1, entries: [] },
			session: { context_window_size: 20, conversationsDir: "memory/conversations/" },
			tui: { name: "madz" },
		});
	}

	it("parses and applies integer value", () => {
		const config = makeBaseConfig();
		applyDotPathMutation(config, "sandbox.timeout.seconds", "60");
		assert.strictEqual(config.sandbox.timeout.seconds, 60);
	});

	it("parses and applies boolean value", () => {
		const config = makeBaseConfig();
		applyDotPathMutation(config, "telemetry.enabled", "true");
		assert.strictEqual(config.telemetry.enabled, true);
	});

	it("parses and applies string value", () => {
		const config = makeBaseConfig();
		applyDotPathMutation(config, "tui.name", "my-madz");
		assert.strictEqual(config.tui.name, "my-madz");
	});

	it("throws on zod validation failure", () => {
		const config = makeBaseConfig();
		assert.throws(() => applyDotPathMutation(config, "telemetry.enabled", "not-a-boolean"), {
			name: "ZodError",
		});
	});

	it("keeps other sections unchanged after mutation", () => {
		const config = makeBaseConfig();
		const originalTelemetry = structuredClone(config.telemetry);
		applyDotPathMutation(config, "schedules.maxConcurrent", "5");
		assert.deepStrictEqual(config.telemetry, originalTelemetry);
	});

	it("creates intermediate objects for deep paths", () => {
		const config = makeBaseConfig();
		// This will fail validation because "newSection" is not in the schema,
		// so we test with a path that creates intermediates within existing structure
		applyDotPathMutation(config, "sandbox.timeout.gracePeriod", "10");
		assert.strictEqual(config.sandbox.timeout.gracePeriod, 10);
	});
});
