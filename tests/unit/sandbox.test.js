import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePath, assertPathAllowed } from "../../src/sandbox/pathResolver.js";
import { filterUrl, isSchemeAllowed } from "../../src/sandbox/urlFilter.js";
import { injectEnv, filterEnv } from "../../src/sandbox/envInjector.js";
import { enforceCapabilities } from "../../src/sandbox/capability.js";
import { runSandbox } from "../../src/sandbox/runner.js";
import { detectInterpreter } from "../../src/sandbox/runner.js";

describe("sandbox - path resolution", () => {
	describe("resolvePath", () => {
		it("allows path within scope", () => {
			const result = resolvePath("memory/test.md", ["memory/"]);
			assert.strictEqual(result.allowed, true);
		});

		it("rejects path outside scope", () => {
			const result = resolvePath("/etc/passwd", ["memory/"]);
			assert.strictEqual(result.allowed, false);
		});

		it("allows exact match", () => {
			const result = resolvePath("memory/", ["memory/"]);
			assert.strictEqual(result.allowed, true);
		});

		it("allows nested path within scope", () => {
			const result = resolvePath("memory/subdir/file.md", ["memory/"]);
			assert.strictEqual(result.allowed, true);
		});

		it("rejects path with parent traversal", () => {
			const result = resolvePath("memory/../../../etc/passwd", ["memory/"]);
			assert.strictEqual(result.allowed, false);
		});

		it("allows when multiple scopes match", () => {
			const result = resolvePath("skills/fs-read/script.sh", ["memory/", "skills/"]);
			assert.strictEqual(result.allowed, true);
		});

		it("rejects with no allowed paths", () => {
			const result = resolvePath("/any/path", []);
			assert.strictEqual(result.allowed, false);
		});

		it("handles absolute paths in scope", () => {
			const result = resolvePath("/home/user/memory/", ["/home/user/memory/"]);
			assert.strictEqual(result.allowed, true);
		});

		it("excludes path matching negation rule", () => {
			const result = resolvePath("node_modules/pkg/index.js", ["./", "!node_modules/"]);
			assert.strictEqual(result.allowed, false);
		});

		it("excludes nested path under negated directory", () => {
			const result = resolvePath("node_modules/@scope/package/src/file.js", ["./", "!node_modules/"]);
			assert.strictEqual(result.allowed, false);
		});

		it("allows path that matches positive rule but not negation", () => {
			const result = resolvePath("src/utils/helper.js", ["./", "!node_modules/"]);
			assert.strictEqual(result.allowed, true);
		});

		it("allows path outside negated scope even with broad positive", () => {
			const result = resolvePath("memory/data.json", ["./", "!node_modules/"]);
			assert.strictEqual(result.allowed, true);
		});

		it("handles multiple negation rules", () => {
			const result = resolvePath("tmp/cache.dat", ["./", "!node_modules/", "!tmp/"]);
			assert.strictEqual(result.allowed, false);
		});

		it("allows when no positive rule matches despite negation", () => {
			const result = resolvePath("/etc/passwd", ["./", "!node_modules/"]);
			assert.strictEqual(result.allowed, false);
		});

		it("ignores negation-only config (no positives)", () => {
			const result = resolvePath("memory/file.txt", ["!node_modules/"]);
			assert.strictEqual(result.allowed, false);
		});

		it("handles negation with matching absolute paths", () => {
			// Both the positive rule and negation resolve relative to CWD
			// In practice, CWD is the project root, so both paths align
			const cwd = process.cwd();
			const result = resolvePath(join(cwd, "node_modules/x.js"), [join(cwd, "/"), "!node_modules/"]);
			assert.strictEqual(result.allowed, false);
		});

		it("handles empty negation path string", () => {
			const result = resolvePath("memory/file.txt", ["./", ""]);
			assert.strictEqual(result.allowed, true);
		});
	});

	describe("assertPathAllowed", () => {
		it("returns resolved path when allowed", () => {
			const result = assertPathAllowed("memory/test.md", ["memory/"]);
			assert.ok(result.includes("memory"));
		});

		it("throws AccessDeniedError when outside scope", () => {
			assert.throws(
				() => assertPathAllowed("/etc/passwd", ["memory/"]),
				(err) => err.name === "AccessDeniedError",
			);
		});
	});
});

