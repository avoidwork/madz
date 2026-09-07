import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	loadProfile,
	saveProfile,
	hasProfile,
	formatProfileContext,
	processOnboardingInput,
	getAttribute,
	sanitizeProfileData,
} from "../../src/memory/profile.js";

// ---------------------------------------------------------------------------
// Temp directory — cleaned before each test, removed after all tests
// ---------------------------------------------------------------------------
const TEST_DIR = "memory/__test_profile__";
const FULL_TEST_DIR = join(process.cwd(), TEST_DIR);

function setup() {
	rmSync(FULL_TEST_DIR, { recursive: true, force: true });
	mkdirSync(FULL_TEST_DIR, { recursive: true });
}

function teardown() {
	rmSync(FULL_TEST_DIR, { recursive: true, force: true });
}

beforeEach(setup);
after(teardown);

// ===========================================================================
// Pure function tests (no I/O)
// ===========================================================================

describe("formatProfileContext (pure)", () => {
	it("formats valid profile data with [Context: Profile] prefix", () => {
		const data = { name: "Alice", dob: "1990", hobbies: "hiking" };
		const result = formatProfileContext(data);
		assert.ok(result.startsWith("[Context: Profile]"));
		assert.ok(result.includes("name: Alice"));
		assert.ok(result.includes("dob: 1990"));
		assert.ok(result.includes("hobbies: hiking"));
	});

	it("returns empty string for empty data object", () => {
		assert.strictEqual(formatProfileContext({}), "");
	});

	it("returns empty string for null", () => {
		assert.strictEqual(formatProfileContext(null), "");
	});

	it("returns empty string for non-object input", () => {
		assert.strictEqual(formatProfileContext("string"), "");
		assert.strictEqual(formatProfileContext(42), "");
		assert.strictEqual(formatProfileContext(undefined), "");
	});

	it("skips empty or whitespace-only attribute values", () => {
		const data = { name: "", hobbies: "   ", pets: "cat" };
		const result = formatProfileContext(data);
		assert.ok(!result.includes("name:"));
		assert.ok(!result.includes("hobbies:"));
		assert.ok(result.includes("pets: cat"));
	});

	it("trims whitespace from attribute values", () => {
		const result = formatProfileContext({ hobbies: "  reading  " });
		assert.ok(result.includes("hobbies: reading"));
		assert.ok(!result.includes("  reading  "));
	});

	it("respects ATTRIBUTES order in output", () => {
		const data = { "favorite movies": "Inception", name: "Zara", dob: "1995" };
		const result = formatProfileContext(data);
		const nameIdx = result.indexOf("name: Zara");
		const dobIdx = result.indexOf("dob: 1995");
		const moviesIdx = result.indexOf("favorite movies: Inception");
		assert.ok(nameIdx < dobIdx, "name should appear before dob");
		assert.ok(dobIdx < moviesIdx, "dob should appear before favorite movies");
	});
});

describe("processOnboardingInput (pure)", () => {
	it('returns "skip" for lowercase "skip"', () => {
		assert.strictEqual(processOnboardingInput("skip"), "skip");
	});

	it('returns "skip" for capitalized "Skip"', () => {
		assert.strictEqual(processOnboardingInput("Skip"), "skip");
	});

	it('returns "skip" for uppercase "SKIP"', () => {
		assert.strictEqual(processOnboardingInput("SKIP"), "skip");
	});

	it('returns "skip" for "skip onboarding" phrase', () => {
		assert.strictEqual(processOnboardingInput("skip onboarding"), "skip");
	});

	it('returns "cancel" for lowercase "cancel"', () => {
		assert.strictEqual(processOnboardingInput("cancel"), "cancel");
	});

	it('returns "cancel" for capitalized "Cancel"', () => {
		assert.strictEqual(processOnboardingInput("Cancel"), "cancel");
	});

	it('returns "cancel" for "stop" alias', () => {
		assert.strictEqual(processOnboardingInput("stop"), "cancel");
	});

	it('returns "exit" for lowercase "exit"', () => {
		assert.strictEqual(processOnboardingInput("exit"), "exit");
	});

	it('returns "exit" for capitalized "Exit"', () => {
		assert.strictEqual(processOnboardingInput("Exit"), "exit");
	});

	it("returns null for normal conversational input", () => {
		assert.strictEqual(processOnboardingInput("yes"), null);
		assert.strictEqual(processOnboardingInput("hiking"), null);
		assert.strictEqual(processOnboardingInput("I like cats"), null);
	});

	it("returns null for empty or whitespace-only input", () => {
		assert.strictEqual(processOnboardingInput(""), null);
		assert.strictEqual(processOnboardingInput("   "), null);
	});

	it("returns null for null or undefined input", () => {
		assert.strictEqual(processOnboardingInput(null), null);
		assert.strictEqual(processOnboardingInput(undefined), null);
	});
});

