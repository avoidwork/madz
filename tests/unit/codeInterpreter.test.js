// tests/unit/codeInterpreter.test.js — Unit tests for CodeInterpreterMiddleware.

import { describe, it } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(__dirname, "../../memory/__code_interpreter_test__");

/**
 * Run a subprocess test script. Each test gets a unique sub-directory.
 * Tests should run sequentially to avoid directory conflicts.
 * @param {string} testId - Unique test identifier used as sub-directory name
 * @param {string} script - Node.js code to execute (uses --input-type=module)
 * @param {Object} [opts] - Spawn options (env, etc.)
 * @returns {Promise<{stdout: string, stderr: string, code: number, parsed: object|null}>}
 */
async function runTestScript(testId, script, opts = {}) {
	try {
		rmSync(TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
	mkdirSync(TEST_DIR, { recursive: true });

	const testLogDir = join(TEST_DIR, testId);

	const fullScript = `
    import { mkdirSync, existsSync, rmSync } from 'fs';

    const testLogDir = "${testLogDir}";

    try { rmSync(testLogDir, { recursive: true, force: true }); } catch {}
    mkdirSync(testLogDir, { recursive: true });

    const result = {
      testLogDir,
      exists: existsSync(testLogDir)
    };

    ${script}

    try { rmSync(testLogDir, { recursive: true, force: true }); } catch {}
    console.log(JSON.stringify(result));
  `;

	return new Promise((resolve) => {
		const sub = spawn(process.execPath, ["--input-type=module", "--eval", fullScript], {
			cwd: join(__dirname, "../../"),
			env: opts.env || process.env,
		});
		let stdout = "";
		let stderr = "";
		sub.stdout.on("data", (d) => (stdout += d.toString()));
		sub.stderr.on("data", (d) => (stderr += d.toString()));
		sub.on("close", (code) => {
			const lastLine = stdout.trim().split("\n").pop();
			let parsed = null;
			try {
				parsed = JSON.parse(lastLine);
			} catch {
				// JSON parse failed
			}
			resolve({
				stdout: stdout.trim(),
				stderr: stderr.trim(),
				code,
				parsed,
			});
		});
	});
}

describe("codeInterpreter - schema", () => {
	it("exports CodeInterpreterSchema", async () => {
		const result = await runTestScript(
			"schema-export",
			`
      import { CodeInterpreterSchema } from './src/config/schemas/codeInterpreter.js';
      result.hasSchema = !!CodeInterpreterSchema;
      result.schemaType = typeof CodeInterpreterSchema;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasSchema, true);
		assert.strictEqual(result.parsed?.schemaType, "object");
	});

	it("validates correct config", async () => {
		const result = await runTestScript(
			"schema-valid",
			`
      import { CodeInterpreterSchema } from './src/config/schemas/codeInterpreter.js';
      try {
        const parsed = CodeInterpreterSchema.parse({
          enabled: true,
          mode: "thread",
          memoryLimit: 536870912,
          timeoutMs: 30000,
          maxResultChars: 50000,
          captureConsole: false,
          toolName: "eval",
        });
        result.valid = true;
        result.mode = parsed.mode;
        result.toolName = parsed.toolName;
      } catch (err) {
        result.valid = false;
        result.error = err.message;
      }
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.valid, true);
		assert.strictEqual(result.parsed?.mode, "thread");
	});

	it("rejects invalid mode", async () => {
		const result = await runTestScript(
			"schema-invalid-mode",
			`
      import { CodeInterpreterSchema } from './src/config/schemas/codeInterpreter.js';
      try {
        CodeInterpreterSchema.parse({ mode: "invalid" });
        result.valid = true;
      } catch (err) {
        result.valid = false;
        result.error = err.issues?.[0]?.message || err.message;
      }
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.valid, false);
	});

	it("uses defaults when empty object passed", async () => {
		const result = await runTestScript(
			"schema-defaults",
			`
      import { CodeInterpreterSchema } from './src/config/schemas/codeInterpreter.js';
      const parsed = CodeInterpreterSchema.parse({});
      result.enabled = parsed.enabled;
      result.mode = parsed.mode;
      result.memoryLimit = parsed.memoryLimit;
      result.timeoutMs = parsed.timeoutMs;
      result.maxResultChars = parsed.maxResultChars;
      result.captureConsole = parsed.captureConsole;
      result.toolName = parsed.toolName;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.enabled, false);
		assert.strictEqual(result.parsed?.mode, "thread");
		assert.strictEqual(result.parsed?.memoryLimit, 536870912);
		assert.strictEqual(result.parsed?.timeoutMs, 30000);
		assert.strictEqual(result.parsed?.maxResultChars, 50000);
		assert.strictEqual(result.parsed?.captureConsole, false);
		assert.strictEqual(result.parsed?.toolName, "eval");
	});
});

describe("codeInterpreter - middleware", () => {
	it("exports createCodeInterpreterMiddleware", async () => {
		const result = await runTestScript(
			"middleware-export",
			`
      import { createCodeInterpreterMiddleware } from './src/agent/codeInterpreter.js';
      result.hasMiddleware = typeof createCodeInterpreterMiddleware === 'function';
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasMiddleware, true);
	});

	it("creates middleware with evalTool when enabled", async () => {
		const result = await runTestScript(
			"middleware-enabled",
			`
      import { createCodeInterpreterMiddleware } from './src/agent/codeInterpreter.js';
      const mw = createCodeInterpreterMiddleware({
        enabled: true,
        mode: "call",
      });
      result.hasEvalTool = !!mw.evalTool;
      result.hasWrapModelCall = typeof mw.wrapModelCall === 'function';
      result.toolName = mw.evalTool?.name;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasEvalTool, true);
		assert.strictEqual(result.parsed?.hasWrapModelCall, true);
		assert.strictEqual(result.parsed?.toolName, "eval");
	});

	it("creates middleware with custom tool name", async () => {
		const result = await runTestScript(
			"middleware-custom-name",
			`
      import { createCodeInterpreterMiddleware } from './src/agent/codeInterpreter.js';
      const mw = createCodeInterpreterMiddleware({
        enabled: true,
        mode: "call",
        toolName: "runCode",
      });
      result.toolName = mw.evalTool?.name;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.toolName, "runCode");
	});

	it("wrapModelCall appends system prompt when enabled", async () => {
		const result = await runTestScript(
			"middleware-wrap-enabled",
			`
      import { createCodeInterpreterMiddleware } from './src/agent/codeInterpreter.js';
      const mw = createCodeInterpreterMiddleware({
        enabled: true,
        mode: "call",
      });
      const original = "You are a helpful assistant.";
      const wrapped = mw.wrapModelCall(original);
      result.hasEvalInstructions = wrapped.includes("eval");
      result.originalLength = original.length;
      result.wrappedLength = wrapped.length;
      result.grew = wrapped.length > original.length;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasEvalInstructions, true);
		assert.strictEqual(result.parsed?.grew, true);
	});

	it("wrapModelCall returns original when disabled", async () => {
		const result = await runTestScript(
			"middleware-wrap-disabled",
			`
      import { createCodeInterpreterMiddleware } from './src/agent/codeInterpreter.js';
      const mw = createCodeInterpreterMiddleware({
        enabled: false,
        mode: "call",
      });
      const original = "You are a helpful assistant.";
      const wrapped = mw.wrapModelCall(original);
      result.isSame = wrapped === original;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.isSame, true);
	});

	it("creates middleware with all config options", async () => {
		const result = await runTestScript(
			"middleware-full-config",
			`
      import { createCodeInterpreterMiddleware } from './src/agent/codeInterpreter.js';
      const mw = createCodeInterpreterMiddleware({
        enabled: true,
        mode: "thread",
        memoryLimit: 1073741824,
        timeoutMs: 60000,
        maxResultChars: 100000,
        captureConsole: true,
        toolName: "execute",
      });
      result.hasEvalTool = !!mw.evalTool;
      result.hasWrapModelCall = typeof mw.wrapModelCall === 'function';
      result.hasDispose = typeof mw.dispose === 'function';
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasEvalTool, true);
		assert.strictEqual(result.parsed?.hasWrapModelCall, true);
		assert.strictEqual(result.parsed?.hasDispose, true);
	});
});

describe("codeInterpreter - config integration", () => {
	it("CodeInterpreterSchema is exported from schemas/index.js", async () => {
		const result = await runTestScript(
			"config-schema-export",
			`
      import { CodeInterpreterSchema } from './src/config/schemas/index.js';
      result.hasSchema = !!CodeInterpreterSchema;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasSchema, true);
	});

	it("ConfigSchema includes codeInterpreter", async () => {
		const result = await runTestScript(
			"config-schema-codeInterpreter",
			`
      import { ConfigSchema } from './src/config/config.js';
      const parsed = ConfigSchema.parse({});
      result.hasCodeInterpreter = !!parsed.codeInterpreter;
      result.codeInterpreterEnabled = parsed.codeInterpreter?.enabled;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasCodeInterpreter, true);
		assert.strictEqual(result.parsed?.codeInterpreterEnabled, false);
	});
});