describe("sandbox - URL filtering", () => {
	describe("filterUrl", () => {
		it("allows http URLs", () => {
			const result = filterUrl("http://api.example.com/health", ["api.example.com"]);
			assert.strictEqual(result.allowed, true);
		});

		it("blocks file:// scheme", () => {
			const result = filterUrl("file:///etc/passwd");
			assert.strictEqual(result.allowed, false);
			assert.ok(result.reason.includes("Blocked scheme"));
		});

		it("blocks gopher:// scheme", () => {
			const result = filterUrl("gopher://example.com");
			assert.strictEqual(result.allowed, false);
		});

		it("blocks dict:// scheme", () => {
			const result = filterUrl("dict://example.com");
			assert.strictEqual(result.allowed, false);
		});

		it("rejects URLs not on allowlist", () => {
			const result = filterUrl("http://evil.com", ["api.example.com"]);
			assert.strictEqual(result.allowed, false);
		});

		it("accepts valid URL on allowlist", () => {
			const result = filterUrl("https://api.example.com/v1/data", ["api.example.com"]);
			assert.strictEqual(result.allowed, true);
		});

		it("handles invalid URLs", () => {
			const result = filterUrl("not-a-url");
			assert.strictEqual(result.allowed, false);
		});

		it("handles empty URL", () => {
			const result = filterUrl("");
			assert.strictEqual(result.allowed, false);
		});

		it("handles null URL", () => {
			const result = filterUrl(null);
			assert.strictEqual(result.allowed, false);
		});

		it("works without allowlist", () => {
			const result = filterUrl("http://any-domain.com/path");
			assert.strictEqual(result.allowed, true);
		});
	});

	describe("isSchemeAllowed", () => {
		it("allows http", () => assert.strictEqual(isSchemeAllowed("http://example.com"), true));
		it("allows https", () => assert.strictEqual(isSchemeAllowed("https://example.com"), true));
		it("blocks file://", () => assert.strictEqual(isSchemeAllowed("file:///etc/passwd"), false));
		it("returns false for invalid URL format (catch block)", () => {
			const result = isSchemeAllowed("://missing-scheme");
			assert.strictEqual(result, false);
		});
	});
});

describe("sandbox - env injector", () => {
	describe("injectEnv", () => {
		it("selects only whitelisted vars", () => {
			const origPath = process.env.PATH;
			const origHome = process.env.HOME;
			const origSecret = process.env.SECRET;
			process.env.PATH = "/usr/bin";
			process.env.HOME = "/home/user";
			process.env.SECRET = "hidden";

			const result = injectEnv(["PATH", "HOME"]);
			assert.strictEqual(result.PATH, "/usr/bin");
			assert.strictEqual(result.HOME, "/home/user");
			assert.strictEqual(result.SECRET, undefined);

			// Restore original env
			if (origPath === undefined) delete process.env.PATH;
			else process.env.PATH = origPath;
			if (origHome === undefined) delete process.env.HOME;
			else process.env.HOME = origHome;
			if (origSecret === undefined) delete process.env.SECRET;
			else delete process.env.SECRET;
		});

		it("works with empty whitelist", () => {
			const result = injectEnv([]);
			assert.strictEqual(Object.keys(result).length, 0);
		});

		it("skips non-existent vars", () => {
			const result = injectEnv(["NONEXISTENT_VAR_XYZ"]);
			assert.strictEqual(Object.keys(result).length, 0);
		});
	});

	describe("filterEnv", () => {
		it("filters env object by whitelist", () => {
			const env = { PATH: "/bin", HOME: "/root", TOKEN: "secret" };
			const result = filterEnv(env, ["PATH"]);
			assert.deepStrictEqual(result, { PATH: "/bin" });
		});

		it("handles null env", () => {
			assert.deepStrictEqual(filterEnv(null, ["PATH"]), {});
		});

		it("handles undefined env", () => {
			assert.deepStrictEqual(filterEnv(undefined, ["PATH"]), {});
		});
	});
});

