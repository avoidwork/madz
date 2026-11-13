import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	discoverSkills,
	extractFrontmatter,
	lenientYamlParse,
} from "../../../src/skills/discoverer.js";
import { SkillRegistry } from "../../../src/skills/registry.js";
import { validateSkillSchema } from "../../../src/skills/validator.js";
import { getAgentForSkill } from "../../../src/skills/agentMapper.js";
import { skillImpl } from "../../../src/tools/skills/index.js";
import { logger } from "../../../src/shared/logger.js";

let root;
let warns;

/**
 * Write a skill into a scope directory.
 * @param {string} scope - Scope directory
 * @param {string} dir - Skill directory name
 * @param {string} [front] - Frontmatter lines after name
 * @param {string} [name] - Frontmatter name (defaults to dir)
 * @returns {Promise<void>}
 */
async function mk(scope, dir, front = "description: desc", name = dir) {
	await mkdir(join(scope, dir), { recursive: true });
	await writeFile(join(scope, dir, "SKILL.md"), `---\nname: ${name}\n${front}\n---\n\nBody ${dir}`);
}

/**
 * Discover into a fresh registry.
 * @param {string[]} scope - Scope paths
 * @param {object} [options] - Discovery options
 * @returns {Promise<{ reg: SkillRegistry, res: Array }>}
 */
async function discoverReg(scope, options = {}) {
	const reg = new SkillRegistry();
	const res = await reg.discover(scope, { cwd: root, ...options });
	return { reg, res };
}

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "madz-skills-"));
	warns = [];
	mock.method(logger, "warn", (m) => warns.push(String(m)));
	mock.method(logger, "debug", () => {});
});

afterEach(async () => {
	mock.restoreAll();
	await rm(root, { recursive: true, force: true });
});

describe("agent routing (H1)", () => {
	it("uses nested metadata.agent from a real SKILL.md", async () => {
		await mk(join(root, "skills"), "a-skill", "description: d\nmetadata:\n  agent: zed");
		const { reg } = await discoverReg(["skills"]);
		assert.strictEqual(reg.getSkillPathsForAgent("zed").length, 1);
		assert.strictEqual(reg.getSkillPathsForAgent("other").length, 0);
	});

	it("uses the agent mapped from skillAgentMap config", () => {
		const cfg = { skillAgentMap: [{ pattern: "^cfg-", agent: "coding" }] };
		assert.strictEqual(getAgentForSkill("cfg-x", cfg), "coding");
		assert.strictEqual(getAgentForSkill("nomatch", cfg), null);
	});

	it("real .skills/ dir yields skills for coding", async (t) => {
		if (!existsSync(join(process.cwd(), ".skills"))) return t.skip("no .skills dir");
		const reg = new SkillRegistry();
		await reg.discover([".skills/"], { cwd: process.cwd() });
		assert.ok(reg.getSkillPathsForAgent("coding").length > 0);
	});
});

describe("disabled skills (H2)", () => {
	it("honors frontmatter disabled and disable()/enable()", async () => {
		const scope = join(root, "skills");
		await mk(scope, "off", "description: d\ndisabled: true\nmetadata:\n  agent: zed");
		await mk(scope, "on", "description: d\nmetadata:\n  agent: zed");
		const { reg } = await discoverReg(["skills"]);
		assert.deepStrictEqual(
			reg.getCatalog().map((c) => c.name),
			["on"],
		);
		assert.strictEqual(reg.getSkillPaths().length, 1);
		assert.strictEqual(reg.getSkillPathsForAgent("zed").length, 1);
		assert.ok(reg.has("off") && reg.list().includes("off") && reg.get("off"));

		reg.disable("on");
		assert.strictEqual(reg.getCatalog().length, 0);
		assert.strictEqual(reg.getSkillPaths().length, 0);
		reg.enable("on");
		reg.enable("off");
		assert.strictEqual(reg.getCatalog().length, 2);
	});

	it("skill tool refuses a disabled skill", async () => {
		await mk(join(root, "skills"), "on");
		const { reg } = await discoverReg(["skills"]);
		reg.disable("on");
		const res = await skillImpl({ name: "on" }, { registry: reg });
		assert.ok(res.error.includes("disabled"));
		assert.strictEqual(res.body, "");
	});

	it("getCatalog returns a copy", async () => {
		await mk(join(root, "skills"), "on");
		const { reg } = await discoverReg(["skills"]);
		reg.getCatalog().pop();
		assert.strictEqual(reg.getCatalog().length, 1);
	});
});

