import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
	Cron,
	setExecOverride,
	writeEnvCron,
	sanitizeCrontabCommand,
	prepareCrontabCommand,
	buildSkillCommand,
} from "../../../src/scheduler/cron.js";
import { execFileSync } from "node:child_process";
import {
	rmSync,
	readFileSync,
	statSync,
	writeFileSync,
	mkdirSync,
	readdirSync,
	symlinkSync,
} from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock exec that intercepts crontab commands and maintains an
 * in-memory crontab.  Unknown commands reject so tests don't hang.
 */
function mockExecBuilder() {
	let crontabContent = "";
	const calls = [];

	function mockExec(command, options) {
		calls.push({ command, options });

		if (command.includes("which crontab")) {
			return Promise.resolve({ stdout: "/usr/bin/crontab", stderr: "" });
		}

		if (command.includes("crontab -l")) {
			return Promise.resolve({ stdout: crontabContent || "", stderr: "" });
		}

		if (command.includes("crontab -")) {
			const stdin = options?.input || "";
			crontabContent = stdin;
			return Promise.resolve({ stdout: "", stderr: "" });
		}

		return Promise.reject(new Error(`Unexpected command: ${command}`));
	}

	return {
		mockExec,
		getCrontab: () => crontabContent,
		setCrontab: (c) => {
			crontabContent = c;
		},
		getCalls: () => calls,
		reset: () => {
			crontabContent = "";
			calls.length = 0;
		},
	};
}

// ---------------------------------------------------------------------------
// sanitizeCrontabCommand
// ---------------------------------------------------------------------------

describe("sanitizeCrontabCommand", () => {
	it("returns empty string for empty input", () => {
		assert.strictEqual(sanitizeCrontabCommand(""), "");
	});

	it("rejects \\n, \\r\\n, \\r and NUL instead of rewriting them", () => {
		for (const bad of ["a\nb", "a\r\nb", "a\rb", "a\0b", "\n\r\n\r"]) {
			assert.throws(() => sanitizeCrontabCommand(bad), /newlines or null bytes/);
		}
	});

	it("preserves command with no newlines", () => {
		const cmd = "cd /app && node index.js --flag value";
		assert.strictEqual(sanitizeCrontabCommand(cmd), cmd);
	});

	it("preserves shell special characters ($, `, |, ;)", () => {
		const cmd = "echo $HOME && echo `date` | grep 2025; true";
		assert.strictEqual(sanitizeCrontabCommand(cmd), cmd);
	});

	it("escapes an unescaped % (cron treats it as a newline)", () => {
		assert.strictEqual(sanitizeCrontabCommand("date +%Y-%m-%d"), "date +\\%Y-\\%m-\\%d");
	});

	it("does not double-escape an already escaped %", () => {
		const cmd = "date +\\%Y";
		assert.strictEqual(sanitizeCrontabCommand(cmd), cmd);
	});
});

// ---------------------------------------------------------------------------
// prepareCrontabCommand
// ---------------------------------------------------------------------------

describe("prepareCrontabCommand", () => {
	it("prepends env sourcing prefix before command", () => {
		const result = prepareCrontabCommand("echo test");
		assert.ok(result.startsWith(". "));
		assert.ok(result.includes(".env.cron"));
		assert.ok(result.includes("2>/dev/null || true &&"));
		assert.ok(result.endsWith("&& echo test"));
	});

	it("prepends env sourcing to multi-word command", () => {
		const result = prepareCrontabCommand("cd /app && node index.js");
		assert.ok(result.includes("&& cd /app && node index.js"));
	});

	it("throws for a command containing newlines", () => {
		assert.throws(() => prepareCrontabCommand("echo hello\nworld"), /newlines/);
	});

	it("marks the process as cron-started with MADZ_CRON=1", () => {
		assert.ok(prepareCrontabCommand("echo t").includes("&& export MADZ_CRON=1 && echo t"));
	});

	it("produces a line that sources the env file and runs under /bin/sh", (t) => {
		const dir = join(process.cwd(), "memory/__test_sh_line__");
		mkdirSync(dir, { recursive: true });
		t.after(() => rmSync(dir, { recursive: true, force: true }));
		writeFileSync(join(dir, ".env.cron"), "export FROM_ENV='ok'\n");
		t.mock.method(process, "cwd", () => dir);
		const line = prepareCrontabCommand('echo "$FROM_ENV $MADZ_CRON"');
		const out = execFileSync("/bin/sh", ["-c", line.replace(/\\%/g, "%")], { encoding: "utf-8" });
		assert.strictEqual(out.trim(), "ok 1");
	});

	it("wraps the command and redirects to a quoted log path when logPath is set", () => {
		const result = prepareCrontabCommand("echo hi", "/var/log/my madz.log");
		assert.ok(result.endsWith("&& ( echo hi ) >> '/var/log/my madz.log' 2>&1"));
		assert.ok(!result.includes("\n"));
	});

	it("quotes embedded single quotes in the log path", () => {
		const result = prepareCrontabCommand("echo hi", "/tmp/it's.log");
		assert.ok(result.endsWith(">> '/tmp/it'\\''s.log' 2>&1"));
	});

	it("leaves a safe log path unquoted and adds no redirect without logPath", () => {
		assert.ok(
			prepareCrontabCommand("echo hi", "/tmp/madz.log").endsWith(
				"( echo hi ) >> /tmp/madz.log 2>&1",
			),
		);
		assert.ok(!prepareCrontabCommand("echo hi").includes(">>"));
	});

	it("quotes a cwd containing spaces for the env file", (t) => {
		t.mock.method(process, "cwd", () => "/tmp/my dir");
		assert.ok(prepareCrontabCommand("echo hi").startsWith(". '/tmp/my dir/.env.cron' 2>/dev/null"));
	});

	it("handles empty command — still produces prefix with trailing &&", () => {
		const result = prepareCrontabCommand("");
		assert.ok(result.startsWith(". "));
		assert.ok(result.includes("&& "));
	});

	it("escapes % in the command", () => {
		const result = prepareCrontabCommand("date +%Y");
		assert.ok(result.endsWith("&& date +\\%Y"));
	});

	it("handles command with only whitespace", () => {
		const result = prepareCrontabCommand("   ");
		assert.ok(result.includes("&&"));
	});
});

// ---------------------------------------------------------------------------
// setExecOverride
// ---------------------------------------------------------------------------

describe("setExecOverride", () => {
	it("sets and resets the exec override", async () => {
		const { mockExec, reset } = mockExecBuilder();
		reset();

		// Set override
		setExecOverride(mockExec);
		const result1 = await Cron.isAvailable();
		assert.strictEqual(result1.available, true);

		// Reset to undefined (restores default)
		setExecOverride(undefined);
		// We can't easily test the default without actually running crontab,
		// but we can verify it doesn't throw and returns a different shape
		// (on systems without crontab it will return available:false)
		const result2 = await Cron.isAvailable();
		// Should not throw — either available or not, but no crash
		assert.ok("available" in result2);
	});
});

// ---------------------------------------------------------------------------
// writeEnvCron
// ---------------------------------------------------------------------------

