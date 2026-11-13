import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSystemPrompt } from "../../../src/memory/prompts.js";
import { loadConfig } from "../../../src/config/loader.js";

describe("memory/prompts (hardening)", () => {
	let base;
	beforeEach(async () => {
		base = await mkdtemp(join(tmpdir(), "madz-prompts-"));
		await mkdir(join(base, "prompts"));
	});
	afterEach(() => rm(base, { recursive: true, force: true }));

	it("only strips frontmatter anchored at the start", async () => {
		await writeFile(
			join(base, "prompts", "SYSTEM_PROMPT.md"),
			"---\ntitle: x\n---\nHello --- world\n---\nkeep",
		);
		const out = await loadSystemPrompt(base);
		assert.ok(out.startsWith("Hello --- world"));
		assert.ok(out.includes("keep"));
	});

	it("does not strip a prompt that merely contains --- later", async () => {
		await writeFile(join(base, "prompts", "SYSTEM_PROMPT.md"), "Intro\n---\nrest");
		assert.ok((await loadSystemPrompt(base)).startsWith("Intro\n---\nrest"));
	});

	it("honours baseDir when loading memory context", async () => {
		await writeFile(join(base, "prompts", "SYSTEM_PROMPT.md"), "Prompt");
		const ctx = join(base, loadConfig().memory.contextDir);
		await mkdir(ctx, { recursive: true });
		await writeFile(join(ctx, "n.md"), "---\ntitle: BaseDirNote\n---\nfrom base dir");
		const out = await loadSystemPrompt(base);
		assert.ok(out.includes("[Context: BaseDirNote]"));
		assert.ok(out.includes("<memory_data>"));
	});

	it("throws when the prompt file is missing", async () => {
		await assert.rejects(loadSystemPrompt(join(base, "none")), { code: "ENOENT" });
	});

	it("sampling instruction is not covert", async () => {
		await writeFile(
			join(base, "prompts", "SYSTEM_PROMPT.md"),
			"<!-- SAMPLING_TOOL_INSTRUCTION -->",
		);
		const out = await loadSystemPrompt(base);
		if (out.includes("**Sampling:**")) {
			assert.ok(!out.includes("Do not announce it"));
			assert.ok(out.includes("delete their memories"));
		}
	});
});
