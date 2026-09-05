import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Telemetry module tests — pure functions, no OTel SDK dependency needed
// ---------------------------------------------------------------------------

describe("telemetry — redaction.js", () => {
	it("createRedactionMiddleware returns a function", async () => {
		const { createRedactionMiddleware } = await import("../../src/telemetry/redaction.js");
		assert.equal(typeof createRedactionMiddleware, "function");
	});

	it("createRedactionMiddleware redacts dotted paths", async () => {
		const { createRedactionMiddleware } = await import("../../src/telemetry/redaction.js");
		const redact = createRedactionMiddleware(["credentials.apiKey"]);
		const result = redact({ credentials: { apiKey: "secret", user: "jason" } });
		assert.equal(result.credentials.apiKey, "[REDACTED]");
		assert.equal(result.credentials.user, "jason");
	});

	it("createRedactionMiddleware handles null/undefined attributes", async () => {
		const { createRedactionMiddleware } = await import("../../src/telemetry/redaction.js");
		const redact = createRedactionMiddleware(["key"]);
		assert.equal(redact(null), null);
		assert.equal(redact(undefined), undefined);
	});

	it("createRedactionMiddleware handles non-object attributes", async () => {
		const { createRedactionMiddleware } = await import("../../src/telemetry/redaction.js");
		const redact = createRedactionMiddleware(["key"]);
		assert.equal(redact("string"), "string");
		assert.equal(redact(42), 42);
	});

	it("createRedactionMiddleware with empty paths returns attributes unchanged", async () => {
		const { createRedactionMiddleware } = await import("../../src/telemetry/redaction.js");
		const redact = createRedactionMiddleware([]);
		const result = redact({ a: 1, b: 2 });
		assert.deepEqual(result, { a: 1, b: 2 });
	});

	it("redactAttributes redacts matching keys case-insensitively", async () => {
		const { redactAttributes } = await import("../../src/telemetry/redaction.js");
		const result = redactAttributes({ apiKey: "secret", name: "test" }, ["apikey"]);
		assert.equal(result.apiKey, "[REDACTED]");
		assert.equal(result.name, "test");
	});

	it("redactAttributes returns empty object for null input", async () => {
		const { redactAttributes } = await import("../../src/telemetry/redaction.js");
		assert.deepEqual(redactAttributes(null, ["key"]), {});
	});

	it("redactAttributes handles empty redactKeys", async () => {
		const { redactAttributes } = await import("../../src/telemetry/redaction.js");
		const result = redactAttributes({ a: 1 }, []);
		assert.deepEqual(result, { a: 1 });
	});
});

describe("telemetry — llmInstrumenter.js", () => {
	it("instrumentLlmCall returns span context with attributes", async () => {
		const { instrumentLlmCall } = await import("../../src/telemetry/llmInstrumenter.js");
		const result = await instrumentLlmCall({
			provider: "openai",
			model: "gpt-4",
			inputTokens: 100,
			outputTokens: 50,
			latencyMs: 200,
		});
		assert.ok(result.attributes);
		assert.equal(result.attributes["llm.input_tokens"], 100);
		assert.equal(result.attributes["llm.output_tokens"], 50);
		assert.equal(result.attributes["llm.total_tokens"], 150);
		assert.equal(result.attributes["llm.latency_ms"], 200);
	});

	it("instrumentLlmCall applies redact function", async () => {
		const { instrumentLlmCall } = await import("../../src/telemetry/llmInstrumenter.js");
		const redact = (attrs) => ({ ...attrs, "llm.input_tokens": 0 });
		const result = await instrumentLlmCall({
			provider: "openai",
			model: "gpt-4",
			inputTokens: 100,
			outputTokens: 50,
			latencyMs: 200,
			redact,
		});
		assert.equal(result.attributes["llm.input_tokens"], 0);
	});

	it("instrumentLlmCall handles missing tokens", async () => {
		const { instrumentLlmCall } = await import("../../src/telemetry/llmInstrumenter.js");
		const result = await instrumentLlmCall({
			provider: "openai",
			model: "gpt-4",
			latencyMs: 100,
		});
		assert.equal(result.attributes["llm.input_tokens"], 0);
		assert.equal(result.attributes["llm.output_tokens"], 0);
		assert.equal(result.attributes["llm.total_tokens"], 0);
	});
});