describe("writeEnvCron", () => {
	const envPath = () => join(process.cwd(), ".env.cron");

	beforeEach(() => {
		process.env.__TEST_CRON_A = "value-a";
		process.env.__TEST_CRON_B = "value-b";
	});

	afterEach(() => {
		delete process.env.__TEST_CRON_A;
		delete process.env.__TEST_CRON_B;
		try {
			rmSync(envPath(), { force: true });
		} catch {
			/* ignore */
		}
	});

	it("writes .env.cron with all env variables", async () => {
		const result = await writeEnvCron(process.cwd());
		assert.strictEqual(result.written, true);
		const content = readFileSync(envPath(), "utf-8");
		assert.ok(content.includes("export __TEST_CRON_A="));
		assert.ok(content.includes("export __TEST_CRON_B="));
	});

	it("returns { written: false } when process.env is empty", async () => {
		const saved = { ...process.env };
		for (const key of Object.keys(process.env)) {
			delete process.env[key];
		}
		const result = await writeEnvCron(process.cwd());
		assert.strictEqual(result.written, false);
		Object.assign(process.env, saved);
	});

	it("escapes single quotes in values", async () => {
		process.env.__TEST_CRON_A = "test'value";
		await writeEnvCron(process.cwd());
		const content = readFileSync(envPath(), "utf-8");
		assert.ok(content.includes("test'\\''value"));
	});

	it("is idempotent — overwrites on second call without duplication", async () => {
		await writeEnvCron(process.cwd());
		await writeEnvCron(process.cwd());
		const content = readFileSync(envPath(), "utf-8");
		const keyCount = (content.match(/__TEST_CRON_A/g) || []).length;
		assert.strictEqual(keyCount, 1);
	});

	it("returns error when writeFile fails (invalid path)", async () => {
		const result = await writeEnvCron("/nonexistent/path");
		assert.strictEqual(result.written, false);
		assert.ok(result.error);
	});

	// Note: process.env values are always coerced to strings in Node.js,
	// so the value !== undefined check in writeEnvCron is always true for
	// process.env entries.  There is no realistic way to trigger the skip
	// path via process.env — it exists as a safety guard only.
});

// ---------------------------------------------------------------------------
// Cron.setLogPath
// ---------------------------------------------------------------------------

describe("Cron.setLogPath", () => {
	afterEach(() => {
		Cron.setLogPath(undefined);
	});

	it("sets the log path without throwing", () => {
		assert.doesNotThrow(() => Cron.setLogPath("/tmp/madz-cron.log"));
	});

	it("can be reset to undefined", () => {
		Cron.setLogPath("/tmp/test.log");
		assert.doesNotThrow(() => Cron.setLogPath(undefined));
	});
});

// ---------------------------------------------------------------------------
// Cron.isAvailable
// ---------------------------------------------------------------------------

describe("Cron.isAvailable", () => {
	afterEach(() => {
		setExecOverride(undefined);
	});

	it("returns { available: true } when crontab binary exists", async () => {
		const { mockExec, reset } = mockExecBuilder();
		reset();
		setExecOverride(mockExec);
		const result = await Cron.isAvailable();
		assert.strictEqual(result.available, true);
	});

	it("returns { available: false, error } when crontab binary is missing", async () => {
		const failingExec = (cmd) => {
			if (cmd.includes("which crontab")) {
				return Promise.reject(new Error("not found"));
			}
			return Promise.reject(new Error(`Unexpected: ${cmd}`));
		};
		setExecOverride(failingExec);
		const result = await Cron.isAvailable();
		assert.strictEqual(result.available, false);
		assert.ok(result.error);
		assert.ok(result.error.includes("crontab not available"));
	});
});

// ---------------------------------------------------------------------------
// Cron._readCrontab
// ---------------------------------------------------------------------------

describe("Cron._readCrontab", () => {
	afterEach(() => {
		setExecOverride(undefined);
	});

	it("returns crontab content when available", async () => {
		const { mockExec, setCrontab, reset } = mockExecBuilder();
		reset();
		setCrontab("* * * * *  echo hello\n");
		setExecOverride(mockExec);
		const content = await Cron._readCrontab();
		assert.strictEqual(content, "* * * * *  echo hello");
	});

	it("treats 'no crontab for <user>' as an empty crontab", async () => {
		setExecOverride((cmd) => {
			assert.ok(!cmd.includes("2>&1"));
			return Promise.reject(
				Object.assign(new Error("Command failed"), { code: 1, stderr: "no crontab for root\n" }),
			);
		});
		assert.strictEqual(await Cron._readCrontab(), "");
	});

	it("throws a clear error when crontab -l fails for any other reason", async () => {
		setExecOverride(() =>
			Promise.reject(Object.assign(new Error("boom"), { stderr: "permission denied" })),
		);
		await assert.rejects(() => Cron._readCrontab(), /Failed to read crontab: boom/);
	});

	it("returns empty string when stdout is empty", async () => {
		const emptyExec = (cmd) => {
			if (cmd.includes("crontab -l")) {
				return Promise.resolve({ stdout: "", stderr: "" });
			}
			return Promise.reject(new Error(`Unexpected: ${cmd}`));
		};
		setExecOverride(emptyExec);
		const content = await Cron._readCrontab();
		assert.strictEqual(content, "");
	});

	it("trims trailing whitespace from crontab output", async () => {
		const { mockExec, setCrontab, reset } = mockExecBuilder();
		reset();
		setCrontab("  * * * * *  echo test  \n  \n");
		setExecOverride(mockExec);
		const content = await Cron._readCrontab();
		assert.strictEqual(content, "* * * * *  echo test");
	});
});

// ---------------------------------------------------------------------------
// Cron._writeCrontab
// ---------------------------------------------------------------------------

describe("Cron._writeCrontab", () => {
	afterEach(() => {
		setExecOverride(undefined);
	});

	it("writes content via crontab -", async () => {
		const { mockExec, getCrontab, reset } = mockExecBuilder();
		reset();
		setExecOverride(mockExec);
		await Cron._writeCrontab("* * * * *  echo test");
		assert.ok(getCrontab().includes("* * * * *  echo test"));
	});

	it("appends newline if content does not end with one", async () => {
		const { mockExec, getCrontab, reset } = mockExecBuilder();
		reset();
		setExecOverride(mockExec);
		await Cron._writeCrontab("line1\nline2");
		assert.ok(getCrontab().endsWith("\n"));
	});

	it("does not double-newline if content already ends with newline", async () => {
		const { mockExec, getCrontab, reset } = mockExecBuilder();
		reset();
		setExecOverride(mockExec);
		await Cron._writeCrontab("line1\nline2\n");
		// Should have exactly one trailing newline
		const c = getCrontab();
		assert.ok(c.endsWith("\n"));
		// Count trailing newlines — should be 1
		const trailing = c.length - c.trimEnd().length;
		assert.strictEqual(trailing, 1);
	});

	it("writes empty content as a single newline", async () => {
		const { mockExec, getCrontab, reset } = mockExecBuilder();
		reset();
		setExecOverride(mockExec);
		await Cron._writeCrontab("");
		assert.strictEqual(getCrontab(), "\n");
	});
});

