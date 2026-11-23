import { describe, it } from "node:test";
import assert from "node:assert";
import { parseArgs } from "../../index.js";

describe("parseArgs", () => {
	it("reads the message from the --message flag", () => {
		const args = parseArgs(["--message", "what is today's date?"]);
		assert.strictEqual(args.message, "what is today's date?");
	});

	it("reads the message from positional args", () => {
		const args = parseArgs(["what is today's date?"]);
		assert.strictEqual(args.message, "what is today's date?");
	});

	it("joins multiple positional words into the message", () => {
		const args = parseArgs(["run", "the", "reflection", "skill"]);
		assert.strictEqual(args.message, "run the reflection skill");
	});

	it("returns undefined message when no message is supplied", () => {
		const args = parseArgs([]);
		assert.strictEqual(args.message, undefined);
	});

	it("parses mode, session and index-code options", () => {
		const args = parseArgs(["--mode", "interactive", "--session", "abc", "--index-code"]);
		assert.strictEqual(args.mode, "interactive");
		assert.strictEqual(args.session, "abc");
		assert.strictEqual(args.indexCode, true);
	});
});
