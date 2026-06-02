import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
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
	it("has exactly 10 attributes", () => {
		assert.strictEqual(ATTRIBUTES.length, 10);
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
			"dob",
			"relationship",
			"pets",
			"hobbies",
			"expertise",
			"favoriteBands",
			"favoriteBooks",
			"favoriteTv",
			"favoriteMovies",
			"notes",
		]);
	});

	it("is frozen (immutable)", () => {
		assert.throws(() => {
			ATTRIBUTES.push({ key: "test", prompt: "test", order: 99 });
		});
	});
});

describe("loadProfile", () => {
	it("returns null when profile file does not exist", () => {
		const missing = join(FULL_TEST_DIR, "missing.md");
		assert.strictEqual(loadProfile(missing), null);
	});

	it("returns null when file has no profile attributes", () => {
		const fp = join(FULL_TEST_DIR, "note.md");
		writeFileSync(fp, "---\ntitle: Note\n---\njust a note");
		assert.strictEqual(loadProfile(fp), null);
	});

	it("returns null for empty file content", () => {
		const fp = join(FULL_TEST_DIR, "empty.md");
		writeFileSync(fp, "");
		assert.strictEqual(loadProfile(fp), null);
	});
});

describe("saveProfile", () => {
	it("writes profile file with frontmatter", () => {
		const fp = join(FULL_TEST_DIR, "profile.md");
		saveProfile({ dob: "1990", hobbies: "hiking", pets: "cat" }, fp);
		assert.ok(existsSync(fp), "profile file should exist");
		assert.ok(!existsSync(fp + ".tmp"), "temp file should be gone");
		const content = readFileSync(fp, "utf-8");
		assert.ok(content.startsWith("---"));
		assert.ok(content.includes("title: Context Profile"));
		assert.ok(content.includes('hobbies: "hiking"'));
		assert.ok(content.includes("cat"));
	});

	it("overwrites existing profile", () => {
		const fp = join(FULL_TEST_DIR, "over.md");
		saveProfile({ hobbies: "reading" }, fp);
		let content = readFileSync(fp, "utf-8");
		assert.ok(content.includes("reading"));
		saveProfile({ hobbies: "gaming" }, fp);
		content = readFileSync(fp, "utf-8");
		assert.ok(content.includes("gaming"));
		assert.ok(!content.includes("reading"));
	});

	it("creates parent directory if missing", () => {
		const fp = join(FULL_TEST_DIR, "sub", "dir", "p.md");
		saveProfile({ hobbies: "x" }, fp);
		assert.ok(existsSync(fp));
	});

	it("includes timestamp in frontmatter", () => {
		const fp = join(FULL_TEST_DIR, "ts.md");
		saveProfile({ hobbies: "x" }, fp);
		const content = readFileSync(fp, "utf-8");
		assert.ok(content.includes("timestamp:"));
	});

	it("skips null and empty attributes from frontmatter", () => {
		const fp = join(FULL_TEST_DIR, "nulls.md");
		saveProfile({ dob: null, hobbies: "read", pets: "" }, fp);
		const content = readFileSync(fp, "utf-8");
		assert.ok(content.includes("read"));
	});
});

describe("hasProfile", () => {
	it("returns true when profile file exists", () => {
		const fp = join(FULL_TEST_DIR, "exists.md");
		saveProfile({ hobbies: "x" }, fp);
		assert.strictEqual(hasProfile(fp), true);
	});

	it("returns false when profile file does not exist", () => {
		const fp = join(FULL_TEST_DIR, "nope.md");
		assert.strictEqual(hasProfile(fp), false);
	});
});

describe("formatProfileContext", () => {
	it("formats non-empty attributes as key: value pairs", () => {
		const fm = { dob: "1990", hobbies: "hiking", pets: "cat" };
		const result = formatProfileContext(fm);
		assert.ok(result.startsWith("[Context: Profile]"));
		assert.ok(result.includes("dob: 1990"));
		assert.ok(result.includes("hobbies: hiking"));
		assert.ok(result.includes("pets: cat"));
	});

	it("skips empty attributes", () => {
		const fm = { dob: "", hobbies: "reading", pets: "   " };
		const result = formatProfileContext(fm);
		assert.ok(result.startsWith("[Context: Profile]"));
		assert.ok(!result.includes("dob:"));
		assert.ok(!result.includes("pets:"));
		assert.ok(result.includes("hobbies: reading"));
	});

	it("returns empty string for empty frontmatter", () => {
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
		assert.deepStrictEqual(a, { key: "dob", prompt: "When is your date of birth?", order: 0 });
		const b = getAttribute(5);
		assert.deepStrictEqual(b, {
			key: "favoriteBands",
			prompt: "What are your favorite bands?",
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
		const data = { hobbies: "reading", unknown: "x", pets: "dog" };
		const result = sanitizeProfileData(data);
		assert.deepStrictEqual(result, { hobbies: "reading", pets: "dog" });
	});

	it("converts non-string values to strings", () => {
		const result = sanitizeProfileData({ dob: 1990, hobbies: "read" });
		assert.strictEqual(result.dob, "1990");
		assert.strictEqual(result.hobbies, "read");
	});

	it("handles null/undefined values", () => {
		const result = sanitizeProfileData({ dob: null, hobbies: undefined, pets: "cat" });
		assert.strictEqual(result.dob, "");
		assert.strictEqual(result.hobbies, "");
		assert.strictEqual(result.pets, "cat");
	});
});
