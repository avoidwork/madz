import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { readFile, access, constants } from "node:fs/promises";
import { join } from "node:path";
import {
	ATTRIBUTES,
	loadProfile,
	saveProfile,
	hasProfile,
	formatProfileContext,
	processOnboardingInput,
	getAttribute,
	sanitizeProfileData,
} from "../../src/memory/profile.js";

const TEST_DIR = "memory/__ctx_profile_test__";
const FULL_TEST_DIR = join(process.cwd(), TEST_DIR);

function setup() {
	try {
		rmSync(FULL_TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
	mkdirSync(FULL_TEST_DIR, { recursive: true });
}

function teardown() {
	try {
		rmSync(FULL_TEST_DIR, { recursive: true, force: true });
	} catch {
		// ignore
	}
}

beforeEach(setup);
after(teardown);

describe("ATTRIBUTES schema", () => {
	it("has exactly 12 attributes", () => {
		assert.strictEqual(ATTRIBUTES.length, 12);
	});

	it("each attribute has key, prompt, and order", () => {
		for (const attr of ATTRIBUTES) {
			assert.ok(typeof attr.key === "string", "key must be string");
			assert.ok(typeof attr.prompt === "string", "prompt must be string");
			assert.strictEqual(typeof attr.order, "number", "order must be number");
		}
	});

	it("has correct attribute keys", () => {
		const keys = ATTRIBUTES.map((a) => a.key);
		assert.deepStrictEqual(keys, [
			"name",
			"dob",
			"relationship",
			"pets",
			"hobbies",
			"expertise",
			"favorite bands",
			"favorite books",
			"favorite tv",
			"favorite movies",
			"location",
			"notes",
		]);
	});

	it("is frozen (immutable)", () => {
		assert.throws(() => {
			ATTRIBUTES.push({ key: "test", prompt: "test", order: 99 });
		});
	});

	it("first attribute is name", () => {
		assert.strictEqual(ATTRIBUTES[0].key, "name");
		assert.strictEqual(ATTRIBUTES[0].prompt, "What is your name?");
	});
});

describe("loadProfile", () => {
	it("returns null when profile file does not exist", async () => {
		const missing = join(FULL_TEST_DIR, "missing.md");
		assert.strictEqual(await loadProfile(missing), null);
	});

	it("returns null when body has no profile attributes", async () => {
		const fp = join(FULL_TEST_DIR, "note.md");
		writeFileSync(fp, "just a note");
		assert.strictEqual(await loadProfile(fp), null);
	});

	it("returns null for empty file content", async () => {
		const fp = join(FULL_TEST_DIR, "empty.md");
		writeFileSync(fp, "");
		assert.strictEqual(await loadProfile(fp), null);
	});

	it("returns null for empty body with frontmatter", async () => {
		const fp = join(FULL_TEST_DIR, "fm.md");
		writeFileSync(fp, "---\ntitle: Note\n---\n");
		assert.strictEqual(await loadProfile(fp), null);
	});

	it("parses profile from body lines", async () => {
		const fp = join(FULL_TEST_DIR, "body.md");
		writeFileSync(fp, "name: Alice\nhobbies: hiking\npets: cat");
		const result = await loadProfile(fp);
		assert.ok(result);
		assert.strictEqual(result.data.name, "Alice");
		assert.strictEqual(result.data.hobbies, "hiking");
		assert.strictEqual(result.data.pets, "cat");
	});

	it("skips comment lines in body", async () => {
		const fp = join(FULL_TEST_DIR, "comment.md");
		writeFileSync(fp, "# comment\nname: Bob\n  # another comment\n\nhobbies: reading\n");
		const result = await loadProfile(fp);
		assert.strictEqual(result.data.name, "Bob");
		assert.strictEqual(result.data.hobbies, "reading");
	});

	it("returns null if body values match no known attributes", async () => {
		const fp = join(FULL_TEST_DIR, "unknown.md");
		writeFileSync(fp, "foo: bar");
		assert.strictEqual(await loadProfile(fp), null);
	});
});

describe("saveProfile", () => {
	it("writes profile file with body data", async () => {
		const fp = join(FULL_TEST_DIR, "profile.md");
		await saveProfile({ name: "Alice", hobbies: "hiking", pets: "cat" }, fp);
		const content = await readFile(fp, "utf-8");
		assert.ok(content.includes("name: Alice"));
		assert.ok(content.includes("hobbies: hiking"));
		assert.ok(content.includes("pets: cat"));
		assert.ok(!content.includes("---"));
	});

	it("overwrites existing profile", async () => {
		const fp = join(FULL_TEST_DIR, "over.md");
		await saveProfile({ name: "Alice" }, fp);
		let content = await readFile(fp, "utf-8");
		assert.ok(content.includes("name: Alice"));
		await saveProfile({ name: "Bob" }, fp);
		content = await readFile(fp, "utf-8");
		assert.ok(content.includes("name: Bob"));
		assert.ok(!content.includes("Alice"));
	});

	it("creates parent directory if missing", async () => {
		const fp = join(FULL_TEST_DIR, "sub", "dir", "p.md");
		await saveProfile({ name: "test" }, fp);
		const content = await readFile(fp, "utf-8");
		assert.ok(content.includes("name: test"));
	});

	it("skips null and empty attributes", async () => {
		const fp = join(FULL_TEST_DIR, "nulls.md");
		await saveProfile({ name: "test", dob: null, pet: "cat", hobbies: "" }, fp);
		const content = await readFile(fp, "utf-8");
		assert.ok(content.includes("name: test"));
		assert.ok(!content.includes("cat"));
	});

	it("is readable by loadProfile", async () => {
		const fp = join(FULL_TEST_DIR, "roundtrip.md");
		await saveProfile({ name: "Eve", hobbies: "coding", notes: "likes coffee" }, fp);
		const loaded = await loadProfile(fp);
		assert.ok(loaded);
		assert.strictEqual(loaded.data.name, "Eve");
		assert.strictEqual(loaded.data.hobbies, "coding");
		assert.strictEqual(loaded.data.notes, "likes coffee");
	});
});

describe("hasProfile", () => {
	it("returns true when profile file exists", async () => {
		const fp = join(FULL_TEST_DIR, "exists.md");
		await saveProfile({ name: "x" }, fp);
		assert.strictEqual(await hasProfile(fp), true);
	});

	it("returns false when profile file does not exist", async () => {
		const fp = join(FULL_TEST_DIR, "nope.md");
		assert.strictEqual(await hasProfile(fp), false);
	});
});

describe("formatProfileContext", () => {
	it("formats non-empty attributes as key: value pairs", () => {
		const data = { name: "Alice", dob: "1990", hobbies: "hiking", pets: "cat" };
		const result = formatProfileContext(data);
		assert.ok(result.startsWith("[Context: Profile]"));
		assert.ok(result.includes("name: Alice"));
		assert.ok(result.includes("dob: 1990"));
		assert.ok(result.includes("hobbies: hiking"));
		assert.ok(result.includes("pets: cat"));
	});

	it("skips empty attributes", () => {
		const data = { dob: "", hobbies: "reading", pet: "   " };
		const result = formatProfileContext(data);
		assert.ok(result.startsWith("[Context: Profile]"));
		assert.ok(!result.includes("dob:"));
		assert.ok(!result.includes("pet:"));
		assert.ok(result.includes("hobbies: reading"));
	});

	it("returns empty string for empty data", () => {
		assert.strictEqual(formatProfileContext({}), "");
	});

	it("returns empty string for null input", () => {
		assert.strictEqual(formatProfileContext(null), "");
	});

	it("returns empty string for non-object input", () => {
		assert.strictEqual(formatProfileContext("string"), "");
	});

	it("trims attribute values", () => {
		const result = formatProfileContext({ hobbies: "  read  " });
		assert.ok(result.includes("hobbies: read"));
		assert.ok(!result.includes("read  "));
	});

	it("uses attribute order for formatting", () => {
		const data = { "favorite movies": "Inception", name: "Zara", dob: "1995" };
		const result = formatProfileContext(data);
		assert.ok(result.indexOf("name:") < result.indexOf("dob:"));
		assert.ok(result.indexOf("dob:") < result.indexOf("favorite movies:"));
	});
});

describe("processOnboardingInput", () => {
	it("returns skip for skip variations", () => {
		assert.strictEqual(processOnboardingInput("skip"), "skip");
		assert.strictEqual(processOnboardingInput("SKIP"), "skip");
		assert.strictEqual(processOnboardingInput("  skip  "), "skip");
	});

	it("returns cancel for cancel variations", () => {
		assert.strictEqual(processOnboardingInput("cancel"), "cancel");
		assert.strictEqual(processOnboardingInput("stop"), "cancel");
		assert.strictEqual(processOnboardingInput("Cancel"), "cancel");
	});

	it("returns exit for exit", () => {
		assert.strictEqual(processOnboardingInput("exit"), "exit");
	});

	it("returns null for normal input", () => {
		assert.strictEqual(processOnboardingInput("yes"), null);
		assert.strictEqual(processOnboardingInput("hiking"), null);
		assert.strictEqual(processOnboardingInput(""), null);
	});
});

describe("getAttribute", () => {
	it("returns the attribute at the given index", () => {
		const a = getAttribute(0);
		assert.deepStrictEqual(a, { key: "name", prompt: "What is your name?", order: 0 });
		const b = getAttribute(5);
		assert.deepStrictEqual(b, {
			key: "expertise",
			prompt: "What are your domains of expertise?",
			order: 5,
		});
	});

	it("returns undefined for out of bounds", () => {
		assert.strictEqual(getAttribute(99), undefined);
		assert.strictEqual(getAttribute(-1), undefined);
	});
});

describe("sanitizeProfileData", () => {
	it("filters to only known attribute keys", () => {
		const data = { name: "Alice", hobbies: "reading", unknown: "x", pets: "dog" };
		const result = sanitizeProfileData(data);
		assert.deepStrictEqual(result, { name: "Alice", hobbies: "reading", pets: "dog" });
	});

	it("converts non-string values to strings", () => {
		const result = sanitizeProfileData({ name: "Bob", dob: 1990, hobbies: "read" });
		assert.strictEqual(result.name, "Bob");
		assert.strictEqual(result.dob, "1990");
		assert.strictEqual(result.hobbies, "read");
	});

	it("handles null/undefined values", () => {
		const result = sanitizeProfileData({ name: null, hobbies: undefined, pets: "cat" });
		assert.strictEqual(result.name, "");
		assert.strictEqual(result.hobbies, "");
		assert.strictEqual(result.pets, "cat");
	});
});