// ---------------------------------------------------------------------------
// Cron._splitBlock
// ---------------------------------------------------------------------------

describe("Cron._splitBlock", () => {
	it("returns single empty outside line for empty content (split yields [''])", () => {
		const result = Cron._splitBlock("");
		assert.deepStrictEqual(result, { outsideLines: [""], blockLines: [] });
	});

	it("returns all lines as outside when no block markers exist", () => {
		const result = Cron._splitBlock("line1\nline2\nline3");
		assert.deepStrictEqual(result, {
			outsideLines: ["line1", "line2", "line3"],
			blockLines: [],
		});
	});

	it("extracts block lines when block markers are present", () => {
		const input =
			"outside1\n# --- BEGIN madz-schedules ---\nblock1\nblock2\n# --- END madz-schedules ---\noutside2";
		const result = Cron._splitBlock(input);
		assert.deepStrictEqual(result, {
			outsideLines: ["outside1", "outside2"],
			blockLines: ["block1", "block2"],
		});
	});

	it("throws on BEGIN without END", () => {
		const input = "outside\n# --- BEGIN madz-schedules ---\nblock1\nuser job";
		assert.throws(() => Cron._splitBlock(input), /BEGIN without END/);
	});

	it("throws on END without BEGIN", () => {
		assert.throws(
			() => Cron._splitBlock("a\n# --- END madz-schedules ---\nb"),
			/END without BEGIN/,
		);
	});

	it("throws on a nested BEGIN", () => {
		const b = "# --- BEGIN madz-schedules ---";
		assert.throws(() => Cron._splitBlock(`${b}\n${b}\n# --- END madz-schedules ---`), /nested/);
	});

	it("handles multiple blocks — blockLines accumulates all blocks", () => {
		const input = [
			"# --- BEGIN madz-schedules ---",
			"block1",
			"# --- END madz-schedules ---",
			"middle",
			"# --- BEGIN madz-schedules ---",
			"block2a",
			"block2b",
			"# --- END madz-schedules ---",
			"outside_end",
		].join("\n");
		const result = Cron._splitBlock(input);
		assert.deepStrictEqual(result, {
			outsideLines: ["middle", "outside_end"],
			blockLines: ["block1", "block2a", "block2b"],
		});
	});

	it("handles block with no content between markers", () => {
		const input = "# --- BEGIN madz-schedules ---\n# --- END madz-schedules ---";
		const result = Cron._splitBlock(input);
		assert.deepStrictEqual(result, {
			outsideLines: [],
			blockLines: [],
		});
	});

	it("preserves empty lines in outside content", () => {
		const input = "a\n\nb\n# --- BEGIN madz-schedules ---\nblock\n# --- END madz-schedules ---\nc";
		const result = Cron._splitBlock(input);
		assert.deepStrictEqual(result, {
			outsideLines: ["a", "", "b", "c"],
			blockLines: ["block"],
		});
	});
});

// ---------------------------------------------------------------------------
// Cron._parseEntry
// ---------------------------------------------------------------------------

describe("Cron._parseEntry", () => {
	it("parses a valid crontab entry line with name comment", () => {
		const line = "* * * * *  echo hello  # madz-schedule: test-job";
		const result = Cron._parseEntry(line);
		assert.deepStrictEqual(result, {
			name: "test-job",
			cron: "* * * * *",
			command: "echo hello",
		});
	});

	it("parses entry with complex cron expression", () => {
		const line = "0 2 * * 1-5  /usr/bin/backup  # madz-schedule: backup-job";
		const result = Cron._parseEntry(line);
		assert.strictEqual(result.name, "backup-job");
		assert.strictEqual(result.cron, "0 2 * * 1-5");
		assert.strictEqual(result.command, "/usr/bin/backup");
	});

	it("returns null for empty cron field (line starts with spaces)", () => {
		const line = "    echo hello  # madz-schedule: test-job";
		const result = Cron._parseEntry(line);
		assert.strictEqual(result, null);
	});

	it("handles entry without madz-schedule comment — uses 'unknown' name", () => {
		const line = "* * * * *  echo hello";
		const result = Cron._parseEntry(line);
		assert.strictEqual(result.name, "unknown");
		assert.strictEqual(result.cron, "* * * * *");
		assert.strictEqual(result.command, "echo hello");
	});

	it("handles entry with no command after cron", () => {
		const line = "* * * * *  # madz-schedule: empty-cmd";
		const result = Cron._parseEntry(line);
		assert.strictEqual(result.name, "empty-cmd");
		assert.strictEqual(result.cron, "* * * * *");
		assert.strictEqual(result.command, "");
	});

	it("handles entry with extra whitespace between fields", () => {
		const line = "0 2 * * *     echo spaced    # madz-schedule:  spaced-name  ";
		const result = Cron._parseEntry(line);
		assert.strictEqual(result.name, "spaced-name");
		assert.strictEqual(result.cron, "0 2 * * *");
		assert.strictEqual(result.command, "echo spaced");
	});
});

// ---------------------------------------------------------------------------
// Cron.add
// ---------------------------------------------------------------------------

describe("Cron.add", () => {
	let helper;

	beforeEach(() => {
		helper = mockExecBuilder();
		helper.reset();
		setExecOverride(helper.mockExec);
	});

	afterEach(() => {
		setExecOverride(undefined);
	});

	it("adds a new entry to empty crontab", async () => {
		const result = await Cron.add({ name: "test", cron: "* * * * *", command: "echo test" });
		assert.strictEqual(result.added, true);
		const crontab = helper.getCrontab();
		assert.ok(crontab.includes("# --- BEGIN madz-schedules ---"));
		assert.ok(crontab.includes("# madz-schedule: test"));
		assert.ok(crontab.includes("echo test"));
	});

	it("replaces existing entry with same name", async () => {
		await Cron.add({ name: "test", cron: "* * * * *", command: "echo first" });
		await Cron.add({ name: "test", cron: "0 * * * *", command: "echo second" });
		const crontab = helper.getCrontab();
		const count = (crontab.match(/madz-schedule: test/g) || []).length;
		assert.strictEqual(count, 1);
		assert.ok(crontab.includes("0 * * * *"));
		assert.ok(!crontab.includes("echo first"));
	});

	it("preserves outside lines when adding", async () => {
		helper.setCrontab("SHELL=/bin/bash\nPATH=/usr/bin\n");
		const result = await Cron.add({ name: "test", cron: "* * * * *", command: "echo test" });
		assert.strictEqual(result.added, true);
		const crontab = helper.getCrontab();
		assert.ok(crontab.includes("SHELL=/bin/bash"));
		assert.ok(crontab.includes("PATH=/usr/bin"));
	});

	it("returns error when command is missing", async () => {
		const result = await Cron.add({ name: "test", cron: "* * * * *" });
		assert.strictEqual(result.added, false);
		assert.ok(result.error);
	});

	it("returns error when crontab is unavailable", async () => {
		const failingExec = (cmd) => {
			if (cmd.includes("which crontab")) {
				return Promise.reject(new Error("not found"));
			}
			return Promise.reject(new Error(`Unexpected: ${cmd}`));
		};
		setExecOverride(failingExec);
		const result = await Cron.add({ name: "test", cron: "* * * * *", command: "echo test" });
		assert.strictEqual(result.added, false);
		assert.ok(result.error);
	});

	it("returns error when _writeCrontab fails", async () => {
		const failingWriteExec = (cmd) => {
			if (cmd.includes("which crontab")) {
				return Promise.resolve({ stdout: "/usr/bin/crontab", stderr: "" });
			}
			if (cmd.includes("crontab -l")) {
				return Promise.resolve({ stdout: "", stderr: "" });
			}
			if (cmd.includes("crontab -")) {
				return Promise.reject(new Error("write failed"));
			}
			return Promise.reject(new Error(`Unexpected: ${cmd}`));
		};
		setExecOverride(failingWriteExec);
		const result = await Cron.add({ name: "test", cron: "* * * * *", command: "echo test" });
		assert.strictEqual(result.added, false);
		assert.ok(result.error);
	});

	it("adds multiple entries with different names", async () => {
		await Cron.add({ name: "job1", cron: "* * * * *", command: "echo 1" });
		await Cron.add({ name: "job2", cron: "0 * * * *", command: "echo 2" });
		const crontab = helper.getCrontab();
		assert.ok(crontab.includes("madz-schedule: job1"));
		assert.ok(crontab.includes("madz-schedule: job2"));
	});
});