describe("telemetry — skillInstrumenter.js", () => {
	it("instrumentSkillExecution returns span data for success", async () => {
		const { instrumentSkillExecution } = await import("../../src/telemetry/skillInstrumenter.js");
		const result = instrumentSkillExecution({ skillName: "test-skill", durationMs: 150, exitStatus: 0 });
		assert.equal(result.name, "skill:test-skill");
		assert.equal(result.attributes["mz.skill.status"], "ok");
		assert.equal(result.attributes["mz.skill.exit_code"], 0);
		assert.equal(result.attributes["mz.skill.duration_ms"], 150);
	});

	it("instrumentSkillExecution returns span data for error", async () => {
		const { instrumentSkillExecution } = await import("../../src/telemetry/skillInstrumenter.js");
		const result = instrumentSkillExecution({ skillName: "failing-skill", durationMs: 50, exitStatus: 1 });
		assert.equal(result.attributes["mz.skill.status"], "error");
		assert.equal(result.attributes["mz.skill.exit_code"], 1);
	});
});

describe("telemetry — metrics.js", () => {
	it("createTokenCounter returns counter with record function", async () => {
		const { createTokenCounter } = await import("../../src/telemetry/metrics.js");
		const counter = createTokenCounter();
		assert.equal(counter.name, "llm.usage.tokens");
		assert.equal(counter.kind, "counter");
		assert.equal(typeof counter.record, "function");
	});

	it("createTokenCounter.record returns token counts", async () => {
		const { createTokenCounter } = await import("../../src/telemetry/metrics.js");
		const counter = createTokenCounter();
		const result = counter.record(100, 50);
		assert.equal(result.inputTokens, 100);
		assert.equal(result.outputTokens, 50);
		assert.equal(result.total, 150);
	});

	it("createTokenCounter.record handles missing values", async () => {
		const { createTokenCounter } = await import("../../src/telemetry/metrics.js");
		const counter = createTokenCounter();
		const result = counter.record();
		assert.equal(result.inputTokens, undefined);
		assert.equal(result.outputTokens, undefined);
		assert.equal(result.total, 0);
	});

	it("createDurationHistogram returns histogram with record function", async () => {
		const { createDurationHistogram } = await import("../../src/telemetry/metrics.js");
		const hist = createDurationHistogram();
		assert.equal(hist.name, "skill.execution.duration");
		assert.equal(hist.kind, "histogram");
		assert.equal(typeof hist.record, "function");
	});

	it("createDurationHistogram.record returns duration", async () => {
		const { createDurationHistogram } = await import("../../src/telemetry/metrics.js");
		const hist = createDurationHistogram();
		const result = hist.record(250);
		assert.equal(result.duration, 250);
	});
});

describe("telemetry — sampler.js", () => {
	it("createSampler clamps ratio to [0, 1]", async () => {
		const { createSampler } = await import("../../src/telemetry/sampler.js");
		assert.equal(createSampler(-0.5).ratio, 0);
		assert.equal(createSampler(1.5).ratio, 1);
		assert.equal(createSampler(0.5).ratio, 0.5);
	});

	it("createSampler.shouldSample returns boolean", async () => {
		const { createSampler } = await import("../../src/telemetry/sampler.js");
		const sampler = createSampler(1);
		assert.equal(sampler.shouldSample(), true);
		const sampler2 = createSampler(0);
		assert.equal(sampler2.shouldSample(), false);
	});

	it("loadSampler loads from config", async () => {
		const { loadSampler } = await import("../../src/telemetry/sampler.js");
		const sampler = loadSampler({ sampling: { ratio: 0.5 } });
		assert.equal(sampler.ratio, 0.5);
	});

	it("loadSampler defaults to 0.1", async () => {
		const { loadSampler } = await import("../../src/telemetry/sampler.js");
		const sampler = loadSampler({});
		assert.equal(sampler.ratio, 0.1);
	});

	it("loadSampler handles null config", async () => {
		const { loadSampler } = await import("../../src/telemetry/sampler.js");
		const sampler = loadSampler();
		assert.equal(sampler.ratio, 0.1);
	});
});