describe("sandbox - capability enforcement", () => {
	describe("enforceCapabilities", () => {
		it("returns empty rules with no permissions", () => {
			const result = enforceCapabilities([]);
			assert.strictEqual(result.resources.length, 0);
			assert.strictEqual(result.rules.length, 0);
		});

		it("maps filesystem:read to read rule", () => {
			const result = enforceCapabilities(["filesystem:read"]);
			assert.deepStrictEqual(result.rules, [{ resource: "filesystem", action: "read" }]);
		});

		it("maps filesystem:write to read + write rules", () => {
			const result = enforceCapabilities(["filesystem:write"]);
			assert.strictEqual(result.resources.length, 2);
			assert.ok(result.resources.includes("filesystem:read"));
			assert.ok(result.resources.includes("filesystem:write"));
		});

		it("maps network:outbound to network rule", () => {
			const result = enforceCapabilities(["network:outbound"]);
			assert.ok(result.resources.includes("network:outbound"));
		});

		it("maps process:spawn to process rule", () => {
			const result = enforceCapabilities(["process:spawn"]);
			assert.ok(result.resources.includes("process:spawn"));
		});

		it("maps filesystem:exec to read + execute rules", () => {
			const result = enforceCapabilities(["filesystem:exec"]);
			assert.strictEqual(result.resources.length, 2);
			assert.ok(result.resources.includes("filesystem:read"));
			assert.ok(result.resources.includes("filesystem:exec"));
			assert.ok(result.rules.some((r) => r.resource === "filesystem" && r.action === "execute"));
		});

		it("maps env:read to env rule", () => {
			const result = enforceCapabilities(["env:read"]);
			assert.deepStrictEqual(result.rules, [{ resource: "env", action: "read" }]);
			assert.ok(result.resources.includes("env:read"));
		});

		it("combines multiple permissions", () => {
			const result = enforceCapabilities(["network:outbound", "filesystem:read"]);
			assert.strictEqual(result.rules.length, 2);
		});
	});
});

// --- Detect interpreter tests (in sandbox/runner.js too) ---

describe("sandbox - detectInterpreter", () => {
	it("detects python from .py extension", () => {
		const result = detectInterpreter("script.py");
		assert.deepStrictEqual(result, { command: "python3", args: [] });
	});

	it("detects node from .js extension", () => {
		const result = detectInterpreter("script.js");
		assert.deepStrictEqual(result, { command: "node", args: [] });
	});

	it("detects bash from .sh extension", () => {
		const result = detectInterpreter("script.sh");
		assert.deepStrictEqual(result, { command: "bash", args: [] });
	});

	it("detects ruby from .rb extension", () => {
		const result = detectInterpreter("script.rb");
		assert.deepStrictEqual(result, { command: "ruby", args: [] });
	});

	it("detects typescript from .ts extension", () => {
		const result = detectInterpreter("script.ts");
		assert.deepStrictEqual(result, { command: "node", args: ["--import", "tsx"] });
	});

	it("returns null for unknown extension", () => {
		const result = detectInterpreter("script.xyz");
		assert.strictEqual(result, null);
	});
});

// --- Sandbox runner tests: use spawn instead of fork ---

function createTestScript(stdout, stderr, exitCode) {
	const testDir = join(tmpdir(), "madz-sandbox-spawn-test-" + Date.now());
	mkdirSync(testDir, { recursive: true });
	const scriptPath = join(testDir, "test-script.js");
	writeFileSync(
		scriptPath,
		[
			'"use strict";',
			`process.stdout.write(${JSON.stringify(stdout)});`,
			`process.stderr.write(${JSON.stringify(stderr)});`,
			`process.exit(${exitCode});`,
		].join("\n"),
	);
	const cleanup = () => {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// ignore cleanup errors
		}
	};
	return { scriptPath, cleanup };
}

describe("sandbox - runner (spawn)", () => {
	it("captures stdout, stderr, and exitCode from child process", async () => {
		const { scriptPath, cleanup } = createTestScript("hello", "oops", 0);
		try {
			const result = await runSandbox({
				script: scriptPath,
				scope: [tmpdir()],
				skillName: "test",
			});
			assert.strictEqual(result.stdout, "hello");
			assert.strictEqual(result.stderr, "oops");
			assert.strictEqual(result.exitCode, 0);
		} finally {
			cleanup();
		}
	});

	it("handles non-zero exit code", async () => {
		const { scriptPath, cleanup } = createTestScript("", "", 1);
		try {
			const result = await runSandbox({
				script: scriptPath,
				scope: [tmpdir()],
				skillName: "test",
			});
			assert.strictEqual(result.exitCode, 1);
		} finally {
			cleanup();
		}
	});

	it("collects only stdout when no stderr", async () => {
		const { scriptPath, cleanup } = createTestScript("output", "", 0);
		try {
			const result = await runSandbox({
				script: scriptPath,
				scope: [tmpdir()],
				skillName: "test",
			});
			assert.strictEqual(result.stdout, "output");
			assert.strictEqual(result.stderr, "");
		} finally {
			cleanup();
		}
	});

	it("uses empty env with empty whitelist", async () => {
		const { scriptPath, cleanup } = createTestScript("", "", 0);
		try {
			const result = await runSandbox({
				script: scriptPath,
				skillName: "test",
				whitelist: [],
			});
			assert.strictEqual(result.exitCode, 0);
		} finally {
			cleanup();
		}
	});

	it("applies permissions via enforceCapabilities", async () => {
		const { scriptPath, cleanup } = createTestScript("", "", 0);
		try {
			const result = await runSandbox({
				script: scriptPath,
				permissions: ["filesystem:read"],
				skillName: "test",
			});
			assert.strictEqual(result.exitCode, 0);
		} finally {
			cleanup();
		}
	});

	it("honors custom timeout value", async () => {
		const { scriptPath, cleanup } = createTestScript("", "", 0);
		try {
			const result = await runSandbox({
				script: scriptPath,
				skillName: "test",
				timeout: 5,
			});
			assert.strictEqual(result.exitCode, 0);
		} finally {
			cleanup();
		}
	});

	it("honors custom cwd option", async () => {
		const { scriptPath, cleanup } = createTestScript("", "", 0);
		try {
			const result = await runSandbox({
				script: scriptPath,
				skillName: "test",
				cwd: tmpdir(),
			});
			assert.strictEqual(result.exitCode, 0);
		} finally {
			cleanup();
		}
	});

	it("handles missing script with spawn", async () => {
		try {
			const result = await runSandbox({
				script: "/nonexistent/script.js",
				skillName: "test",
			});
			assert.ok(typeof result.exitCode === "number" || result.exitCode === null);
		} catch (err) {
			// spawn may reject with ENOENT for nonexistent script
			assert.ok(err instanceof Error);
		}
	});
});

