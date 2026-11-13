import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROOT_CONTEXT } from "@opentelemetry/api";

// ---------------------------------------------------------------------------
// Telemetry module tests — pure functions, no OTel SDK dependency needed
// ---------------------------------------------------------------------------

describe("telemetry — llmInstrumenter.js", () => {
	it("instrumentLlmCall returns span context with attributes", async () => {
		const { instrumentLlmCall } = await import("../../src/telemetry/llmInstrumenter.js");
		const result = instrumentLlmCall({
			provider: "openai",
			model: "gpt-4",
			inputTokens: 100,
			outputTokens: 50,
			latencyMs: 200,
		});
		assert.ok(result.attributes);
		assert.equal(result.attributes["gen_ai.usage.input_tokens"], 100);
		assert.equal(result.attributes["gen_ai.usage.output_tokens"], 50);
		assert.equal(result.attributes["llm.total_tokens"], 150);
		assert.equal(result.attributes["llm.latency_ms"], 200);
	});

	it("instrumentLlmCall applies redact function", async () => {
		const { instrumentLlmCall } = await import("../../src/telemetry/llmInstrumenter.js");
		const redact = (attrs) => ({ ...attrs, "gen_ai.usage.input_tokens": 0 });
		const result = instrumentLlmCall({
			provider: "openai",
			model: "gpt-4",
			inputTokens: 100,
			outputTokens: 50,
			latencyMs: 200,
			redact,
		});
		assert.equal(result.attributes["gen_ai.usage.input_tokens"], 0);
	});

	it("instrumentLlmCall redacts PII by default and ends a span", async () => {
		const { instrumentLlmCall } = await import("../../src/telemetry/llmInstrumenter.js");
		const ended = [];
		const tracer = {
			startSpan: (name) => ({ end: () => ended.push(name) }),
		};
		const result = instrumentLlmCall({ provider: "a@b.com", model: "m", latencyMs: 1, tracer });
		assert.deepEqual(ended, ["llm.call"]);
		assert.ok(Object.values(result.attributes).some((v) => /REDACTED/.test(String(v))));
		assert.equal(Object.keys(result.attributes).length, 6);
	});

	it("instrumentLlmCall handles missing tokens", async () => {
		const { instrumentLlmCall } = await import("../../src/telemetry/llmInstrumenter.js");
		const result = instrumentLlmCall({
			provider: "openai",
			model: "gpt-4",
			latencyMs: 100,
		});
		assert.equal(result.attributes["gen_ai.usage.input_tokens"], 0);
		assert.equal(result.attributes["gen_ai.usage.output_tokens"], 0);
		assert.equal(result.attributes["llm.total_tokens"], 0);
	});
});

describe("telemetry — skillInstrumenter.js", () => {
	it("instrumentSkillExecution returns span data for success", async () => {
		const { instrumentSkillExecution } = await import("../../src/telemetry/skillInstrumenter.js");
		const result = instrumentSkillExecution({
			skillName: "test-skill",
			durationMs: 150,
			exitStatus: 0,
		});
		assert.equal(result.name, "skill:test-skill");
		assert.equal(result.attributes["mz.skill.status"], "ok");
		assert.equal(result.attributes["mz.skill.exit_code"], 0);
		assert.equal(result.attributes["mz.skill.duration_ms"], 150);
	});

	it("instrumentSkillExecution returns span data for error", async () => {
		const { instrumentSkillExecution } = await import("../../src/telemetry/skillInstrumenter.js");
		const result = instrumentSkillExecution({
			skillName: "failing-skill",
			durationMs: 50,
			exitStatus: 1,
		});
		assert.equal(result.attributes["mz.skill.status"], "error");
		assert.equal(result.attributes["mz.skill.exit_code"], 1);
	});
});

