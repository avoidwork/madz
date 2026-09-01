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
          subagentsEnabled: false,
          ptcEnabled: false,
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
      result.subagentsEnabled = parsed.subagentsEnabled;
      result.ptcEnabled = parsed.ptcEnabled;
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
		assert.strictEqual(result.parsed?.subagentsEnabled, false);
		assert.strictEqual(result.parsed?.ptcEnabled, false);
		assert.strictEqual(result.parsed?.toolName, "eval");
	});
});

describe("codeInterpreter - snapshot", () => {
	it("exports signSnapshot, verifySnapshot, extractSnapshot", async () => {
		const result = await runTestScript(
			"snapshot-exports",
			`
      const mod = await import('./src/sandbox/vm/snapshot.js');
      result.hasSign = typeof mod.signSnapshot === 'function';
      result.hasVerify = typeof mod.verifySnapshot === 'function';
      result.hasExtract = typeof mod.extractSnapshot === 'function';
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasSign, true);
		assert.strictEqual(result.parsed?.hasVerify, true);
		assert.strictEqual(result.parsed?.hasExtract, true);
	});

	it("signs and verifies a snapshot", async () => {
		const result = await runTestScript(
			"snapshot-sign-verify",
			`
      import { signSnapshot, verifySnapshot } from './src/sandbox/vm/snapshot.js';
      const secret = 'test-secret-key';
      const snapshot = '{"state":"test-data"}';
      const signed = signSnapshot(snapshot, secret);
      const { valid, snapshot: extracted } = verifySnapshot(signed, secret);
      result.valid = valid;
      result.extracted = extracted;
      result.matches = extracted === snapshot;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.valid, true);
		assert.strictEqual(result.parsed?.matches, true);
	});

	it("rejects tampered snapshot", async () => {
		const result = await runTestScript(
			"snapshot-tamper",
			`
      import { signSnapshot, verifySnapshot } from './src/sandbox/vm/snapshot.js';
      const secret = 'test-secret-key';
      const snapshot = '{"state":"test-data"}';
      const signed = signSnapshot(snapshot, secret);
      const tampered = signed.slice(0, -5) + 'XXXXX';
      const { valid } = verifySnapshot(tampered, secret);
      result.valid = valid;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.valid, false);
	});

	it("rejects wrong secret", async () => {
		const result = await runTestScript(
			"snapshot-wrong-secret",
			`
      import { signSnapshot, verifySnapshot } from './src/sandbox/vm/snapshot.js';
      const snapshot = '{"state":"test-data"}';
      const signed = signSnapshot(snapshot, 'secret-a');
      const { valid } = verifySnapshot(signed, 'secret-b');
      result.valid = valid;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.valid, false);
	});

	it("extracts snapshot from signed format", async () => {
		const result = await runTestScript(
			"snapshot-extract",
			`
      import { signSnapshot, extractSnapshot } from './src/sandbox/vm/snapshot.js';
      const snapshot = '{"state":"test-data"}';
      const signed = signSnapshot(snapshot, 'secret');
      const extracted = extractSnapshot(signed);
      result.matches = extracted === snapshot;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.matches, true);
	});
});

describe("codeInterpreter - PTC proxy", () => {
	it("exports createPTCProxy", async () => {
		const result = await runTestScript(
			"ptc-export",
			`
      import { createPTCProxy } from './src/sandbox/vm/ptc.js';
      result.hasProxy = typeof createPTCProxy === 'function';
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasProxy, true);
	});

	it("creates proxy with whitelisted tools", async () => {
		const result = await runTestScript(
			"ptc-create",
			`
      import { createPTCProxy } from './src/sandbox/vm/ptc.js';
      const tools = [
        { name: "readFile", execute: async () => "file content" },
        { name: "writeFile", execute: async () => "written" },
      ];
      const proxy = createPTCProxy(tools, ["readFile"]);
      result.hasReadFile = typeof proxy.readFile === 'function';
      result.hasWriteFile = typeof proxy.writeFile === 'function';
      const readResult = await proxy.readFile("test.txt");
      result.readResult = readResult;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasReadFile, true);
		assert.strictEqual(result.parsed?.hasWriteFile, false);
		assert.strictEqual(result.parsed?.readResult, "file content");
	});

	it("returns error for non-whitelisted tools", async () => {
		const result = await runTestScript(
			"ptc-whitelist",
			`
      import { createPTCProxy } from './src/sandbox/vm/ptc.js';
      const tools = [
        { name: "readFile", execute: async () => "content" },
      ];
      const proxy = createPTCProxy(tools, ["readFile"]);
      result.writeFileExists = typeof proxy.writeFile === 'function';
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.writeFileExists, false);
	});

	it("handles tool execution errors", async () => {
		const result = await runTestScript(
			"ptc-error",
			`
      import { createPTCProxy } from './src/sandbox/vm/ptc.js';
      const tools = [
        { name: "failingTool", execute: async () => { throw new Error("boom"); } },
      ];
      const proxy = createPTCProxy(tools, ["failingTool"]);
      const result2 = await proxy.failingTool("input");
      result.errorMsg = result2;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.ok(
			result.parsed?.errorMsg.includes("Error:"),
			`Expected error string, got: ${result.parsed?.errorMsg}`,
		);
	});
});

describe("codeInterpreter - task proxy", () => {
	it("exports createTaskProxy", async () => {
		const result = await runTestScript(
			"task-export",
			`
      import { createTaskProxy } from './src/sandbox/vm/task.js';
      result.hasProxy = typeof createTaskProxy === 'function';
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasProxy, true);
	});

	it("creates task function from dispatch", async () => {
		const result = await runTestScript(
			"task-create",
			`
      import { createTaskProxy } from './src/sandbox/vm/task.js';
      const dispatch = async (desc, opts) => {
        return \`Task \${desc} completed\`;
      };
      const taskFn = createTaskProxy(dispatch);
      const result2 = await taskFn("analyze data", { agent: "coding" });
      result.taskResult = result2;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.ok(
			result.parsed?.taskResult.includes("Task"),
			`Expected task result, got: ${result.parsed?.taskResult}`,
		);
	});

	it("handles dispatch errors", async () => {
		const result = await runTestScript(
			"task-error",
			`
      import { createTaskProxy } from './src/sandbox/vm/task.js';
      const dispatch = async () => { throw new Error("dispatch failed"); };
      const taskFn = createTaskProxy(dispatch);
      const result2 = await taskFn("bad task");
      result.errorMsg = result2;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.ok(
			result.parsed?.errorMsg.includes("Error:"),
			`Expected error string, got: ${result.parsed?.errorMsg}`,
		);
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
        subagentsEnabled: true,
        ptcEnabled: true,
        toolName: "execute",
        snapshotSecret: "test-secret",
        ptcWhitelist: ["readFile", "writeFile"],
      });
      result.hasEvalTool = !!mw.evalTool;
      result.hasWrapModelCall = typeof mw.wrapModelCall === 'function';
      result.hasGetSnapshot = typeof mw.getSnapshot === 'function';
      result.hasRestoreSnapshot = typeof mw.restoreSnapshot === 'function';
      result.hasDispose = typeof mw.dispose === 'function';
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasEvalTool, true);
		assert.strictEqual(result.parsed?.hasWrapModelCall, true);
		assert.strictEqual(result.parsed?.hasGetSnapshot, true);
		assert.strictEqual(result.parsed?.hasRestoreSnapshot, true);
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
