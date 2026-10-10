import { describe, it } from "node:test";
import assert from "node:assert";
import {
	deriveCommandFilter,
	shouldOpenCommandPicker,
	replaceCommandToken,
	MAX_VISIBLE,
} from "../../../src/tui/commandPicker.js";

describe("deriveCommandFilter", () => {
	it("is active when cursor is within a / token", () => {
		const result = deriveCommandFilter("run /config", 11);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "config");
		assert.strictEqual(result.tokenStart, 4);
		assert.strictEqual(result.tokenEnd, 11);
	});

	it("is inactive when there is no /", () => {
		const result = deriveCommandFilter("run config", 11);
		assert.strictEqual(result.active, false);
	});

	it("is inactive when cursor is before the /", () => {
		const result = deriveCommandFilter("run /config", 3);
		assert.strictEqual(result.active, false);
	});

	it("is inactive when cursor is at the / position", () => {
		const result = deriveCommandFilter("run /config", 4);
		assert.strictEqual(result.active, false);
	});

	it("clamps cursor to value length", () => {
		const result = deriveCommandFilter("run /config", 100);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "config");
	});

	it("is inactive when / is mid-string (URL)", () => {
		const result = deriveCommandFilter("https://example.com", 19);
		assert.strictEqual(result.active, false);
	});

	it("is inactive when / is not preceded by a space", () => {
		const result = deriveCommandFilter("https://example.com", 8);
		assert.strictEqual(result.active, false);
	});

	it("is inactive when / is followed by a space", () => {
		const result = deriveCommandFilter("run / config", 7);
		assert.strictEqual(result.active, false);
	});

	it("is active when / is at the start of the input", () => {
		const result = deriveCommandFilter("/config", 7);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "config");
		assert.strictEqual(result.tokenStart, 0);
		assert.strictEqual(result.tokenEnd, 7);
	});

	it("is inactive on a bare /", () => {
		const result = deriveCommandFilter("/", 1);
		assert.strictEqual(result.active, false);
	});

	it("is inactive when / is followed by a space at the start", () => {
		const result = deriveCommandFilter("/ config", 2);
		assert.strictEqual(result.active, false);
	});

	it("is inactive when / is preceded by a non-space whitespace", () => {
		const result = deriveCommandFilter("run\t/config", 9);
		assert.strictEqual(result.active, false);
	});

	it("is active when the token is followed by whitespace", () => {
		const result = deriveCommandFilter("run /config here", 11);
		assert.strictEqual(result.active, true);
		assert.strictEqual(result.filter, "config");
		assert.strictEqual(result.tokenStart, 4);
		assert.strictEqual(result.tokenEnd, 11);
	});

	it("is inactive when / is mid-word (he/he)", () => {
		const result = deriveCommandFilter("he/he", 5);
		assert.strictEqual(result.active, false);
	});
});

describe("shouldOpenCommandPicker", () => {
	it("opens on a valid / token at a word boundary", () => {
		assert.strictEqual(shouldOpenCommandPicker("run /config"), true);
	});

	it("opens on / at the start of the input", () => {
		assert.strictEqual(shouldOpenCommandPicker("/config"), true);
	});

	it("does not open on / mid-word (he/he)", () => {
		assert.strictEqual(shouldOpenCommandPicker("he/he"), false);
	});

	it("does not open on / mid-string (URL)", () => {
		assert.strictEqual(shouldOpenCommandPicker("https://example.com"), false);
	});

	it("does not open on / not preceded by a space", () => {
		assert.strictEqual(shouldOpenCommandPicker("https://example.com"), false);
	});

	it("does not open on a bare /", () => {
		assert.strictEqual(shouldOpenCommandPicker("/"), false);
	});

	it("does not open on / followed by a space", () => {
		assert.strictEqual(shouldOpenCommandPicker("run / config"), false);
	});

	it("does not open when there is no /", () => {
		assert.strictEqual(shouldOpenCommandPicker("run config"), false);
	});
});

describe("replaceCommandToken", () => {
	it("replaces the / token with the selected command, preserving the / prefix", () => {
		const result = replaceCommandToken("run /config", 4, 11, "config");
		assert.strictEqual(result, "run /config ");
	});

	it("replaces a / token at the start of the input, preserving the / prefix", () => {
		const result = replaceCommandToken("/config", 0, 7, "config");
		assert.strictEqual(result, "/config ");
	});

	it("preserves the / prefix when the command is selected mid-input", () => {
		const result = replaceCommandToken("run /config here", 4, 11, "config");
		assert.strictEqual(result, "run /config  here");
	});
});

describe("MAX_VISIBLE", () => {
	it("is 3", () => {
		assert.strictEqual(MAX_VISIBLE, 3);
	});
});