describe("bundled priority (M1)", () => {
	beforeEach(async () => {
		await mk(join(root, "skills"), "dup", "description: user");
		await mk(join(root, ".skills"), "dup", "description: bundled");
	});

	it("bundled wins with user scope first", async () => {
		const s = await discoverSkills(["skills/", ".skills/"], { cwd: root });
		assert.strictEqual(s.length, 1);
		assert.strictEqual(s[0].metadata.description, "bundled");
		assert.strictEqual(s[0].bundled, true);
		assert.ok(warns.some((w) => w.includes("clashes with bundled")));
	});

	it("bundled wins with bundled scope first", async () => {
		const s = await discoverSkills([".skills/", "skills/"], { cwd: root });
		assert.strictEqual(s.length, 1);
		assert.strictEqual(s[0].metadata.description, "bundled");
		assert.ok(warns.some((w) => w.includes(join(root, "skills", "dup"))));
	});

	it("replaces in place when bundled is scanned second", async () => {
		await mk(join(root, "skills"), "first");
		await mk(join(root, "skills"), "last");
		const s = await discoverSkills(["skills/", ".skills/"], { cwd: root });
		const names = s.map((x) => x.name);
		assert.strictEqual(s.length, 3);
		assert.strictEqual(names.indexOf("dup"), 0);
		assert.strictEqual(s[0].bundled, true);
	});

	it("does not misclassify a project with .skills in a parent path", async () => {
		const proj = join(root, ".skills-work", "x", ".skills", "y", "madz");
		await mk(join(proj, "skills"), "same", "description: user");
		await mk(join(proj, "other"), "same", "description: other");
		const s = await discoverSkills(["skills/", "other/"], { cwd: proj });
		assert.strictEqual(s.length, 1);
		assert.strictEqual(s[0].bundled, false);
		assert.strictEqual(s[0].metadata.description, "user");
		assert.ok(warns.some((w) => w.includes("Duplicate skill")));
	});

	it("register() cannot replace a bundled skill; re-discover keeps priority", async () => {
		const { reg } = await discoverReg([".skills/"]);
		const r = reg.register("dup", { description: "evil" });
		assert.strictEqual(r.valid, false);
		assert.strictEqual(reg.get("dup").metadata.description, "bundled");
		await reg.discover(["skills/", ".skills/"], { cwd: root });
		assert.strictEqual(reg.get("dup").bundled, true);
		await reg.discover([".skills/", "skills/"], { cwd: root });
		assert.strictEqual(reg.get("dup").metadata.description, "bundled");
	});

	it("crossing names do not collapse", async () => {
		await mk(join(root, "cross"), "a", "description: A", "b");
		await mk(join(root, "cross"), "b", "description: B", "b");
		const s = await discoverSkills(["cross/"], { cwd: root });
		assert.deepStrictEqual(s.map((x) => x.name).sort(), ["a", "b"]);
	});

	it("bundledSkills:false still lets bundled reflection win", async () => {
		await mk(join(root, "skills"), "reflection", "description: user");
		await mk(join(root, ".skills"), "reflection", "description: bundled");
		const s = await discoverSkills(["skills/", ".skills/"], { cwd: root, bundledSkills: false });
		const byName = Object.fromEntries(s.map((x) => [x.name, x.metadata.description]));
		assert.strictEqual(byName.reflection, "bundled");
		// "dup" was not loaded from .skills/, so the user skill is allowed
		assert.strictEqual(byName.dup, "user");
	});
});

describe("scan robustness (M2, M4, M7)", () => {
	it("dangling symlink does not abort the scan", async () => {
		const scope = join(root, "skills");
		await mkdir(scope, { recursive: true });
		await symlink(join(root, "missing"), join(scope, "aaa-broken"));
		await mk(scope, "zzz-good");
		const s = await discoverSkills(["skills/"], { cwd: root });
		assert.deepStrictEqual(
			s.map((x) => x.name),
			["zzz-good"],
		);
		assert.ok(warns.some((w) => w.includes("aaa-broken")));
	});

	it("warns for invalid skills", async () => {
		const scope = join(root, "skills");
		await mkdir(join(scope, "nofm"), { recursive: true });
		await writeFile(join(scope, "nofm", "SKILL.md"), "# nothing");
		await mkdir(join(scope, "nodesc"), { recursive: true });
		await writeFile(join(scope, "nodesc", "SKILL.md"), "---\nname: nodesc\n---\n");
		await mkdir(join(scope, "noname"), { recursive: true });
		await writeFile(join(scope, "noname", "SKILL.md"), "---\ndescription: x\n---\n");
		await mkdir(join(scope, "badyaml"), { recursive: true });
		await writeFile(join(scope, "badyaml", "SKILL.md"), "---\nname: [oops\n---\n");
		const s = await discoverSkills(["skills/"], { cwd: root });
		assert.strictEqual(s.length, 0);
		for (const n of ["nofm", "nodesc", "noname", "badyaml"]) {
			assert.ok(
				warns.some((w) => w.includes(join(n, "SKILL.md"))),
				n,
			);
		}
	});

	it("skips symlinks escaping the scope but keeps internal ones", async () => {
		const outside = join(root, "outside");
		await mk(outside, "evil");
		const scope = join(root, "skills");
		await mk(scope, "real");
		await symlink(join(outside, "evil"), join(scope, "linked"));
		await symlink(join(scope, "real"), join(scope, "alias"));
		const s = await discoverSkills(["skills/"], { cwd: root });
		const names = s.map((x) => x.name);
		assert.ok(!names.includes("linked"));
		assert.ok(names.includes("alias") && names.includes("real"));
		assert.ok(warns.some((w) => w.includes("linked") && w.includes("outside scope")));
	});
});