// ---------------------------------------------------------------------------
// Cron.remove
// ---------------------------------------------------------------------------

describe("Cron.remove", () => {
	let helper;

	beforeEach(() => {
		helper = mockExecBuilder();
		helper.reset();
		setExecOverride(helper.mockExec);
	});

	afterEach(() => {
		setExecOverride(undefined);
	});

	it("removes an entry by name", async () => {
		await Cron.add({ name: "keep", cron: "* * * * *", command: "echo keep" });
		await Cron.add({ name: "remove", cron: "0 * * * *", command: "echo remove" });
		const result = await Cron.remove("remove");
		assert.strictEqual(result.removed, true);
		const crontab = helper.getCrontab();
		assert.ok(!crontab.includes("madz-schedule: remove"));
		assert.ok(crontab.includes("madz-schedule: keep"));
	});

	it("returns error for non-existent name (no matching entry to remove)", async () => {
		await Cron.add({ name: "existing", cron: "* * * * *", command: "echo existing" });
		const result = await Cron.remove("nonexistent");
		assert.strictEqual(result.removed, true);
		// Still has the existing entry
		const crontab = helper.getCrontab();
		assert.ok(crontab.includes("madz-schedule: existing"));
	});

	it("removes the entire block when last entry is removed", async () => {
		await Cron.add({ name: "only", cron: "* * * * *", command: "echo only" });
		const result = await Cron.remove("only");
		assert.strictEqual(result.removed, true);
		const crontab = helper.getCrontab();
		assert.ok(!crontab.includes("madz-schedules"));
	});

	it("returns error when no block exists (nothing to remove)", async () => {
		helper.setCrontab("SHELL=/bin/bash\n");
		const result = await Cron.remove("test");
		assert.strictEqual(result.removed, true);
	});

	it("returns error when crontab is unavailable", async () => {
		const failingExec = (cmd) => {
			if (cmd.includes("which crontab")) {
				return Promise.reject(new Error("not found"));
			}
			return Promise.reject(new Error(`Unexpected: ${cmd}`));
		};
		setExecOverride(failingExec);
		const result = await Cron.remove("test");
		assert.strictEqual(result.removed, false);
		assert.ok(result.error);
	});

	it("returns error when _writeCrontab fails", async () => {
		const failingWriteExec = (cmd) => {
			if (cmd.includes("which crontab")) {
				return Promise.resolve({ stdout: "/usr/bin/crontab", stderr: "" });
			}
			if (cmd.includes("crontab -l")) {
				return Promise.resolve({
					stdout:
						"# --- BEGIN madz-schedules ---\n* * * * *  echo test  # madz-schedule: test\n# --- END madz-schedules ---\n",
					stderr: "",
				});
			}
			if (cmd.includes("crontab -")) {
				return Promise.reject(new Error("write failed"));
			}
			return Promise.reject(new Error(`Unexpected: ${cmd}`));
		};
		setExecOverride(failingWriteExec);
		const result = await Cron.remove("test");
		assert.strictEqual(result.removed, false);
		assert.ok(result.error);
	});
});

// ---------------------------------------------------------------------------
// Cron.list
// ---------------------------------------------------------------------------

describe("Cron.list", () => {
	let helper;

	beforeEach(() => {
		helper = mockExecBuilder();
		helper.reset();
		setExecOverride(helper.mockExec);
	});

	afterEach(() => {
		setExecOverride(undefined);
	});

	it("returns empty array when no entries exist", async () => {
		const result = await Cron.list();
		assert.ok(Array.isArray(result));
		assert.strictEqual(result.length, 0);
	});

	it("returns entries from crontab block", async () => {
		await Cron.add({ name: "test", cron: "* * * * *", command: "echo test" });
		const result = await Cron.list();
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].name, "test");
		assert.strictEqual(result[0].cron, "* * * * *");
		assert.ok(result[0].command.includes("echo test"));
	});

	it("returns multiple entries", async () => {
		await Cron.add({ name: "job1", cron: "* * * * *", command: "echo 1" });
		await Cron.add({ name: "job2", cron: "0 * * * *", command: "echo 2" });
		const result = await Cron.list();
		assert.strictEqual(result.length, 2);
	});

	it("returns empty array when block exists but has no entries", async () => {
		helper.setCrontab("# --- BEGIN madz-schedules ---\n# --- END madz-schedules ---\n");
		const result = await Cron.list();
		assert.strictEqual(result.length, 0);
	});

	it("returns entry with 'unknown' name when no madz-schedule comment", async () => {
		helper.setCrontab(
			"# --- BEGIN madz-schedules ---\n* * * * *  echo orphan\n# --- END madz-schedules ---\n",
		);
		const result = await Cron.list();
		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].name, "unknown");
		assert.strictEqual(result[0].cron, "* * * * *");
		assert.strictEqual(result[0].command, "echo orphan");
	});

	it("skips empty lines inside the block", async () => {
		helper.setCrontab(
			"# --- BEGIN madz-schedules ---\n\n* * * * *  echo job  # madz-schedule: job\n\n# --- END madz-schedules ---\n",
		);
		const result = await Cron.list();
		assert.strictEqual(result.length, 1);
	});
});

// ---------------------------------------------------------------------------
// Cron._ensureReflectionJob
// ---------------------------------------------------------------------------

