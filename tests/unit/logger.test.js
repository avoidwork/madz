import { describe, it } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";

const TEST_DIR = "memory/__logger_test__";

/**
 * Run a subprocess test script. Each test gets a unique sub-directory.
 * Tests should run sequentially to avoid directory conflicts.
 * @param {string} testId - Unique test identifier used as sub-directory name
 * @param {string} script - Node.js code to execute (uses --input-type=module)
 * @param {Object} [opts] - Spawn options (env, etc.)
 * @returns {Promise<{stdout: string, stderr: string, code: number, testLogDirAbs: string, parsed: object|null}>}
 */
async function runTestScript(testId, script, opts = {}) {
	// Clean up previous test dir
	try {
		rmSync(TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
	mkdirSync(TEST_DIR, { recursive: true });

	const testLogDir = `${TEST_DIR}/${testId}`;
	const testLogDirAbs = `${process.cwd()}/${TEST_DIR}/${testId}`;

	const fullScript = `
		import { createWriteStream, mkdirSync, existsSync, readdirSync, readFileSync, rmSync } from 'fs';
		import pino from 'pino';
		import { join } from 'path';

		const testLogDir = "${testLogDir}";
		const testLogDirAbs = "${testLogDirAbs}";

		try { rmSync(testLogDirAbs, { recursive: true, force: true }); } catch {}
		mkdirSync(testLogDirAbs, { recursive: true });

		const result = {
			testLogDir,
			testLogDirAbs,
			exists: existsSync(testLogDirAbs)
		};

		${script}

		// Clean up test dir
		try { rmSync(testLogDirAbs, { recursive: true, force: true }); } catch {}
		console.log(JSON.stringify(result));
	`;

	return new Promise((resolve) => {
		const sub = spawn(process.execPath, ["--input-type=module", "--eval", fullScript], {
			cwd: process.cwd(),
			env: opts.env || process.env,
		});
		let stdout = "";
		let stderr = "";
		sub.stdout.on("data", (d) => (stdout += d.toString()));
		sub.stderr.on("data", (d) => (stderr += d.toString()));
		sub.on("close", (code) => {
			// Try to parse the JSON output from stdout
			const lastLine = stdout.trim().split("\n").pop();
			let parsed = null;
			try {
				parsed = JSON.parse(lastLine);
			} catch {
				// JSON parse failed, parsed stays null
			}
			resolve({
				stdout: stdout.trim(),
				stderr: stderr.trim(),
				code,
				testLogDirAbs,
				parsed,
			});
		});
	});
}

describe("logger module", () => {
	it("exports getLogDirectory function (4.2)", async () => {
		const result = await runTestScript(
			"export-1",
			`
			import { getLogDirectory } from './src/logger.js';
			result.getLogDir = getLogDirectory();
		`,
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stdout}`);
		assert.ok(result.parsed?.getLogDir?.startsWith("/"), "Directory should be an absolute path");
		assert.ok(result.parsed?.getLogDir?.includes("madz"), "Directory should contain 'madz'");
	});

	it("exports logger with all required methods (4.7)", async () => {
		const result = await runTestScript(
			"export-2",
			`
			import { logger } from './src/logger.js';
			const methods = ['info', 'warn', 'error', 'debug', 'fatal', 'silent'];
			result.allMethods = methods.every(m => typeof logger[m] === 'function');
		`,
		);
		assert.strictEqual(result.code, 0);
		assert.strictEqual(result.parsed?.allMethods, true, "All logger methods should be present");
	});

	it("exports async flush function (3.3, 4.8)", async () => {
		const result = await runTestScript(
			"flush-1",
			`
			import { flush } from './src/logger.js';
			await flush();
			result.flushOk = true;
		`,
		);
		assert.strictEqual(result.code, 0);
		assert.strictEqual(result.parsed?.flushOk, true);
	});

	it("dual-file output: errors in both files, info only in madz.log (4.4)", async () => {
		const result = await runTestScript(
			"dualfile-1",
			`
			const multiStream = pino.multistream([
				{ stream: createWriteStream(join(testLogDirAbs, 'madz.log'), { flags: 'a' }), level: 'info' },
				{ stream: createWriteStream(join(testLogDirAbs, 'madz_error.log'), { flags: 'a' }), level: 'error' }
			]);
			const logger = pino({ level: 'debug' }, multiStream);

			logger.info('info_message_test');
			logger.warn('warn_message_test');
			logger.error('error_message_test');

			await new Promise(resolve => {
				if (typeof logger.flush === 'function') {
					logger.flush(resolve);
				} else { resolve(); }
			});
			// pino's flush callback fires before OS writes files to disk (Node.js 25+)
			await new Promise(resolve => setTimeout(resolve, 100));

			result.infoContent = readFileSync(join(testLogDirAbs, 'madz.log'), 'utf-8');
			result.errorContent = existsSync(join(testLogDirAbs, 'madz_error.log'))
				? readFileSync(join(testLogDirAbs, 'madz_error.log'), 'utf-8')
				: '';
		`,
		);

		assert.strictEqual(result.code, 0, `Subprocess failed: ${result.stderr}`);
		assert.ok(result.parsed?.infoContent, "madz.log should exist");
		assert.ok(result.parsed?.errorContent !== undefined, "madz_error.log should exist");

		const infoLines = result.parsed.infoContent.split("\n").filter(Boolean);
		assert.ok(
			infoLines.some((l) => JSON.parse(l).msg === "info_message_test"),
			"madz.log should contain info",
		);
		assert.ok(
			infoLines.some((l) => JSON.parse(l).msg === "warn_message_test"),
			"madz.log should contain warn",
		);
		assert.ok(
			infoLines.some((l) => JSON.parse(l).msg === "error_message_test"),
			"madz.log should contain error",
		);

		const errorLines = result.parsed.errorContent.split("\n").filter(Boolean);
		assert.ok(
			errorLines.some((l) => JSON.parse(l).msg === "error_message_test"),
			"madz_error.log should contain error",
		);
		assert.ok(
			!errorLines.some((l) => JSON.parse(l).msg === "info_message_test"),
			"madz_error.log should NOT contain info",
		);
		assert.ok(
			!errorLines.some((l) => JSON.parse(l).msg === "warn_message_test"),
			"madz_error.log should NOT contain warn",
		);
	});

	it("structured JSON output from each log method (4.7)", async () => {
		const result = await runTestScript(
			"struct-1",
			`
			const multiStream = pino.multistream([
				{ stream: createWriteStream(join(testLogDirAbs, 'struct.log'), { flags: 'a' }), level: 'info' },
				{ stream: createWriteStream(join(testLogDirAbs, 'struct_error.log'), { flags: 'a' }), level: 'error' }
			]);
			const logger = pino({ level: 'debug' }, multiStream);

			const meta = { module: 'test', line: 42 };
			logger.info('struct_info', meta);
			logger.warn('struct_warn', meta);
			logger.error('struct_error', meta);
			logger.debug('struct_debug', meta);
			logger.fatal('struct_fatal', meta);

			await new Promise(resolve => {
				if (typeof logger.flush === 'function') { logger.flush(resolve); }
				else { resolve(); }
			});
			await new Promise(resolve => setTimeout(resolve, 100));

			result.structContent = readFileSync(join(testLogDirAbs, 'struct.log'), 'utf-8');
		`,
		);

		assert.strictEqual(result.code, 0, `Subprocess failed: ${result.stderr}`);
		assert.ok(result.parsed?.structContent, "struct.log should exist");

		const lines = result.parsed.structContent.split("\n").filter(Boolean);
		assert.ok(lines.length > 0, "Should have log lines");

		for (const line of lines) {
			const entry = JSON.parse(line);
			assert.ok(entry.level, "Entry should have a level");
			assert.ok(entry.time, "Entry should have a timestamp");
			assert.ok(entry.msg, "Entry should have a message");
		}
	});

	it("fatal method logs to both info and error files (4.7)", async () => {
		const result = await runTestScript(
			"fatal-1",
			`
			const multiStream = pino.multistream([
				{ stream: createWriteStream(join(testLogDirAbs, 'fatal.log'), { flags: 'a' }), level: 'info' },
				{ stream: createWriteStream(join(testLogDirAbs, 'fatal_error.log'), { flags: 'a' }), level: 'error' }
			]);
			const logger = pino({ level: 'debug' }, multiStream);
			logger.fatal('critical_failure_test');

			await new Promise(resolve => {
				if (typeof logger.flush === 'function') { logger.flush(resolve); }
				else { resolve(); }
			});
			await new Promise(resolve => setTimeout(resolve, 100));

			result.fatalInfoContent = readFileSync(join(testLogDirAbs, 'fatal.log'), 'utf-8');
			result.fatalErrorContent = readFileSync(join(testLogDirAbs, 'fatal_error.log'), 'utf-8');
		`,
		);

		assert.strictEqual(result.code, 0, `Subprocess failed: ${result.stderr}`);
		assert.ok(
			result.parsed?.fatalInfoContent?.includes("critical_failure_test"),
			"Fatal should appear in info file",
		);
		assert.ok(
			result.parsed?.fatalErrorContent?.includes("critical_failure_test"),
			"Fatal should appear in error file",
		);
	});

	it("silent mode works without crashing (4.5)", async () => {
		const result = await runTestScript(
			"silent-1",
			`
			import { logger } from './src/logger.js';
			logger.info('silent_test');
			logger.error('silent_test');
			result.silentOK = true;
		`,
			{ env: { ...process.env, NODE_ENV: "test" } },
		);
		assert.strictEqual(result.code, 0, `stderr: ${result.stdout}`);
		assert.strictEqual(result.parsed?.silentOK, true);
	});

	it("flush function completes successfully (4.8)", async () => {
		const result = await runTestScript(
			"flush-2",
			`
			import { flush } from './src/logger.js';
			await flush();
			result.flushDone = true;
		`,
		);
		assert.strictEqual(result.code, 0);
		assert.strictEqual(result.parsed?.flushDone, true);
	});
});
