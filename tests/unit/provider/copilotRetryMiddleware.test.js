import { describe, it } from "node:test";
import assert from "node:assert";
import { createCopilotRetryMiddleware } from "../../../src/provider/copilotRetryMiddleware.js";

/** No-op sleep so retry tests do not wait real seconds. */
const noSleep = async () => {};

/** Minimal wrapModelCall request shape. */
function makeRequest() {
	return { messages: [], systemMessage: null, model: {} };
}

describe("createCopilotRetryMiddleware", () => {
	it("names the middleware CopilotRetry and exposes wrapModelCall", () => {
		const mw = createCopilotRetryMiddleware();
		assert.strictEqual(mw.name, "CopilotRetry");
		assert.strictEqual(typeof mw.wrapModelCall, "function");
	});

	it("returns the result on success without retrying", async () => {
		const mw = createCopilotRetryMiddleware({ sleep: noSleep });
		let calls = 0;
		const result = await mw.wrapModelCall(makeRequest(), async () => {
			calls += 1;
			return "ok";
		});
		assert.strictEqual(result, "ok");
		assert.strictEqual(calls, 1);
	});

	it("retries a 403 up to maxRetries times then succeeds", async () => {
		const mw = createCopilotRetryMiddleware({ maxRetries: 3, sleep: noSleep });
		let calls = 0;
		const result = await mw.wrapModelCall(makeRequest(), async () => {
			calls += 1;
			if (calls < 3) {
				const err = new Error("rate limited");
				err.status = 403;
				throw err;
			}
			return "ok";
		});
		assert.strictEqual(result, "ok");
		assert.strictEqual(calls, 3);
	});

	it("throws after exhausting all retries on a persistent 403", async () => {
		const mw = createCopilotRetryMiddleware({ maxRetries: 3, sleep: noSleep });
		let calls = 0;
		await assert.rejects(
			mw.wrapModelCall(makeRequest(), async () => {
				calls += 1;
				const err = new Error("rate limited");
				err.status = 403;
				throw err;
			}),
			/rate limited/,
		);
		assert.strictEqual(calls, 4);
	});

	it("does not retry non-403 errors", async () => {
		const mw = createCopilotRetryMiddleware({ maxRetries: 3, sleep: noSleep });
		let calls = 0;
		await assert.rejects(
			mw.wrapModelCall(makeRequest(), async () => {
				calls += 1;
				const err = new Error("bad request");
				err.status = 400;
				throw err;
			}),
			/bad request/,
		);
		assert.strictEqual(calls, 1);
	});

	it("does not retry 429 (handled by the OpenAI SDK)", async () => {
		const mw = createCopilotRetryMiddleware({ maxRetries: 3, sleep: noSleep });
		let calls = 0;
		await assert.rejects(
			mw.wrapModelCall(makeRequest(), async () => {
				calls += 1;
				const err = new Error("rate limited");
				err.status = 429;
				throw err;
			}),
			/rate limited/,
		);
		assert.strictEqual(calls, 1);
	});

	it("honors the retry-after header for the delay", async () => {
		const delays = [];
		const mw = createCopilotRetryMiddleware({
			maxRetries: 1,
			sleep: async (ms) => delays.push(ms),
		});
		await assert.rejects(
			mw.wrapModelCall(makeRequest(), async () => {
				const err = new Error("rate limited");
				err.status = 403;
				err.headers = { "retry-after": "2" };
				throw err;
			}),
			/rate limited/,
		);
		assert.deepStrictEqual(delays, [2000]);
	});
});