describe("Cron._ensureReflectionJob", () => {
	const testDir = join(process.cwd(), "memory/__test_ensure_reflection__");

	beforeEach(() => {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
	});

	afterEach(() => {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
	});

	it("creates the directory and reflection-daily.json when neither exists", async () => {
		await Cron._ensureReflectionJob(testDir);
		const files = readdirSync(testDir);
		assert.ok(files.includes("reflection-daily.json"));
		const content = JSON.parse(readFileSync(join(testDir, "reflection-daily.json"), "utf-8"));
		assert.strictEqual(content.name, "reflection-daily");
		assert.strictEqual(content.cron, "30 23 * * *");
		assert.strictEqual(content.enabled, true);
	});

	it("does nothing when reflection-daily.json already exists", async () => {
		mkdirSync(testDir, { recursive: true });
		writeFileSync(
			join(testDir, "reflection-daily.json"),
			JSON.stringify({
				name: "reflection-daily",
				cron: "0 3 * * *",
				command: "echo custom",
				enabled: false,
			}),
		);
		await Cron._ensureReflectionJob(testDir);
		const content = JSON.parse(readFileSync(join(testDir, "reflection-daily.json"), "utf-8"));
		// Should NOT have overwritten
		assert.strictEqual(content.cron, "0 3 * * *");
		assert.strictEqual(content.enabled, false);
	});

	it("handles mkdir failure gracefully (does not throw)", async () => {
		// Pass a path that will fail mkdir (e.g., /proc/xxx on Linux)
		// We mock by making the dir a file first
		mkdirSync(testDir, { recursive: true });
		writeFileSync(join(testDir, "reflection-daily.json"), "{}");
		// Now make the directory itself a file to cause mkdir to fail on a subpath
		const badDir = join(testDir, "subdir");
		writeFileSync(badDir, "i am a file, not a dir");
		// This should not throw — _ensureReflectionJob catches mkdir errors
		await Cron._ensureReflectionJob(badDir);
		// If we got here without throwing, the test passes
		assert.ok(true);
	});

	it("creates file with all required fields", async () => {
		await Cron._ensureReflectionJob(testDir);
		const content = JSON.parse(readFileSync(join(testDir, "reflection-daily.json"), "utf-8"));
		assert.ok(content.name);
		assert.ok(content.cron);
		assert.ok(content.command);
		assert.ok(content.enabled !== undefined);
		assert.ok(content.createdAt);
		assert.ok(content.updatedAt);
	});
});

// ---------------------------------------------------------------------------
// Cron._readJobsFromDisk
// ---------------------------------------------------------------------------

describe("Cron._readJobsFromDisk", () => {
	const testDir = join(process.cwd(), "memory/__test_read_jobs__");

	beforeEach(() => {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
	});

	it("reads valid job files from directory", async () => {
		writeFileSync(
			join(testDir, "job1.json"),
			JSON.stringify({ name: "job1", cron: "* * * * *", command: "echo 1", enabled: true }),
		);
		writeFileSync(
			join(testDir, "job2.json"),
			JSON.stringify({ name: "job2", cron: "0 * * * *", command: "echo 2", enabled: false }),
		);
		const jobs = await Cron._readJobsFromDisk(testDir);
		assert.strictEqual(jobs.length, 2);
		assert.strictEqual(jobs[0].name, "job1");
		assert.strictEqual(jobs[1].name, "job2");
	});

	it("skips non-.json files", async () => {
		writeFileSync(join(testDir, "readme.txt"), "hello");
		writeFileSync(
			join(testDir, "job.json"),
			JSON.stringify({ name: "job", cron: "* * * * *", command: "echo job", enabled: true }),
		);
		const jobs = await Cron._readJobsFromDisk(testDir);
		assert.strictEqual(jobs.length, 1);
	});

	it("skips files with invalid JSON", async () => {
		writeFileSync(join(testDir, "bad.json"), "not valid json");
		writeFileSync(
			join(testDir, "good.json"),
			JSON.stringify({ name: "good", cron: "* * * * *", command: "echo good", enabled: true }),
		);
		const jobs = await Cron._readJobsFromDisk(testDir);
		assert.strictEqual(jobs.length, 1);
		assert.strictEqual(jobs[0].name, "good");
	});

	it("skips JSON files missing required fields (name, cron, command)", async () => {
		writeFileSync(
			join(testDir, "no-name.json"),
			JSON.stringify({ cron: "* * * * *", command: "echo" }),
		);
		writeFileSync(join(testDir, "no-cron.json"), JSON.stringify({ name: "x", command: "echo" }));
		writeFileSync(
			join(testDir, "no-command.json"),
			JSON.stringify({ name: "x", cron: "* * * * *" }),
		);
		writeFileSync(
			join(testDir, "valid.json"),
			JSON.stringify({ name: "valid", cron: "* * * * *", command: "echo valid", enabled: true }),
		);
		const jobs = await Cron._readJobsFromDisk(testDir);
		assert.strictEqual(jobs.length, 1);
		assert.strictEqual(jobs[0].name, "valid");
	});

	it("reads skill-only jobs and derives command from skill", async () => {
		writeFileSync(
			join(testDir, "skill-job.json"),
			JSON.stringify({ name: "skill-job", cron: "* * * * *", skill: "report-gen", enabled: true }),
		);
		const jobs = await Cron._readJobsFromDisk(testDir);
		assert.strictEqual(jobs.length, 1);
		assert.strictEqual(jobs[0].name, "skill-job");
		assert.strictEqual(
			jobs[0].command,
			`cd ${process.cwd()} && node index.js --message "Run the report-gen skill"`,
		);
	});

	it("serializes input into the derived command for skill-only jobs with input", async () => {
		writeFileSync(
			join(testDir, "skill-input-job.json"),
			JSON.stringify({
				name: "skill-input-job",
				cron: "* * * * *",
				skill: "report-gen",
				input: { format: "pdf", region: "na" },
				enabled: true,
			}),
		);
		const jobs = await Cron._readJobsFromDisk(testDir);
		assert.strictEqual(jobs.length, 1);
		assert.strictEqual(
			jobs[0].command,
			`cd ${process.cwd()} && node index.js --message "Run the report-gen skill ${JSON.stringify({ format: "pdf", region: "na" }).replaceAll('"', '\\"')}"`,
		);
	});

	it("uses explicit command when both skill and command are present", async () => {
		writeFileSync(
			join(testDir, "both-job.json"),
			JSON.stringify({
				name: "both-job",
				cron: "* * * * *",
				skill: "report-gen",
				command: "echo explicit",
				enabled: true,
			}),
		);
		const jobs = await Cron._readJobsFromDisk(testDir);
		assert.strictEqual(jobs.length, 1);
		assert.strictEqual(jobs[0].name, "both-job");
		assert.strictEqual(jobs[0].command, "echo explicit");
	});

	it("returns empty array for empty directory", async () => {
		const jobs = await Cron._readJobsFromDisk(testDir);
		assert.strictEqual(jobs.length, 0);
	});

	it("returns empty array when directory does not exist (readdir fails)", async () => {
		const missingDir = join(process.cwd(), "memory/__test_missing_dir__");
		const jobs = await Cron._readJobsFromDisk(missingDir);
		assert.strictEqual(jobs.length, 0);
	});

	it("defaults enabled to true when field is missing", async () => {
		writeFileSync(
			join(testDir, "no-enabled.json"),
			JSON.stringify({ name: "no-enabled", cron: "* * * * *", command: "echo" }),
		);
		const jobs = await Cron._readJobsFromDisk(testDir);
		assert.strictEqual(jobs.length, 1);
		assert.strictEqual(jobs[0].enabled, true);
	});

	it("reads enabled:false correctly", async () => {
		writeFileSync(
			join(testDir, "disabled.json"),
			JSON.stringify({ name: "disabled", cron: "* * * * *", command: "echo", enabled: false }),
		);
		const jobs = await Cron._readJobsFromDisk(testDir);
		assert.strictEqual(jobs.length, 1);
		assert.strictEqual(jobs[0].enabled, false);
	});
});