describe("getAttribute (pure)", () => {
	it("returns the first attribute (index 0)", () => {
		const a = getAttribute(0);
		assert.deepStrictEqual(a, {
			key: "name",
			prompt: "What is your name?",
			order: 0,
		});
	});

	it("returns an attribute at a mid-range index", () => {
		const b = getAttribute(5);
		assert.deepStrictEqual(b, {
			key: "expertise",
			prompt: "What are your domains of expertise?",
			order: 5,
		});
	});

	it("returns the last attribute (index 11)", () => {
		const last = getAttribute(11);
		assert.deepStrictEqual(last, {
			key: "notes",
			prompt: "Is there anything else you'd like to share? (free-form)",
			order: 11,
		});
	});

	it("returns undefined for out-of-bounds positive index", () => {
		assert.strictEqual(getAttribute(99), undefined);
	});

	it("returns undefined for negative index", () => {
		assert.strictEqual(getAttribute(-1), undefined);
	});

	it("returns undefined for index equal to ATTRIBUTES length", () => {
		assert.strictEqual(getAttribute(12), undefined);
	});
});

describe("sanitizeProfileData (pure)", () => {
	it("filters to only known attribute keys, dropping unknown keys", () => {
		const data = { name: "Alice", hobbies: "reading", unknown: "x", pets: "dog" };
		const result = sanitizeProfileData(data);
		assert.deepStrictEqual(result, { name: "Alice", hobbies: "reading", pets: "dog" });
		assert.ok(!("unknown" in result));
	});

	it("converts numeric values to strings", () => {
		const result = sanitizeProfileData({ name: "Bob", dob: 1990, hobbies: "read" });
		assert.strictEqual(result.name, "Bob");
		assert.strictEqual(result.dob, "1990");
		assert.strictEqual(result.hobbies, "read");
	});

	it("converts null to empty string", () => {
		const result = sanitizeProfileData({ name: null, pets: "cat" });
		assert.strictEqual(result.name, "");
		assert.strictEqual(result.pets, "cat");
	});

	it("converts undefined to empty string", () => {
		const result = sanitizeProfileData({ name: undefined, pets: "cat" });
		assert.strictEqual(result.name, "");
		assert.strictEqual(result.pets, "cat");
	});

	it("converts boolean values to strings", () => {
		const result = sanitizeProfileData({ pets: true, hobbies: false });
		assert.strictEqual(result.pets, "true");
		assert.strictEqual(result.hobbies, "false");
	});

	it("returns an empty object when given an empty object", () => {
		assert.deepStrictEqual(sanitizeProfileData({}), {});
	});

	it("returns an empty object when no known keys are present", () => {
		assert.deepStrictEqual(sanitizeProfileData({ foo: "bar", baz: "qux" }), {});
	});
});

// ===========================================================================
// I/O function tests (use temp dir under memory/__test_profile__/)
// ===========================================================================

describe("loadProfile (I/O)", () => {
	it("returns null when file does not exist", async () => {
		const fp = join(FULL_TEST_DIR, "missing.md");
		assert.strictEqual(await loadProfile(fp), null);
	});

	it("returns null for an empty file", async () => {
		const fp = join(FULL_TEST_DIR, "empty.md");
		writeFileSync(fp, "");
		assert.strictEqual(await loadProfile(fp), null);
	});

	it("returns null for a file with only frontmatter and no body", async () => {
		const fp = join(FULL_TEST_DIR, "frontmatter.md");
		writeFileSync(fp, "---\ntitle: Note\n---\n");
		assert.strictEqual(await loadProfile(fp), null);
	});

	it("returns null when body has no known attribute keys", async () => {
		const fp = join(FULL_TEST_DIR, "unknown.md");
		writeFileSync(fp, "foo: bar\nbaz: qux");
		assert.strictEqual(await loadProfile(fp), null);
	});

	it("returns parsed data for a valid profile file", async () => {
		const fp = join(FULL_TEST_DIR, "valid.md");
		writeFileSync(fp, "name: Alice\nhobbies: hiking\npets: cat");
		const result = await loadProfile(fp);
		assert.ok(result !== null);
		assert.strictEqual(result.data.name, "Alice");
		assert.strictEqual(result.data.hobbies, "hiking");
		assert.strictEqual(result.data.pets, "cat");
		assert.ok(typeof result.body === "string");
	});

	it("returns null when path is a directory (covers catch block lines 82-84)", async () => {
		// access(F_OK) passes because the directory exists, but readFile throws
		// (EISDIR), which is caught by the inner catch block at lines 82-84.
		const dirPath = join(FULL_TEST_DIR, "is_a_directory.md");
		mkdirSync(dirPath);
		const result = await loadProfile(dirPath);
		assert.strictEqual(result, null);
	});

	it("skips comment lines and blank lines in the body", async () => {
		const fp = join(FULL_TEST_DIR, "comments.md");
		writeFileSync(fp, "# this is a comment\nname: Bob\n\n-- separator\nhobbies: reading\n");
		const result = await loadProfile(fp);
		assert.ok(result !== null);
		assert.strictEqual(result.data.name, "Bob");
		assert.strictEqual(result.data.hobbies, "reading");
	});
});