describe("registry discover (M3, M5)", () => {
	it("does not register a skill whose schema says skip", async () => {
		await mk(join(root, "skills"), "long", `description: ${"x".repeat(2000)}`);
		const { reg, res } = await discoverReg(["skills/"]);
		assert.strictEqual(reg.has("long"), false);
		assert.strictEqual(res[0].name, "long");
		assert.ok(res[0].errors.length > 0);
		assert.ok(warns.some((w) => w.includes("long")));
	});

	it("drops deleted skills on re-discover but keeps registered ones", async () => {
		await mk(join(root, "skills"), "gone");
		const { reg } = await discoverReg(["skills/"]);
		reg.register("manual", { description: "m" });
		await rm(join(root, "skills", "gone"), { recursive: true });
		await reg.discover(["skills/"], { cwd: root });
		assert.strictEqual(reg.has("gone"), false);
		assert.strictEqual(await reg.getSkillBody("gone"), null);
		assert.strictEqual(reg.has("manual"), true);
		assert.ok(reg.getCatalog().some((c) => c.name === "manual"));
		assert.ok(!reg.getCatalog().some((c) => c.name === "gone"));
	});

	it("getSkillBody logs and returns null on read error", async () => {
		await mk(join(root, "skills"), "vanish");
		const { reg } = await discoverReg(["skills/"]);
		await rm(join(root, "skills", "vanish"), { recursive: true });
		assert.strictEqual(await reg.getSkillBody("vanish"), null);
		assert.ok(warns.some((w) => w.includes("Failed to read skill body")));
	});
});

describe("parsing and validation (L1, L4, L5, L6, L7, L8)", () => {
	it("lenientYamlParse quotes unquoted colons", () => {
		const r = lenientYamlParse("name: x\ndescription: Use when: the user asks");
		assert.strictEqual(r.description, "Use when: the user asks");
		assert.strictEqual(lenientYamlParse("a: [unclosed"), null);
		assert.deepStrictEqual(lenientYamlParse("a: 1"), { a: 1 });
	});

	it("extractFrontmatter strips a leading BOM", () => {
		const r = extractFrontmatter("\uFEFF---\nname: x\ndescription: y\n---\nbody");
		assert.strictEqual(r.frontmatter.name, "x");
		assert.strictEqual(r.body, "body");
	});

	it("formats zod issues as path: message", () => {
		const r = validateSkillSchema({ name: "ok", description: "d", permissions: ["bogus"] });
		const w = r.warnings.find((x) => x.includes("metadata validation"));
		assert.ok(w.includes("permissions.0:"), w);
		assert.ok(!w.includes("\n"));
	});

	it("validateSkillSchema does not mutate input", () => {
		const input = { name: 123, description: "d" };
		validateSkillSchema(input);
		assert.strictEqual(input.name, 123);
	});

	it("getAgentForSkill warns on an invalid pattern and continues", () => {
		const cfg = {
			skillAgentMap: [
				{ pattern: "(", agent: "x" },
				{ pattern: "^a", agent: "y" },
			],
		};
		assert.strictEqual(getAgentForSkill("abc", cfg), "y");
		assert.ok(warns.some((w) => w.includes('"("')));
	});

	it("drift produces a single warning", async () => {
		await mk(join(root, "skills"), "dir-a", "description: d", "other");
		const { res } = await discoverReg(["skills/"]);
		assert.strictEqual(res[0].warnings.filter((w) => w.includes("other")).length, 1);
	});
});
