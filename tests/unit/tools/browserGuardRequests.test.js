import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { guardRequests } from "../../../src/tools/browser/browser.js";

const makePage = () => {
	const state = { interception: false, handler: null };
	const page = {
		setRequestInterception: async (enabled) => {
			state.interception = enabled;
		},
		on: (event, handler) => {
			if (event === "request") state.handler = handler;
		},
	};
	return { page, state };
};

const makeRequest = (url, seen) => ({
	url: () => url,
	continue: async () => seen.push(["continue", url]),
	abort: async (code) => seen.push(["abort", url, code]),
});

describe("guardRequests", () => {
	it("enables request interception", async () => {
		const { page, state } = makePage();
		await guardRequests(page, []);
		assert.strictEqual(state.interception, true);
		assert.strictEqual(typeof state.handler, "function");
	});

	it("continues requests to allowlisted hosts and aborts the rest", async () => {
		const { page, state } = makePage();
		await guardRequests(page, ["example.com", "*.cdn.test"]);
		const seen = [];
		for (const url of [
			"https://example.com/a",
			"https://img.cdn.test/b.png",
			"https://evil.test/c",
			"http://169.254.169.254/latest",
		]) {
			state.handler(makeRequest(url, seen));
		}
		assert.deepStrictEqual(seen, [
			["continue", "https://example.com/a"],
			["continue", "https://img.cdn.test/b.png"],
			["abort", "https://evil.test/c", "blockedbyclient"],
			["abort", "http://169.254.169.254/latest", "blockedbyclient"],
		]);
	});

	it("allows any http(s) host when the allowlist is empty", async () => {
		const { page, state } = makePage();
		await guardRequests(page, []);
		const seen = [];
		state.handler(makeRequest("https://anywhere.test/", seen));
		assert.deepStrictEqual(seen, [["continue", "https://anywhere.test/"]]);
	});

	it("aborts blocked schemes even when the allowlist is empty", async () => {
		const { page, state } = makePage();
		await guardRequests(page, []);
		const seen = [];
		state.handler(makeRequest("file:///etc/passwd", seen));
		state.handler(makeRequest("gopher://host/", seen));
		assert.deepStrictEqual(seen, [
			["abort", "file:///etc/passwd", "blockedbyclient"],
			["abort", "gopher://host/", "blockedbyclient"],
		]);
	});

	it("lets local schemes through regardless of the allowlist", async () => {
		const { page, state } = makePage();
		await guardRequests(page, ["example.com"]);
		const seen = [];
		for (const url of ["data:text/plain,hi", "blob:https://example.com/id", "about:blank"]) {
			state.handler(makeRequest(url, seen));
		}
		assert.deepStrictEqual(
			seen.map(([action]) => action),
			["continue", "continue", "continue"],
		);
	});

	it("does not throw when handling a request fails", async () => {
		const { page, state } = makePage();
		await guardRequests(page, ["example.com"]);
		state.handler({
			url: () => "https://evil.test/",
			continue: async () => {},
			abort: async () => {
				throw new Error("target closed");
			},
		});
		await new Promise((resolve) => setImmediate(resolve));
	});
});
