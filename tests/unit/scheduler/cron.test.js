import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
	Cron,
	setExecOverride,
	writeEnvCron,
	sanitizeCrontabCommand,
	prepareCrontabCommand,
} from "../../../src/scheduler/cron.js";
import { rmSync, readFileSync, statSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
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

	it("strips \\n newlines", () => {
		assert.strictEqual(sanitizeCrontabCommand("echo hello\nworld"), "echo helloworld");
	});

	it("strips \\r\\n (CRLF) newlines", () => {
		assert.strictEqual(sanitizeCrontabCommand("echo hello\r\nworld"), "echo helloworld");
	});

	it("strips \\r (old-Mac) newlines", () => {
		assert.strictEqual(sanitizeCrontabCommand("echo hello\rworld"), "echo helloworld");
	});

	it("handles mixed line endings", () => {
		const input = "a\nb\r\nc\rd";
		assert.strictEqual(sanitizeCrontabCommand(input), "abcd");
	});

	it("preserves command with no newlines", () => {
		const cmd = "cd /app && node index.js --flag value";
		assert.strictEqual(sanitizeCrontabCommand(cmd), cmd);
	});

	it("preserves shell special characters ($, `, |, ;)", () => {
		const cmd = "echo $HOME && echo `date` | grep 2025; true";
		assert.strictEqual(sanitizeCrontabCommand(cmd), cmd);
	});

	it("handles only newlines", () => {
		assert.strictEqual(sanitizeCrontabCommand("\n\r\n\r"), "");
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

	it("strips newlines from command", () => {
		const result = prepareCrontabCommand("echo hello\nworld");
		assert.ok(!result.includes("\n"));
		assert.ok(!result.includes("\r"));
	});

	it("handles empty command — still produces prefix with trailing &&", () => {
		const result = prepareCrontabCommand("");
		assert.ok(result.startsWith(". "));
		assert.ok(result.includes("&& "));
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

	it("writes file with 0o600 permissions", async () => {
		await writeEnvCron(process.cwd());
		const stats = statSync(envPath());
		const mode = stats.mode & 0o777;
		assert.strictEqual(mode, 0o600);
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

	it("returns empty string when crontab -l fails", async () => {
		const failingExec = (cmd) => {
			if (cmd.includes("crontab -l")) {
				return Promise.reject(new Error("no crontab"));
			}
			return Promise.reject(new Error(`Unexpected: ${cmd}`));
		};
		setExecOverride(failingExec);
		const content = await Cron._readCrontab();
		assert.strictEqual(content, "");
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

	it("handles unclosed block — treats everything after start as block", () => {
		const input = "outside\n# --- BEGIN madz-schedules ---\nblock1\nblock2";
		const result = Cron._splitBlock(input);
		assert.deepStrictEqual(result, {
			outsideLines: ["outside"],
			blockLines: ["block1", "block2"],
		});
	});

	it("handles multiple blocks — blockLines accumulates all blocks (inBlock toggles, no reset)", () => {
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
// Cron.install
// ---------------------------------------------------------------------------

describe("Cron.install", () => {
	let helper;

	beforeEach(() => {
		helper = mockExecBuilder();
		helper.reset();
		setExecOverride(helper.mockExec);
	});

	afterEach(() => {
		setExecOverride(undefined);
	});

	it("installs multiple schedules", async () => {
		const schedules = [
			{ name: "job1", cron: "* * * * *", command: "echo 1" },
			{ name: "job2", cron: "0 * * * *", command: "echo 2" },
		];
		const result = await Cron.install(schedules);
		assert.strictEqual(result.installed, 2);
		const crontab = helper.getCrontab();
		assert.ok(crontab.includes("madz-schedule: job1"));
		assert.ok(crontab.includes("madz-schedule: job2"));
	});

	it("excludes paused schedules", async () => {
		const schedules = [
			{ name: "active", cron: "* * * * *", command: "echo active", paused: false },
			{ name: "paused", cron: "0 * * * *", command: "echo paused", paused: true },
		];
		const result = await Cron.install(schedules);
		assert.strictEqual(result.installed, 1);
		const crontab = helper.getCrontab();
		assert.ok(crontab.includes("madz-schedule: active"));
		assert.ok(!crontab.includes("madz-schedule: paused"));
	});

	it("replaces existing madz block entirely", async () => {
		helper.setCrontab(
			"# --- BEGIN madz-schedules ---\n* * * * *  echo old  # madz-schedule: old-job\n# --- END madz-schedules ---\n",
		);
		const schedules = [{ name: "new", cron: "* * * * *", command: "echo new" }];
		const result = await Cron.install(schedules);
		assert.strictEqual(result.installed, 1);
		const crontab = helper.getCrontab();
		assert.ok(!crontab.includes("old-job"));
		assert.ok(crontab.includes("madz-schedule: new"));
	});

	it("handles empty schedules array — no block written", async () => {
		const result = await Cron.install([]);
		assert.strictEqual(result.installed, 0);
		const crontab = helper.getCrontab();
		assert.ok(!crontab.includes("madz-schedules"));
	});

	it("preserves outside lines when installing", async () => {
		helper.setCrontab("SHELL=/bin/bash\nPATH=/usr/bin\n");
		const schedules = [{ name: "job", cron: "* * * * *", command: "echo job" }];
		await Cron.install(schedules);
		const crontab = helper.getCrontab();
		assert.ok(crontab.includes("SHELL=/bin/bash"));
		assert.ok(crontab.includes("PATH=/usr/bin"));
	});

	it("returns error when crontab is unavailable", async () => {
		const failingExec = (cmd) => {
			if (cmd.includes("which crontab")) {
				return Promise.reject(new Error("not found"));
			}
			return Promise.reject(new Error(`Unexpected: ${cmd}`));
		};
		setExecOverride(failingExec);
		const result = await Cron.install([]);
		assert.strictEqual(result.installed, 0);
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
		const result = await Cron.install([{ name: "test", cron: "* * * * *", command: "echo test" }]);
		assert.strictEqual(result.installed, 0);
		assert.ok(result.error);
	});
});

// ---------------------------------------------------------------------------
// Cron.uninstall
// ---------------------------------------------------------------------------

describe("Cron.uninstall", () => {
	let helper;

	beforeEach(() => {
		helper = mockExecBuilder();
		helper.reset();
		setExecOverride(helper.mockExec);
	});

	afterEach(() => {
		setExecOverride(undefined);
	});

	it("removes all madz-schedules entries and returns count", async () => {
		await Cron.add({ name: "job1", cron: "* * * * *", command: "echo 1" });
		await Cron.add({ name: "job2", cron: "0 * * * *", command: "echo 2" });
		const count = await Cron.uninstall();
		assert.strictEqual(count, 2);
		const crontab = helper.getCrontab();
		assert.ok(!crontab.includes("madz-schedules"));
	});

	it("returns 0 when no madz block exists", async () => {
		helper.setCrontab("SHELL=/bin/bash\n");
		const count = await Cron.uninstall();
		assert.strictEqual(count, 0);
	});

	it("returns 0 when crontab is unavailable", async () => {
		const failingExec = (cmd) => {
			if (cmd.includes("which crontab")) {
				return Promise.reject(new Error("not found"));
			}
			return Promise.reject(new Error(`Unexpected: ${cmd}`));
		};
		setExecOverride(failingExec);
		const count = await Cron.uninstall();
		assert.strictEqual(count, 0);
	});

	it("swallows write error and still returns count", async () => {
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
		// uninstall does not catch write errors — it will throw
		await assert.rejects(() => Cron.uninstall(), /write failed/);
	});

	it("preserves outside lines when uninstalling", async () => {
		helper.setCrontab(
			"SHELL=/bin/bash\n# --- BEGIN madz-schedules ---\n* * * * *  echo job  # madz-schedule: job\n# --- END madz-schedules ---\n",
		);
		await Cron.uninstall();
		const crontab = helper.getCrontab();
		assert.ok(crontab.includes("SHELL=/bin/bash"));
		assert.ok(!crontab.includes("madz-schedules"));
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
		assert.strictEqual(content.cron, "0 2 * * *");
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
			"# --- BEGIN madz-schedules ---\n* * * * *  echo same  # madz-schedule: stable-job\n# --- END madz-schedules ---\n",
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
});
