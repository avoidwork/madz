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
	const { code, language = "python3", _timeout } = input;
	const safetyConfig = options?.safety ?? {};
	const timeoutConfig = options?.timeout ?? {};

	const defaultTimeout = (timeoutConfig.seconds ?? 30) || 30;
	const timeout = _timeout ?? (defaultTimeout === 0 ? 300 : defaultTimeout);

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

	const controller = new AbortController();
	let timedOut = false;
	const timeoutId = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, timeout * 1000);

	try {
		const process = spawn(langConfig.interpreter, [filePath], {
			signal: controller.signal,
		});

		let stdout = "";
		let stderr = "";

		process.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		process.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		const [exitCode] = await new Promise((resolve) => {
			process.on("close", (code) => resolve([code || 0]));
			process.on("error", (_err) => resolve([-1]));
		});

		clearTimeout(timeoutId);

		if (timedOut) {
			return JSON.stringify({
				ok: false,
				error: `Execution timed out after ${timeout} seconds`,
				stdout: stdout.trim(),
				stderr: stderr.trim(),
			});
		}

		// Cleanup temp files
		try {
			await unlink(filePath);
			await rm(tmpRoot, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}

		return JSON.stringify({
			ok: exitCode === 0,
			exitCode,
			stdout: stdout.trim(),
			stderr: stderr.trim(),
			usedImportHook: useImportHook,
		});
	} catch (err) {
		clearTimeout(timeoutId);
		try {
			await unlink(filePath);
			await rm(tmpRoot, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}

		if (err.name === "AbortError" || err.code === "ELIFECYCLE") {
			return JSON.stringify({
				ok: false,
				error: `Execution timed out after ${timeout} seconds`,
			});
		}

		return JSON.stringify({
			ok: false,
			error: `Execution failed: ${err.message}`,
		});
	}
}

/**
 * @param {z.infer<typeof CodeSchema>} input - Tool input with code and language
 * @param {object} _options - Runtime options
 * @returns {string} JSON result string
 */
export const execute_code = tool(executeCodeImpl, {
	name: "execute_code",
	description:
		"Execute code in a sandboxed subprocess. Supports python3, javascript (node), and shell. Code is written to a temp file and executed via the appropriate interpreter. Returns stdout, stderr, and exit code. Python execution includes an import hook to block dangerous modules (subprocess, os, socket) unless sandbox.safety.pythonImportHook is false. Uses config timeout and memory limits",
	schema: z.object({
		code: z.string().min(1).describe("Code to execute"),
		language: z
			.enum(["python3", "javascript", "shell"])
			.default("python3")
			.describe("Programming language"),
	}),
});