describe("telemetry — skillInstrumenter spans", () => {
	it("creates a child span, sets status and treats missing exit as error", async () => {
		const { instrumentSkillExecution } = await import("../../src/telemetry/skillInstrumenter.js");
		const calls = [];
		const tracer = {
			startSpan: () => ({
				setStatus: (st) => calls.push(["status", st.code]),
				end: () => calls.push(["end"]),
			}),
		};
		const parentSpan = {
			spanContext: () => ({ traceId: "a".repeat(32), spanId: "b".repeat(16), traceFlags: 1 }),
		};
		const result = instrumentSkillExecution({ skillName: "s", durationMs: 1, tracer, parentSpan });
		assert.equal(result.attributes["mz.skill.status"], "error");
		assert.deepEqual(calls, [["status", 2], ["end"]]);
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
	it("resolveSamplingRatio clamps, defaults and honours 0", async () => {
		const { resolveSamplingRatio } = await import("../../src/telemetry/sampler.js");
		assert.equal(resolveSamplingRatio({ sampling: { ratio: -0.5 } }), 0);
		assert.equal(resolveSamplingRatio({ sampling: { ratio: 1.5 } }), 1);
		assert.equal(resolveSamplingRatio({ sampling: { ratio: 0 } }), 0);
		assert.equal(resolveSamplingRatio({}), 0.1);
		assert.equal(resolveSamplingRatio(), 0.1);
	});

	it("createSampler returns an OTel sampler honouring the ratio", async () => {
		const { createSampler } = await import("../../src/telemetry/sampler.js");
		const { SamplingDecision } = await import("@opentelemetry/sdk-trace");
		const traceId = "0123456789abcdef0123456789abcdef";
		const decide = (ratio) =>
			createSampler(ratio).shouldSample(ROOT_CONTEXT, traceId, "s", 0, {}, []).decision;
		assert.equal(decide(1), SamplingDecision.RECORD_AND_SAMPLED);
		assert.equal(decide(0), SamplingDecision.NOT_RECORD);
		assert.ok(createSampler());
	});

	it("loadSampler loads from config and tolerates missing config", async () => {
		const { loadSampler } = await import("../../src/telemetry/sampler.js");
		assert.ok(loadSampler({ sampling: { ratio: 0.5 } }));
		assert.ok(loadSampler());
	});
});

describe("telemetry — redaction.js", () => {
	it("redacts PII and applies the extra redactor", async () => {
		const { redactAttributes } = await import("../../src/telemetry/redaction.js");
		const out = redactAttributes({ who: "bob@example.com" });
		assert.match(out.who, /REDACTED/);
		const extra = redactAttributes({ a: 1 }, (x) => ({ ...x, b: 2 }));
		assert.deepEqual(extra, { a: 1, b: 2 });
	});
});

describe("telemetry — logSpanExporter.js", () => {
	it("exports spans to the logger and reports success", async () => {
		const { LogSpanExporter } = await import("../../src/telemetry/logSpanExporter.js");
		const exporter = new LogSpanExporter();
		const span = {
			name: "x",
			duration: [0, 5e6],
			attributes: { k: "v" },
			spanContext: () => ({ traceId: "t" }),
		};
		let result;
		exporter.export([span], (r) => (result = r));
		assert.equal(result.code, 0);
		await exporter.forceFlush();
		await exporter.shutdown();
	});
});

describe("telemetry — provider.js", () => {
	it("isTelemetryEnabled returns false when not initialized", async () => {
		const { isTelemetryEnabled } = await import("../../src/telemetry/provider.js");
		assert.equal(isTelemetryEnabled(), false);
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

	it("initTelemetry is idempotent and shuts down", async () => {
		const { initTelemetry, shutdownTelemetry, isTelemetryEnabled } =
			await import("../../src/telemetry/provider.js");
		const cfg = { enabled: true, exporter: { protocol: "console" }, sampling: { ratio: 0 } };
		const first = await initTelemetry(cfg);
		assert.ok(first);
		assert.equal(await initTelemetry(cfg), first);
		assert.equal(isTelemetryEnabled(), true);
		await shutdownTelemetry();
		assert.equal(isTelemetryEnabled(), false);
	});

	it("initTelemetry rejects invalid config and disallowed schemes", async () => {
		const { initTelemetry } = await import("../../src/telemetry/provider.js");
		await assert.rejects(initTelemetry({ enabled: true, sampling: { ratio: 5 } }));
		await assert.rejects(
			initTelemetry({
				enabled: true,
				exporter: { protocol: "http", endpoint: "file:///etc/passwd" },
			}),
		);
	});

	it("getTracer returns a tracer synchronously", async () => {
		const { getTracer } = await import("../../src/telemetry/provider.js");
		assert.equal(typeof getTracer().startSpan, "function");
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
		assert.equal(typeof telemetry.instrumentLlmCall, "function");
		assert.equal(typeof telemetry.instrumentSkillExecution, "function");
		assert.equal(typeof telemetry.createTokenCounter, "function");
		assert.equal(typeof telemetry.createDurationHistogram, "function");
		assert.equal(typeof telemetry.createSampler, "function");
		assert.equal(typeof telemetry.loadSampler, "function");
		assert.equal(typeof telemetry.redactAttributes, "function");
	});
});