describe("hasProfile (I/O)", () => {
	it("returns true when the profile file exists", async () => {
		const fp = join(FULL_TEST_DIR, "exists.md");
		writeFileSync(fp, "name: test");
		assert.strictEqual(await hasProfile(fp), true);
	});

	it("returns false when the profile file does not exist", async () => {
		const fp = join(FULL_TEST_DIR, "nope.md");
		assert.strictEqual(await hasProfile(fp), false);
	});

	it("returns true for a directory path (access passes)", async () => {
		const dirPath = join(FULL_TEST_DIR, "a_directory");
		mkdirSync(dirPath);
		assert.strictEqual(await hasProfile(dirPath), true);
	});
});

describe("saveProfile (I/O)", () => {
	it("writes profile file with correct content", async () => {
		const fp = join(FULL_TEST_DIR, "profile.md");
		await saveProfile({ name: "Alice", hobbies: "hiking", pets: "cat" }, fp);
		const content = await readFile(fp, "utf-8");
		assert.ok(content.includes("name: Alice"));
		assert.ok(content.includes("hobbies: hiking"));
		assert.ok(content.includes("pets: cat"));
	});

	it("writes atomically — no .tmp file remains after write", async () => {
		const fp = join(FULL_TEST_DIR, "atomic.md");
		await saveProfile({ name: "Atomic" }, fp);

		// Target file exists and has content
		const content = await readFile(fp, "utf-8");
		assert.ok(content.includes("name: Atomic"));

		// No .tmp file should be left behind
		const files = readdirSync(FULL_TEST_DIR);
		const tmpFiles = files.filter((f) => f.endsWith(".tmp"));
		assert.strictEqual(tmpFiles.length, 0, `Expected no .tmp files, found: ${tmpFiles.join(", ")}`);
	});

	it("overwrites an existing profile", async () => {
		const fp = join(FULL_TEST_DIR, "over.md");
		await saveProfile({ name: "Alice" }, fp);
		let content = await readFile(fp, "utf-8");
		assert.ok(content.includes("name: Alice"));

		await saveProfile({ name: "Bob" }, fp);
		content = await readFile(fp, "utf-8");
		assert.ok(content.includes("name: Bob"));
		assert.ok(!content.includes("Alice"));
	});

	it("creates parent directory if it does not exist", async () => {
		const fp = join(FULL_TEST_DIR, "sub", "dir", "p.md");
		await saveProfile({ name: "test" }, fp);
		const content = await readFile(fp, "utf-8");
		assert.ok(content.includes("name: test"));
	});

	it("skips null and empty-string attributes in output", async () => {
		const fp = join(FULL_TEST_DIR, "nulls.md");
		await saveProfile({ name: "test", dob: null, hobbies: "", notes: "ok" }, fp);
		const content = await readFile(fp, "utf-8");
		assert.ok(content.includes("name: test"));
		assert.ok(content.includes("notes: ok"));
		assert.ok(!content.includes("dob:"));
		assert.ok(!content.includes("hobbies:"));
	});

	it("round-trips: saved profile is readable by loadProfile", async () => {
		const fp = join(FULL_TEST_DIR, "roundtrip.md");
		await saveProfile({ name: "Eve", hobbies: "coding", notes: "likes coffee" }, fp);
		const loaded = await loadProfile(fp);
		assert.ok(loaded !== null);
		assert.strictEqual(loaded.data.name, "Eve");
		assert.strictEqual(loaded.data.hobbies, "coding");
		assert.strictEqual(loaded.data.notes, "likes coffee");
	});
});
