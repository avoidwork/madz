import { describe, it } from "node:test";
import assert from "node:assert";

describe("telemetry - redaction", () => {
  const REDACTED = "[REDACTED]";

  function redactNested(obj, keys, index) {
    if (!obj || index >= keys.length) return;
    const key = keys[index];
    if (index === keys.length - 1) {
      obj[key] = REDACTED;
    } else {
      if (obj[key] && typeof obj[key] === "object") {
        redactNested(obj[key], keys, index + 1);
      }
    }
  }

  function createRedactionMiddleware(redactPaths = []) {
    return function redact(attrs) {
      if (!attrs || typeof attrs !== "object") return attrs;
      const result = { ...attrs };
      for (const path of redactPaths) {
        const keys = path.split(".");
        redactNested(result, keys, 0);
      }
      return result;
    };
  }

  function redactAttributes(attrs, redactKeys = []) {
    if (!attrs) return {};
    const result = { ...attrs };
    for (const key of Object.keys(result)) {
      if (redactKeys.some((rk) => key.toLowerCase().includes(rk.toLowerCase()))) {
        result[key] = REDACTED;
      }
    }
    return result;
  }

  describe("createRedactionMiddleware", () => {
    it("redacts matching nested paths", () => {
      const redact = createRedactionMiddleware(["credentials.apiKey"]);
      const attrs = { credentials: { apiKey: "secret-123", other: "info" } };
      const result = redact(attrs);
      assert.strictEqual(result.credentials.apiKey, "[REDACTED]");
      assert.strictEqual(result.credentials.other, "info");
    });

    it("handles multiple redaction paths", () => {
      const redact = createRedactionMiddleware(["foo.bar", "baz"]);
      const attrs = { foo: { bar: "secret", other: "keep" }, baz: "hidden" };
      const result = redact(attrs);
      assert.strictEqual(result.foo.bar, "[REDACTED]");
      assert.strictEqual(result.baz, "[REDACTED]");
      assert.strictEqual(result.foo.other, "keep");
    });

    it("handles null intermediate values", () => {
      const redact = createRedactionMiddleware(["a.b.c"]);
      const attrs = { a: { b: null } };
      const result = redact(attrs);
      assert.deepStrictEqual(result, { a: { b: null } });
    });

    it("handles empty attribute object", () => {
      const redact = createRedactionMiddleware(["a.b"]);
      const result = redact({});
      assert.deepStrictEqual(result, {});
    });
  });

  describe("redactAttributes", () => {
    it("redacts shallow attributes by key pattern", () => {
      const result = redactAttributes(
        { apiKey: "secret", model: "gpt-4", authorization: "Bearer token" },
        ["apiKey", "authorization"]
      );
      assert.strictEqual(result.apiKey, "[REDACTED]");
      assert.strictEqual(result.model, "gpt-4");
      assert.strictEqual(result.authorization, "[REDACTED]");
    });

    it("handles null input", () => {
      assert.deepStrictEqual(redactAttributes(null, []), {});
    });

    it("handles empty redact keys", () => {
      const result = redactAttributes({ apiKey: "secret" }, []);
      assert.strictEqual(result.apiKey, "secret");
    });
  });
});

describe("telemetry - skill instrumentation", () => {
  function instrumentSkillExecution({ skillName, durationMs, exitStatus }) {
    const status = exitStatus === 0 ? "ok" : "error";
    return {
      spanKind: "internal",
      name: `skill:${skillName}`,
      attributes: {
        "mz.skill.name": skillName,
        "mz.skill.duration_ms": durationMs,
        "mz.skill.status": status,
        "mz.skill.exit_code": exitStatus,
      },
    };
  }

  it("creates span data with ok status on success", () => {
    const result = instrumentSkillExecution({
      skillName: "host-info",
      durationMs: 150,
      exitStatus: 0,
    });
    assert.strictEqual(result.attributes["mz.skill.status"], "ok");
    assert.strictEqual(result.attributes["mz.skill.name"], "host-info");
    assert.strictEqual(result.attributes["mz.skill.duration_ms"], 150);
  });

  it("creates span data with error status on failure", () => {
    const result = instrumentSkillExecution({
      skillName: "api-request",
      durationMs: 3000,
      exitStatus: 1,
    });
    assert.strictEqual(result.attributes["mz.skill.status"], "error");
    assert.strictEqual(result.attributes["mz.skill.exit_code"], 1);
  });
});