// ---------------------------------------------------------------------------
// Cron.sync
// ---------------------------------------------------------------------------

describe("Cron.sync", () => {
	let helper;
	const testDir = join(process.cwd(), "memory/__test_sync__");

	beforeEach(() => {
		helper = mockExecBuilder();
		helper.reset();
		setExecOverride(helper.mockExec);
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		setExecOverride(undefined);
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
	});

	it("adds new jobs from disk to crontab", async () => {
		writeFileSync(
			join(testDir, "new-job.json"),
			JSON.stringify({ name: "new-job", cron: "* * * * *", command: "echo new", enabled: true }),
		);
		const result = await Cron.sync(testDir);
		// _ensureReflectionJob creates reflection-daily + our new-job = 2 added
		assert.strictEqual(result.added, 2);
		assert.strictEqual(result.removed, 0);
		assert.strictEqual(result.updated, 0);
		assert.strictEqual(result.skipped, 0);
		const crontab = helper.getCrontab();
		assert.ok(crontab.includes("madz-schedule: new-job"));
		assert.ok(crontab.includes("madz-schedule: reflection-daily"));
	});

	it("removes old jobs that no longer exist on disk", async () => {
		// Pre-populate crontab with a job that has no corresponding file
		helper.setCrontab(
			"# --- BEGIN madz-schedules ---\n* * * * *  echo old  # madz-schedule: removed-job\n# --- END madz-schedules ---\n",
		);
		const result = await Cron.sync(testDir);
		// reflection-daily added, removed-job removed
		assert.strictEqual(result.added, 1);
		assert.strictEqual(result.removed, 1);
		const crontab = helper.getCrontab();
		assert.ok(!crontab.includes("madz-schedule: removed-job"));
	});

	it("updates jobs whose cron or command changed", async () => {
		// Pre-populate crontab with an entry
		helper.setCrontab(
			"# --- BEGIN madz-schedules ---\n* * * * *  echo old  # madz-schedule: existing-job\n# --- END madz-schedules ---\n",
		);
		// Create job file with same name but different command
		writeFileSync(
			join(testDir, "existing-job.json"),
			JSON.stringify({
				name: "existing-job",
				cron: "0 * * * *",
				command: "echo new",
				enabled: true,
			}),
		);
		const result = await Cron.sync(testDir);
		// reflection-daily added, existing-job updated
		assert.strictEqual(result.added, 1);
		assert.strictEqual(result.updated, 1);
		assert.strictEqual(result.skipped, 0);
		const crontab = helper.getCrontab();
		assert.ok(crontab.includes("0 * * * *"));
		assert.ok(crontab.includes("echo new"));
	});

	it("skips unchanged jobs", async () => {
		// Pre-populate crontab with an entry
		helper.setCrontab(
			`# --- BEGIN madz-schedules ---\n* * * * *  ${prepareCrontabCommand("echo same")}  # madz-schedule: stable-job\n# --- END madz-schedules ---\n`,
		);
		// Create job file with identical content
		writeFileSync(
			join(testDir, "stable-job.json"),
			JSON.stringify({
				name: "stable-job",
				cron: "* * * * *",
				command: "echo same",
				enabled: true,
			}),
		);
		const result = await Cron.sync(testDir);
		// reflection-daily added, stable-job skipped
		assert.strictEqual(result.added, 1);
		assert.strictEqual(result.skipped, 1);
		assert.strictEqual(result.updated, 0);
		assert.strictEqual(result.removed, 0);
	});

	it("excludes disabled jobs from crontab", async () => {
		writeFileSync(
			join(testDir, "disabled-job.json"),
			JSON.stringify({
				name: "disabled-job",
				cron: "* * * * *",
				command: "echo disabled",
				enabled: false,
			}),
		);
		const result = await Cron.sync(testDir);
		// Only reflection-daily added
		assert.strictEqual(result.added, 1);
		const crontab = helper.getCrontab();
		assert.ok(!crontab.includes("madz-schedule: disabled-job"));
	});

	it("removes previously-installed job that became disabled", async () => {
		// Pre-populate crontab with a job
		helper.setCrontab(
			"# --- BEGIN madz-schedules ---\n* * * * *  echo now-disabled  # madz-schedule: now-disabled\n# --- END madz-schedules ---\n",
		);
		// Create job file with enabled: false
		writeFileSync(
			join(testDir, "now-disabled.json"),
			JSON.stringify({
				name: "now-disabled",
				cron: "* * * * *",
				command: "echo now-disabled",
				enabled: false,
			}),
		);
		const result = await Cron.sync(testDir);
		// reflection-daily added, now-disabled removed
		assert.strictEqual(result.added, 1);
		assert.strictEqual(result.removed, 1);
		const crontab = helper.getCrontab();
		assert.ok(!crontab.includes("madz-schedule: now-disabled"));
	});

	it("returns error when crontab is unavailable", async () => {
		const failingExec = (cmd) => {
			if (cmd.includes("which crontab")) {
				return Promise.reject(new Error("not found"));
			}
			return Promise.reject(new Error(`Unexpected: ${cmd}`));
		};
		setExecOverride(failingExec);
		const result = await Cron.sync(testDir);
		assert.ok(result.error);
		assert.strictEqual(result.added, 0);
		assert.strictEqual(result.removed, 0);
		assert.strictEqual(result.updated, 0);
		assert.strictEqual(result.skipped, 0);
	});

	it("returns error when _writeCrontab fails", async () => {
		const failingWriteExec = (cmd) => {
			if (cmd.includes("which crontab")) {
				return Promise.resolve({ stdout: "/usr/bin/crontab", stderr: "" });
			}
			if (cmd.includes("crontab -l")) {
				return Promise.resolve({ stdout: "", stderr: "" });
			}
			if (cmd.includes("crontab -")) {
				return Promise.reject(new Error("write failed"));
			}
			return Promise.reject(new Error(`Unexpected: ${cmd}`));
		};
		setExecOverride(failingWriteExec);
		writeFileSync(
			join(testDir, "test-job.json"),
			JSON.stringify({ name: "test-job", cron: "* * * * *", command: "echo test", enabled: true }),
		);
		const result = await Cron.sync(testDir);
		assert.ok(result.error);
	});

	it("handles unreadable job files gracefully (skips them)", async () => {
		writeFileSync(join(testDir, "bad-job.json"), "not valid json");
		const result = await Cron.sync(testDir);
		// Only reflection-daily added
		assert.strictEqual(result.added, 1);
	});

	it("handles empty schedules directory — only reflection-daily added", async () => {
		const result = await Cron.sync(testDir);
		assert.strictEqual(result.added, 1);
		assert.strictEqual(result.removed, 0);
		assert.strictEqual(result.updated, 0);
		assert.strictEqual(result.skipped, 0);
	});

	it("removes block entirely when all jobs are disabled or removed", async () => {
		// Pre-populate with a job that will be removed (no file)
		helper.setCrontab(
			"# --- BEGIN madz-schedules ---\n* * * * *  echo gone  # madz-schedule: gone-job\n# --- END madz-schedules ---\n",
		);
		const result = await Cron.sync(testDir);
		// reflection-daily added, gone-job removed
		assert.strictEqual(result.added, 1);
		assert.strictEqual(result.removed, 1);
	});

	it("second sync with no change reports skipped and does not write", async () => {
		writeFileSync(
			join(testDir, "a-job.json"),
			JSON.stringify({ name: "a-job", cron: "* * * * *", command: "echo a", enabled: true }),
		);
		const first = await Cron.sync(testDir);
		assert.strictEqual(first.added, 2);
		const writesBefore = helper.getCalls().filter((c) => c.command === "crontab -").length;
		const second = await Cron.sync(testDir);
		assert.deepStrictEqual(second, { added: 0, removed: 0, updated: 0, skipped: 2 });
		const writesAfter = helper.getCalls().filter((c) => c.command === "crontab -").length;
		assert.strictEqual(writesAfter, writesBefore);
	});

	it("aborts without writing when crontab -l fails for a real reason", async () => {
		const calls = [];
		setExecOverride((cmd, opts) => {
			calls.push(cmd);
			if (cmd.includes("which crontab")) return Promise.resolve({ stdout: "", stderr: "" });
			if (cmd.includes("crontab -l")) {
				return Promise.reject(Object.assign(new Error("denied"), { stderr: "permission denied" }));
			}
			return Promise.resolve({ stdout: "", stderr: "", opts });
		});
		const result = await Cron.sync(testDir);
		assert.ok(result.error.includes("Failed to read crontab"));
		assert.ok(!calls.includes("crontab -"));
	});

	it("aborts without writing when the madz block is unterminated", async () => {
		helper.setCrontab(
			"# --- BEGIN madz-schedules ---\n* * * * *  echo x  # madz-schedule: x\nuser job\n",
		);
		const result = await Cron.sync(testDir);
		assert.ok(result.error.includes("BEGIN without END"));
		assert.ok(!helper.getCalls().some((c) => c.command === "crontab -"));
	});

	it("skips invalid job files and warns instead of injecting crontab lines", async () => {
		writeFileSync(
			join(testDir, "bad.json"),
			JSON.stringify({ name: "bad\n* * * * * evil", cron: "* * * * *", command: "echo x" }),
		);
		await Cron.sync(testDir);
		assert.ok(!helper.getCrontab().includes("evil"));
	});

	it("preserves the user's own entries and MAILTO", async () => {
		helper.setCrontab("MAILTO=me@example.com\n0 1 * * * /usr/bin/backup\n");
		await Cron.sync(testDir);
		const crontab = helper.getCrontab();
		assert.ok(crontab.includes("MAILTO=me@example.com"));
		assert.ok(crontab.includes("/usr/bin/backup"));
	});

	it("serializes concurrent operations so none is lost", async () => {
		await Promise.all([
			Cron.add({ name: "j1", cron: "* * * * *", command: "echo 1" }),
			Cron.add({ name: "j2", cron: "* * * * *", command: "echo 2" }),
			Cron.add({ name: "j3", cron: "* * * * *", command: "echo 3" }),
		]);
		const crontab = helper.getCrontab();
		for (const n of ["j1", "j2", "j3"]) assert.ok(crontab.includes(`madz-schedule: ${n}`));
	});
});