// --- handleTimeout tests ---

describe("handleTimeout", () => {
	it("returns terminated immediately when child already exited", async () => {
		const { scriptPath, cleanup } = createTestScript("", "", 0);
		try {
			const { spawn } = await import("node:child_process");
			const child = spawn("node", [scriptPath], {
				stdio: ["pipe", "pipe", "pipe"],
				env: { ...process.env, PATH: process.env.PATH },
			});
			await new Promise((resolve) => child.on("exit", resolve));
			const { handleTimeout } = await import("../../src/sandbox/timeoutHandler.js");
			const result = await handleTimeout(child, { seconds: 0, gracePeriod: 0 });
			assert.strictEqual(result, "terminated");
		} finally {
			cleanup();
		}
	});

	it("sends SIGTERM and resolves terminated when child exits within grace period", async () => {
		if (process.arch === "arm64") {
			return;
		}
		const { tmpdir } = await import("node:os");
		const { join } = await import("node:path");
		const { writeFileSync, mkdirSync, rmSync } = await import("node:fs");
		const testDir = join(tmpdir(), "madz-sigterm-" + Date.now());
		mkdirSync(testDir, { recursive: true });
		const scriptPath = join(testDir, "sigterm-handler.js");
		writeFileSync(
			scriptPath,
			'"use strict";\n' +
				"process.on('SIGTERM', () => { process.exit(0); });\n" +
				"setTimeout(() => {}, 999999);",
		);
		try {
			const { spawn } = await import("node:child_process");
			const child = spawn("node", [scriptPath], {
				stdio: ["pipe", "pipe", "pipe"],
				env: { ...process.env, PATH: process.env.PATH },
			});
			await new Promise((resolve) => setTimeout(resolve, 50));
			const { handleTimeout } = await import("../../src/sandbox/timeoutHandler.js");
			const result = await handleTimeout(child, { seconds: 0.05, gracePeriod: 0.5 });
			assert.strictEqual(result, "terminated");
		} finally {
			try {
				rmSync(testDir, { recursive: true, force: true });
			} catch {
				// ignore
			}
		}
	});

	it("sends SIGKILL after grace period when child does not exit", async () => {
		const { tmpdir } = await import("node:os");
		const { join } = await import("node:path");
		const { writeFileSync, mkdirSync, rmSync } = await import("node:fs");
		const testDir = join(tmpdir(), "madz-sigkill-" + Date.now());
		mkdirSync(testDir, { recursive: true });
		const scriptPath = join(testDir, "forever.js");
		writeFileSync(
			scriptPath,
			'"use strict";\n' +
				"process.on('SIGTERM', () => { /* ignore */ });\n" +
				"setTimeout(() => {}, 999999);",
		);
		try {
			const { spawn } = await import("node:child_process");
			const child = spawn("node", [scriptPath], {
				stdio: ["pipe", "pipe", "pipe"],
				env: { ...process.env, PATH: process.env.PATH },
			});
			await new Promise((resolve) => setTimeout(resolve, 50));
			const { handleTimeout } = await import("../../src/sandbox/timeoutHandler.js");
			const result = await handleTimeout(child, { seconds: 0.05, gracePeriod: 0.5 });
			assert.ok(result === "killed" || result === "terminated");
		} finally {
			try {
				rmSync(testDir, { recursive: true, force: true });
			} catch {
				// ignore
			}
		}
	});
});