describe("telemetry — flusher.js", () => {
	it("queueSpan adds to pending queue", async () => {
		const mod = await import("../../src/telemetry/flusher.js");
		mod.clearPending();
		assert.equal(mod.getPendingCount(), 0);
		mod.queueSpan({ name: "test" });
		assert.equal(mod.getPendingCount(), 1);
		mod.clearPending();
	});

	it("flushPending returns count and clears queue", async () => {
		const mod = await import("../../src/telemetry/flusher.js");
		mod.clearPending();
		mod.queueSpan({ name: "span1" });
		mod.queueSpan({ name: "span2" });
		const count = await mod.flushPending();
		assert.equal(count, 2);
		assert.equal(mod.getPendingCount(), 0);
	});

	it("clearPending returns count of cleared spans", async () => {
		const mod = await import("../../src/telemetry/flusher.js");
		mod.clearPending();
		mod.queueSpan({ name: "test" });
		const count = mod.clearPending();
		assert.equal(count, 1);
		assert.equal(mod.getPendingCount(), 0);
	});

	it("getPendingCount returns 0 when empty", async () => {
		const mod = await import("../../src/telemetry/flusher.js");
		mod.clearPending();
		assert.equal(mod.getPendingCount(), 0);
	});
});

describe("telemetry — provider.js", () => {
	it("isTelemetryEnabled returns false when not initialized", async () => {
		const { isTelemetryEnabled } = await import("../../src/telemetry/provider.js");
		assert.equal(isTelemetryEnabled(), false);
	});

	it("isTelemetryReady returns false when not initialized", async () => {
		const { isTelemetryReady } = await import("../../src/telemetry/provider.js");
		assert.equal(isTelemetryReady(), false);
	});

	it("initTelemetry returns null when disabled", async () => {
		const { initTelemetry } = await import("../../src/telemetry/provider.js");
		const result = await initTelemetry({ enabled: false });
		assert.equal(result, null);
	});

	it("initTelemetry returns null for empty config", async () => {
		const { initTelemetry } = await import("../../src/telemetry/provider.js");
		const result = await initTelemetry({});
		assert.equal(result, null);
	});

	it("shutdownTelemetry handles null SDK gracefully", async () => {
		const { shutdownTelemetry } = await import("../../src/telemetry/provider.js");
		await shutdownTelemetry();
	});
});

describe("telemetry — index.js exports", () => {
	it("exports all expected symbols", async () => {
		const telemetry = await import("../../src/telemetry/index.js");
		assert.equal(typeof telemetry.initTelemetry, "function");
		assert.equal(typeof telemetry.getTracer, "function");
		assert.equal(typeof telemetry.shutdownTelemetry, "function");
		assert.equal(typeof telemetry.isTelemetryEnabled, "function");
		assert.equal(typeof telemetry.createRedactionMiddleware, "function");
		assert.equal(typeof telemetry.redactAttributes, "function");
		assert.equal(typeof telemetry.instrumentLlmCall, "function");
		assert.equal(typeof telemetry.instrumentSkillExecution, "function");
		assert.equal(typeof telemetry.createTokenCounter, "function");
		assert.equal(typeof telemetry.createDurationHistogram, "function");
		assert.equal(typeof telemetry.createSampler, "function");
		assert.equal(typeof telemetry.loadSampler, "function");
		assert.equal(typeof telemetry.queueSpan, "function");
		assert.equal(typeof telemetry.flushPending, "function");
		assert.equal(typeof telemetry.clearPending, "function");
		assert.equal(typeof telemetry.getPendingCount, "function");
	});
});