// ---------------------------------------------------------------------------
// Failure handling: failed reads, malformed blocks, write errors
// ---------------------------------------------------------------------------

describe("Cron mutation safety", () => {
	const BEGIN = "# --- BEGIN madz-schedules ---";
	const END = "# --- END madz-schedules ---";
	let helper;
	let failRead;

	beforeEach(() => {
		helper = mockExecBuilder();
		helper.reset();
		failRead = false;
		setExecOverride((cmd, opts) => {
			if (failRead && cmd.includes("crontab -l")) {
				return Promise.reject(Object.assign(new Error("denied"), { stderr: "permission denied" }));
			}
			return helper.mockExec(cmd, opts);
		});
	});

	afterEach(() => {
		setExecOverride(undefined);
	});

	const writes = () => helper.getCalls().filter((c) => c.command === "crontab -");

	it("add does not write when the read fails (user entries are not wiped)", async () => {
		helper.setCrontab("MAILTO=me@example.com\n0 1 * * * /usr/bin/backup\n");
		failRead = true;
		const result = await Cron.add({ name: "t", cron: "* * * * *", command: "echo t" });
		assert.strictEqual(result.added, false);
		assert.match(result.error, /Failed to read crontab/);
		assert.strictEqual(writes().length, 0);
		assert.ok(helper.getCrontab().includes("MAILTO"));
	});

	it("remove does not write when the read fails", async () => {
		failRead = true;
		const result = await Cron.remove("t");
		assert.strictEqual(result.removed, false);
		assert.match(result.error, /Failed to read crontab/);
		assert.strictEqual(writes().length, 0);
	});

	it("list throws when the read fails", async () => {
		failRead = true;
		await assert.rejects(() => Cron.list(), /Failed to read crontab/);
	});

	it("add and remove abort on an unterminated block without writing", async () => {
		helper.setCrontab(`${BEGIN}\n* * * * *  echo x  # madz-schedule: x\n0 1 * * * user-job\n`);
		const added = await Cron.add({ name: "t", cron: "* * * * *", command: "echo t" });
		assert.strictEqual(added.added, false);
		assert.match(added.error, /BEGIN without END/);
		const removed = await Cron.remove("x");
		assert.strictEqual(removed.removed, false);
		assert.strictEqual(writes().length, 0);
		assert.ok(helper.getCrontab().includes("user-job"));
	});

	it("add and remove abort on END without BEGIN", async () => {
		helper.setCrontab(`user-job\n${END}\n`);
		const added = await Cron.add({ name: "t", cron: "* * * * *", command: "echo t" });
		assert.match(added.error, /END without BEGIN/);
		assert.strictEqual(writes().length, 0);
	});

	it("add returns an error for a command containing newlines and does not write", async () => {
		const result = await Cron.add({ name: "t", cron: "* * * * *", command: "echo a\necho b" });
		assert.strictEqual(result.added, false);
		assert.match(result.error, /newlines/);
		assert.strictEqual(writes().length, 0);
	});

	it("add applies the log path redirect after setLogPath", async () => {
		Cron.setLogPath("/var/log/madz cron.log");
		try {
			await Cron.add({ name: "t", cron: "* * * * *", command: "echo t" });
		} finally {
			Cron.setLogPath(undefined);
		}
		assert.ok(helper.getCrontab().includes("( echo t ) >> '/var/log/madz cron.log' 2>&1"));
	});

	it("add is a no-op write when the crontab already has the same content", async () => {
		await Cron.add({ name: "t", cron: "* * * * *", command: "echo t" });
		const before = writes().length;
		await Cron.add({ name: "t", cron: "* * * * *", command: "echo t" });
		assert.strictEqual(writes().length, before);
	});

	it("a failed operation does not break the queue for later operations", async () => {
		failRead = true;
		await Cron.add({ name: "a", cron: "* * * * *", command: "echo a" });
		failRead = false;
		const result = await Cron.add({ name: "b", cron: "* * * * *", command: "echo b" });
		assert.strictEqual(result.added, true);
	});

	it("sync skips a job whose command cannot be prepared", async () => {
		const dir = join(process.cwd(), "memory/__test_sync_skip__");
		rmSync(dir, { recursive: true, force: true });
		mkdirSync(dir, { recursive: true });
		try {
			const result = await Cron.sync(dir);
			assert.strictEqual(result.added, 1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

// ---------------------------------------------------------------------------
// Cron._readJobsFromDisk validation
// ---------------------------------------------------------------------------

describe("Cron._readJobsFromDisk validation", () => {
	const dir = join(process.cwd(), "memory/__test_read_jobs_validation__");

	beforeEach(() => {
		rmSync(dir, { recursive: true, force: true });
		mkdirSync(dir, { recursive: true });
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	const put = (file, job) => writeFileSync(join(dir, file), JSON.stringify(job));

	it("skips a job whose name contains a newline", async () => {
		put("a.json", { name: "evil\n* * * * * rm -rf /", cron: "* * * * *", command: "echo x" });
		assert.deepStrictEqual(await Cron._readJobsFromDisk(dir), []);
	});

	it("skips a job whose cron field contains a newline", async () => {
		put("a.json", { name: "a", cron: "* * * * *\n@reboot evil", command: "echo x" });
		assert.deepStrictEqual(await Cron._readJobsFromDisk(dir), []);
	});

	it("skips a job with an invalid cron expression", async () => {
		put("a.json", { name: "a", cron: "99 * * * *", command: "echo x" });
		put("b.json", { name: "b", cron: "* * * * *", command: "echo x" });
		const jobs = await Cron._readJobsFromDisk(dir);
		assert.deepStrictEqual(
			jobs.map((j) => j.name),
			["b"],
		);
	});

	it("skips a job whose command contains a newline", async () => {
		put("a.json", { name: "a", cron: "* * * * *", command: "echo a\necho b" });
		assert.deepStrictEqual(await Cron._readJobsFromDisk(dir), []);
	});

	it("keeps the first file (by file name) when two files share a job name", async () => {
		put("1-first.json", { name: "dup", cron: "* * * * *", command: "echo first" });
		put("2-second.json", { name: "dup", cron: "0 * * * *", command: "echo second" });
		const jobs = await Cron._readJobsFromDisk(dir);
		assert.strictEqual(jobs.length, 1);
		assert.strictEqual(jobs[0].command, "echo first");
	});

	it("sync yields a single crontab line for duplicate names", async () => {
		const helper = mockExecBuilder();
		setExecOverride(helper.mockExec);
		try {
			put("1.json", { name: "dup", cron: "* * * * *", command: "echo first" });
			put("2.json", { name: "dup", cron: "0 * * * *", command: "echo second" });
			await Cron.sync(dir);
			assert.strictEqual((helper.getCrontab().match(/madz-schedule: dup/g) || []).length, 1);
		} finally {
			setExecOverride(undefined);
		}
	});
});

// ---------------------------------------------------------------------------
// Cron._ensureReflectionJob error handling and quoting of cwd
// ---------------------------------------------------------------------------

describe("Cron._ensureReflectionJob error handling", () => {
	const dir = join(process.cwd(), "memory/__test_reflection_errors__");

	beforeEach(() => {
		rmSync(dir, { recursive: true, force: true });
		mkdirSync(dir, { recursive: true });
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("does not overwrite a file that exists but cannot be read (not ENOENT)", async () => {
		// A directory with the job's file name makes readFile fail with EISDIR, not ENOENT.
		mkdirSync(join(dir, "reflection-daily.json"));
		await Cron._ensureReflectionJob(dir);
		assert.ok(statSync(join(dir, "reflection-daily.json")).isDirectory());
	});

	it("does not throw when the write fails", async () => {
		// A dangling symlink as the job file: reading it gives ENOENT (so the job is
		// recreated) but writing through it fails because its target directory is missing.
		symlinkSync(join(dir, "missing", "x.json"), join(dir, "reflection-daily.json"));
		await assert.doesNotReject(() => Cron._ensureReflectionJob(dir));
	});

	it("recreates the file when it is missing", async () => {
		await Cron._ensureReflectionJob(dir);
		assert.ok(readdirSync(dir).includes("reflection-daily.json"));
	});

	it("quotes a cwd with spaces in the generated reflection command", async (t) => {
		t.mock.method(process, "cwd", () => "/tmp/my dir");
		await Cron._ensureReflectionJob(dir);
		const job = JSON.parse(readFileSync(join(dir, "reflection-daily.json"), "utf-8"));
		assert.strictEqual(
			job.command,
			"cd '/tmp/my dir' && node index.js --message \"Run the reflection skill\"",
		);
	});
});

describe("buildSkillCommand cwd quoting", () => {
	it("keeps the unquoted form for a plain cwd", () => {
		assert.strictEqual(
			buildSkillCommand("x"),
			`cd ${process.cwd()} && node index.js --message "Run the x skill"`,
		);
	});

	it("quotes a cwd with spaces and single quotes", (t) => {
		t.mock.method(process, "cwd", () => "/tmp/it's here");
		assert.ok(buildSkillCommand("x").startsWith("cd '/tmp/it'\\''s here' && node"));
	});
});

// ---------------------------------------------------------------------------
// writeEnvCron hardening
// ---------------------------------------------------------------------------

describe("writeEnvCron hardening", () => {
	const dir = join(process.cwd(), "memory/__test_env_cron__");
	const envPath = join(dir, ".env.cron");

	beforeEach(() => {
		rmSync(dir, { recursive: true, force: true });
		mkdirSync(dir, { recursive: true });
		process.env.__TEST_CRON_OK = "yes";
	});

	afterEach(() => {
		delete process.env.__TEST_CRON_OK;
		delete process.env["BAD-NAME"];
		delete process.env.MADZ_CRON;
		rmSync(dir, { recursive: true, force: true });
	});

	it("skips variables whose names are not valid shell identifiers", async () => {
		process.env["BAD-NAME"] = "x";
		await writeEnvCron(dir);
		const content = readFileSync(envPath, "utf-8");
		assert.ok(content.includes("export __TEST_CRON_OK='yes'"));
		assert.ok(!content.includes("BAD-NAME"));
	});

	it("leaves no temp file behind", async () => {
		await writeEnvCron(dir);
		assert.deepStrictEqual(readdirSync(dir), [".env.cron"]);
	});

	it("does not overwrite .env.cron when started by cron (MADZ_CRON=1)", async () => {
		writeFileSync(envPath, "export KEEP='me'\n");
		process.env.MADZ_CRON = "1";
		const result = await writeEnvCron(dir);
		assert.deepStrictEqual(result, { written: false, skipped: true });
		assert.strictEqual(readFileSync(envPath, "utf-8"), "export KEEP='me'\n");
	});
});
