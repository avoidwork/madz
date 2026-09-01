// tests/integration/codeInterpreter.test.js — Integration tests for CodeInterpreterMiddleware.

import { describe, it } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(__dirname, "../../memory/__code_interpreter_integration__");

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

describe("codeInterpreter - integration", () => {
	it("config.yaml contains codeInterpreter section", async () => {
		const result = await runTestScript(
			"config-yaml",
			`
      import { readFileSync } from 'fs';
      const yaml = readFileSync('./config.yaml', 'utf-8');
      result.hasSection = yaml.includes('codeInterpreter:');
      result.hasEnabled = yaml.includes('enabled: false');
      result.hasMode = yaml.includes('mode: thread');
      result.hasMemoryLimit = yaml.includes('memoryLimit: 536870912');
      result.hasTimeout = yaml.includes('timeoutMs: 30000');
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasSection, true);
		assert.strictEqual(result.parsed?.hasEnabled, true);
		assert.strictEqual(result.parsed?.hasMode, true);
		assert.strictEqual(result.parsed?.hasMemoryLimit, true);
		assert.strictEqual(result.parsed?.hasTimeout, true);
	});

	it("package.json includes quickjs-emscripten-core", async () => {
		const result = await runTestScript(
			"package-json",
			`
      import { readFileSync } from 'fs';
      const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
      result.hasDependency = !!pkg.dependencies['quickjs-emscripten-core'];
      result.version = pkg.dependencies['quickjs-emscripten-core'];
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasDependency, true);
	});

	it("all new files exist on disk", async () => {
		const result = await runTestScript(
			"files-exist",
			`
      const files = [
        './src/sandbox/vm.js',
        './src/agent/codeInterpreter.js',
        './src/config/schemas/codeInterpreter.js',
        './tests/unit/codeInterpreter.test.js',
        './tests/integration/codeInterpreter.test.js',
      ];
      const results = {};
      for (const f of files) {
        results[f] = existsSync(f);
      }
      result.files = results;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		for (const [file, exists] of Object.entries(result.parsed?.files || {})) {
			assert.strictEqual(exists, true, `File should exist: ${file}`);
		}
	});

	it("deepAgents.js imports codeInterpreter conditionally", async () => {
		const result = await runTestScript(
			"deepagents-import",
			`
      import { readFileSync } from 'fs';
      const content = readFileSync('./src/agent/deepAgents.js', 'utf-8');
      result.hasImport = content.includes('codeInterpreter.js');
      result.hasConditional = content.includes('config.codeInterpreter?.enabled');
      result.hasMiddlewareSpread = content.includes('middleware.length > 0');
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasImport, true);
		assert.strictEqual(result.parsed?.hasConditional, true);
		assert.strictEqual(result.parsed?.hasMiddlewareSpread, true);
	});

	it("schemas/index.js exports CodeInterpreterSchema", async () => {
		const result = await runTestScript(
			"schemas-index",
			`
      import { readFileSync } from 'fs';
      const content = readFileSync('./src/config/schemas/index.js', 'utf-8');
      result.hasExport = content.includes('CodeInterpreterSchema');
      result.hasImport = content.includes('codeInterpreter.js');
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasExport, true);
		assert.strictEqual(result.parsed?.hasImport, true);
	});

	it("config.js imports and uses CodeInterpreterSchema", async () => {
		const result = await runTestScript(
			"config-js",
			`
      import { readFileSync } from 'fs';
      const content = readFileSync('./src/config/config.js', 'utf-8');
      result.hasImport = content.includes('CodeInterpreterSchema');
      result.hasUsage = content.includes('codeInterpreter: CodeInterpreterSchema');
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasImport, true);
		assert.strictEqual(result.parsed?.hasUsage, true);
	});

	it("middleware has required methods", async () => {
		const result = await runTestScript(
			"middleware-methods",
			`
      import { createCodeInterpreterMiddleware } from './src/agent/codeInterpreter.js';
      const mw = createCodeInterpreterMiddleware({
        enabled: true,
        mode: "call",
      });
      result.hasEvalTool = typeof mw.evalTool !== 'undefined';
      result.hasWrapModelCall = typeof mw.wrapModelCall === 'function';
      result.hasDispose = typeof mw.dispose === 'function';
      result.evalToolName = mw.evalTool?.name;
      result.evalToolType = typeof mw.evalTool;
    `,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stderr}`);
		assert.strictEqual(result.parsed?.hasEvalTool, true);
		assert.strictEqual(result.parsed?.hasWrapModelCall, true);
		assert.strictEqual(result.parsed?.hasDispose, true);
		assert.strictEqual(result.parsed?.evalToolName, "eval");
		assert.strictEqual(result.parsed?.evalToolType, "object");
	});
});
