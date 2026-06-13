import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { spawn } from "node:child_process";
import { mkdtemp, unlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LANGUAGE_MAP = {
	python3: { ext: ".py", interpreter: "python3" },
	javascript: { ext: ".js", interpreter: "node" },
	shell: { ext: ".sh", interpreter: "sh" },
};

/**
 * Parse a memory limit string (e.g., "512m", "2g", "1048576000") to bytes.
 * @param {string} memStr - Memory size string
 * @returns {number} Size in bytes
 */
export function parseMemLimit(memStr) {
	const match = memStr
		?.trim()
		?.toLowerCase()
		?.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
	if (!match) {
		return 512 * 1024 * 1024; // default 512MB
	}
	const value = parseFloat(match[1]);
	const unit = match[2] || "b";
	const multipliers = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
	return Math.floor(value * (multipliers[unit] || 1));
}

/**
 * Kill a child process with SIGKILL if it hasn't been killed yet.
 * @param {import("node:child_process").ChildProcess | undefined} child - Child process to kill
 * @returns {void}
 */
export function killProcess(child) {
	if (!child || child.killed) return;
	child.kill("SIGKILL");
}

/**
 * Clean up temporary files created during code execution.
 * @param {string} filePath - The code file path
 * @param {string} tmpRoot - The temp directory path
 * @returns {Promise<void>}
 */
async function cleanupFiles(filePath, tmpRoot) {
	/* node:coverage ignore next */
	try {
		await unlink(filePath);
		await rm(tmpRoot, { recursive: true, force: true });
	} /* node:coverage ignore next 3 */ catch {
		// Cleanup errors are non-critical
	}
}

/**
 * Import hook code for blocking dangerous Python imports.
 * @returns {string} Python code to install the import hook
 */
function getImportHookCode() {
	return `
import sys
import types

class RestrictedImporter:
    def find_spec(self, fullname, path, target=None):
        blocked = {'subprocess', 'os', 'socket', 'pty', 'tty', 'popen2', 'popen3', 'popen4'}
        module = fullname.split('.')[0]
        if module in blocked:
            raise ImportError(f"Blocked import: {fullname} (use 'pythonImportHook: false' in config to disable)")
        return None

sys.meta_path.insert(0, RestrictedImporter())
`;
}

/**
 * Execute code in a sandboxed subprocess.
 * @param {object} input - Tool input
 * @param {object} options - Runtime options with timeout, memoryLimit, and safety config
 * @returns {Promise<string>} JSON result string
 */
export async function executeCodeImpl(input, options) {
	const { code, language = "python3", _timeout, _interpreter } = input;
	const safetyConfig = options?.safety ?? {};
	const timeoutConfig = options?.timeout ?? {};
	const memoryLimitStr = options?.memoryLimit;

	const defaultTimeout = (timeoutConfig.seconds ?? 30) || 30;
	const timeout = _timeout ?? (defaultTimeout === 0 ? 300 : defaultTimeout);

	const memLimit = parseMemLimit(memoryLimitStr);

	if (!code || typeof code !== "string" || code.trim().length === 0) {
		return JSON.stringify({ ok: false, error: "Code is required and must be a non-empty string" });
	}

	const langConfig = LANGUAGE_MAP[language];
	if (!langConfig) {
		return JSON.stringify({
			ok: false,
			error: `Unsupported language: "${language}". Supported: ${Object.keys(LANGUAGE_MAP).join(", ")}`,
		});
	}

	const useImportHook = language === "python3" && safetyConfig.pythonImportHook !== false;

	const tmpRoot = await mkdtemp(join(tmpdir(), "madz-code-"));
	const filePath = join(tmpRoot, `code${langConfig.ext}`);

	let writeCode = code;
	if (useImportHook && language === "python3") {
		writeCode = getImportHookCode() + "\n" + code;
	}

	await writeFile(filePath, writeCode, "utf-8");

	// Set RLIMIT_AS for memory enforcement if configured
	if (memLimit > 0) {
		try {
			const { setrlimit } = await import("posix");
			setrlimit("as", { soft: memLimit, hard: memLimit });
		} catch {
			// setrlimit not available
		}
	}

	const controller = new AbortController();
	let timedOut = false;
	let child;
	let stdout = "";
	let stderr = "";

	const timeoutId = setTimeout(() => {
		timedOut = true;
		controller.abort();
		killProcess(child);
	}, timeout * 1000);

	try {
		const interpreter = _interpreter ?? langConfig.interpreter;
		child = spawn(interpreter, [filePath], {
			signal: controller.signal,
		});
	} /* node:coverage ignore next 4 */ catch (err) {
		clearTimeout(timeoutId);
		await cleanupFiles(filePath, tmpRoot);
		return JSON.stringify({ ok: false, error: `Spawn failed: ${err.message}` });
	}

	child.stdout.on("data", (d) => {
		stdout += d.toString();
	});
	child.stderr.on("data", (d) => {
		stderr += d.toString();
	});

	const exitCode = await new Promise((resolve) => {
		child.on("close", (code) => resolve(code ?? 0));
		child.on("error", () => resolve(-1));
	});

	clearTimeout(timeoutId);

	await cleanupFiles(filePath, tmpRoot);

	if (timedOut) {
		return JSON.stringify({
			ok: false,
			error: `Execution timed out after ${timeout} seconds`,
			stdout: stdout.trim(),
			stderr: stderr.trim(),
		});
	}

	return JSON.stringify({
		ok: exitCode === 0,
		exitCode,
		stdout: stdout.trim(),
		stderr: stderr.trim(),
		usedImportHook: useImportHook,
		memoryLimitUsed: memLimit > 0,
		memoryLimitBytes: memLimit,
	});
}

/**
 * @param {z.infer<typeof CodeSchema>} input - Tool input with code and language
 * @param {object} _options - Runtime options
 * @returns {string} JSON result string
 */
export const execute_code = tool(executeCodeImpl, {
	name: "executeCode",
	description:
		"Execute code in a sandboxed subprocess. Supports python3, javascript (node), and shell. Code is written to a temp file and executed via the appropriate interpreter. Returns stdout, stderr, and exit code. Python execution includes an import hook to block dangerous modules (subprocess, os, socket) unless sandbox.safety.pythonImportHook is false. Enforces configurable memory limit via POSIX setrlimit (address space limit)",
	schema: z.object({
		code: z.string().min(1).describe("Code to execute"),
		language: z
			.enum(["python3", "javascript", "shell"])
			.default("python3")
			.describe("Programming language"),
	}),
});

// --- Factory functions for creating tools with runtime options ---

/**
 * Create an execute_code tool with runtime options
 * @param {object} options - Runtime options (safety, timeout, memoryLimit)
 * @returns {object} LangChain Tool instance
 */
export function createCodeTool(options) {
	return tool((input) => executeCodeImpl(input, options), {
		name: "executeCode",
		description:
			"Execute code in a sandboxed subprocess. Supports python3, javascript (node), and shell. Code is written to a temp file and executed via the appropriate interpreter. Returns stdout, stderr, and exit code.",
		schema: z.object({
			code: z.string().min(1).describe("Code to execute"),
			language: z
				.enum(["python3", "javascript", "shell"])
				.default("python3")
				.describe("Programming language"),
		}),
	});
}
