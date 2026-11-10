import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BrowserSchema } from "../../../../src/config/schemas/browser.js";

describe("BrowserSchema", () => {
	it("applies the defaults", () => {
		assert.deepStrictEqual(BrowserSchema.parse({}), {
			allowlist: [],
			timeoutMs: 30000,
			sessionIdleTimeoutMs: 300000,
			maxSessions: 5,
			maxContentChars: 200000,
			networkIdleMs: 500,
		});
	});

	it("accepts overrides", () => {
		const result = BrowserSchema.parse({ allowlist: ["example.com"], maxSessions: 2 });
		assert.deepStrictEqual(result.allowlist, ["example.com"]);
		assert.strictEqual(result.maxSessions, 2);
	});

	it("rejects non-positive numbers", () => {
		assert.throws(() => BrowserSchema.parse({ maxSessions: 0 }));
		assert.throws(() => BrowserSchema.parse({ timeoutMs: -1 }));
	});
});