describe("telemetry - sampler", () => {
  function createSampler(ratio = 0.1) {
    const prob = Math.max(0, Math.min(1, ratio));
    return {
      ratio: prob,
      shouldSample: function () {
        return Math.random() < prob;
      },
    };
  }

  function loadSampler(config = {}) {
    const ratio = (config.sampling && config.sampling.ratio) || 0.1;
    return createSampler(ratio);
  }

  describe("createSampler", () => {
    it("always samples false at ratio 0", () => {
      const sampler = createSampler(0);
      assert.strictEqual(sampler.ratio, 0);
      for (let i = 0; i < 10; i++) {
        assert.strictEqual(sampler.shouldSample(), false);
      }
    });

    it("always samples true at ratio 1", () => {
      const sampler = createSampler(1.0);
      assert.strictEqual(sampler.ratio, 1.0);
      for (let i = 0; i < 10; i++) {
        assert.strictEqual(sampler.shouldSample(), true);
      }
    });

    it("clamps negative ratio to 0", () => {
      const sampler = createSampler(-0.5);
      assert.strictEqual(sampler.ratio, 0);
    });

    it("clamps ratio over 1 to 1", () => {
      const sampler = createSampler(1.5);
      assert.strictEqual(sampler.ratio, 1);
    });
  });

  describe("loadSampler", () => {
    it("defaults to 0.1 ratio", () => {
      const sampler = loadSampler({});
      assert.strictEqual(sampler.ratio, 0.1);
    });

    it("uses config ratio", () => {
      const sampler = loadSampler({ sampling: { ratio: 0.5 } });
      assert.strictEqual(sampler.ratio, 0.5);
    });
  });
});

describe("telemetry - metrics", () => {
  function createTokenCounter() {
    return {
      name: "llm.usage.tokens",
      kind: "counter",
      record: function (inputTokens, outputTokens) {
        return {
          inputTokens,
          outputTokens,
          total: (inputTokens || 0) + (outputTokens || 0),
        };
      },
    };
  }

  function createDurationHistogram() {
    return {
      name: "skill.execution.duration",
      kind: "histogram",
      record: function (durationMs) {
        return {
          duration: durationMs,
        };
      },
    };
  }

  describe("createTokenCounter", () => {
    it("counts input and output tokens", () => {
      const counter = createTokenCounter();
      const result = counter.record(100, 50);
      assert.strictEqual(result.inputTokens, 100);
      assert.strictEqual(result.outputTokens, 50);
      assert.strictEqual(result.total, 150);
    });
  });

  describe("createDurationHistogram", () => {
    it("records duration", () => {
      const histogram = createDurationHistogram();
      const result = histogram.record(500);
      assert.strictEqual(result.duration, 500);
    });
  });
});

describe("telemetry - flusher", () => {
  let pendingSpans = [];

  function queueSpan(span) { pendingSpans.push(span); }
  function flushPending() { const count = pendingSpans.length; pendingSpans = []; return count; }
  function clearPending() { const count = pendingSpans.length; pendingSpans = []; return count; }
  function getPendingCount() { return pendingSpans.length; }

  it("queues and flushes spans", () => {
    queueSpan({ name: "span-1" });
    queueSpan({ name: "span-2" });
    assert.strictEqual(getPendingCount(), 2);
    const flushed = flushPending();
    assert.strictEqual(flushed, 2);
    assert.strictEqual(getPendingCount(), 0);
  });

  it("clears pending spans", () => {
    queueSpan({ name: "span-3" });
    const cleared = clearPending();
    assert.strictEqual(cleared, 1);
    assert.strictEqual(getPendingCount(), 0);
  });

  it("flushes empty queue returns 0", () => {
    const flushed = flushPending();
    assert.strictEqual(flushed, 0);
  });
});
