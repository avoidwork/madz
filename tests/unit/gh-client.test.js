import { describe, it } from "node:test";
import assert from "node:assert";
import { createGhClient } from "../../src/gh-client.js";

function mockFetch(response) {
	globalThis.fetch = async (url, options) => {
		mockFetch.lastUrl = url;
		mockFetch.lastOptions = options;
		return response;
	};
}

function mockSuccessResponse(body = { id: 1, number: 42 }) {
	mockFetch({
		ok: true,
		status: 200,
		headers: new Map([["content-type", "application/json"]]),
		text: async () => JSON.stringify(body),
		json: async () => body,
	});
}

function mockErrorResponse(status, body = { message: "Not Found" }) {
	mockFetch({
		ok: false,
		status,
		headers: new Map([["content-type", "application/json"]]),
		text: async () => JSON.stringify(body),
		json: async () => body,
	});
}

function getAuthHeader(_client) {
	const req = mockFetch.lastOptions;
	return req?.headers?.Authorization;
}

function getAcceptHeader(_client) {
	const req = mockFetch.lastOptions;
	return req?.headers?.Accept;
}

describe("gh-client - instantiation", () => {
	it("throws TypeError when token is missing", () => {
		assert.throws(
			() => createGhClient({ owner: "test", repo: "test", token: undefined }),
			TypeError,
		);
	});

	it("throws TypeError when token is empty string", () => {
		assert.throws(() => createGhClient({ owner: "test", repo: "test", token: "" }), TypeError);
	});

	it("creates client successfully with valid config", () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		assert.ok(client);
		assert.strictEqual(typeof client.createIssue, "function");
		assert.strictEqual(typeof client.viewIssue, "function");
		assert.strictEqual(typeof client.editIssue, "function");
		assert.strictEqual(typeof client.listIssues, "function");
		assert.strictEqual(typeof client.createPR, "function");
		assert.strictEqual(typeof client.viewPR, "function");
		assert.strictEqual(typeof client.editPR, "function");
		assert.strictEqual(typeof client.listPRs, "function");
		assert.strictEqual(typeof client.mergePR, "function");
		assert.strictEqual(typeof client.createComment, "function");
	});

	it("uses default base URL when not provided", () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		assert.ok(client);
	});

	it("accepts custom base URL", () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
			baseUrl: "https://api.github.com",
		});
		assert.ok(client);
	});
});

describe("gh-client - issue CRUD", () => {
	it("createIssue sends correct request", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		mockSuccessResponse({ id: 1, number: 42, title: "Test Issue" });
		const result = await client.createIssue({
			title: "Test Issue",
			body: "Test body",
			labels: ["bug"],
		});
		assert.strictEqual(result.error, null);
		assert.strictEqual(result.data.id, 1);
		assert.strictEqual(mockFetch.lastUrl, "https://api.github.com/repos/avoidwork/madz/issues");
		assert.strictEqual(getAuthHeader(), "Bearer ghp_test123");
		assert.strictEqual(getAcceptHeader(), "application/vnd.github+json");
		const body = JSON.parse(mockFetch.lastOptions.body);
		assert.strictEqual(body.title, "Test Issue");
		assert.strictEqual(body.labels.length, 1);
	});

	it("viewIssue sends correct request", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		mockSuccessResponse({ id: 1, number: 42 });
		const result = await client.viewIssue(42);
		assert.strictEqual(result.error, null);
		assert.strictEqual(mockFetch.lastUrl, "https://api.github.com/repos/avoidwork/madz/issues/42");
		assert.strictEqual(mockFetch.lastOptions.method, "GET");
	});

	it("editIssue sends correct request", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		mockSuccessResponse({ id: 1, number: 42, state: "closed" });
		const result = await client.editIssue(42, { state: "closed" });
		assert.strictEqual(result.error, null);
		assert.strictEqual(mockFetch.lastUrl, "https://api.github.com/repos/avoidwork/madz/issues/42");
		assert.strictEqual(mockFetch.lastOptions.method, "PATCH");
		const body = JSON.parse(mockFetch.lastOptions.body);
		assert.strictEqual(body.state, "closed");
	});

	it("listIssues sends correct request with params", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		mockSuccessResponse([{ id: 1, number: 42 }]);
		const result = await client.listIssues({ state: "open", page: 1, perPage: 30 });
		assert.strictEqual(result.error, null);
		assert.ok(mockFetch.lastUrl.includes("state=open"));
		assert.ok(mockFetch.lastUrl.includes("page=1"));
		assert.ok(mockFetch.lastUrl.includes("per_page=30"));
	});

	it("listIssues uses defaults when no params", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		mockSuccessResponse([]);
		const result = await client.listIssues();
		assert.strictEqual(result.error, null);
		assert.ok(mockFetch.lastUrl.includes("page=1"));
		assert.ok(mockFetch.lastUrl.includes("per_page=30"));
	});
});

describe("gh-client - PR CRUD", () => {
	it("createPR sends correct request", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		mockSuccessResponse({ id: 1, number: 10, title: "New Feature" });
		const result = await client.createPR({
			title: "New Feature",
			body: "Adds new feature",
			head: "feature-branch",
			base: "main",
		});
		assert.strictEqual(result.error, null);
		assert.strictEqual(mockFetch.lastUrl, "https://api.github.com/repos/avoidwork/madz/pulls");
		assert.strictEqual(mockFetch.lastOptions.method, "POST");
		const body = JSON.parse(mockFetch.lastOptions.body);
		assert.strictEqual(body.head, "feature-branch");
		assert.strictEqual(body.base, "main");
	});

	it("viewPR sends correct request", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		mockSuccessResponse({ id: 1, number: 10 });
		const result = await client.viewPR(10);
		assert.strictEqual(result.error, null);
		assert.strictEqual(mockFetch.lastUrl, "https://api.github.com/repos/avoidwork/madz/pulls/10");
		assert.strictEqual(mockFetch.lastOptions.method, "GET");
	});

	it("editPR sends correct request", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		mockSuccessResponse({ id: 1, number: 10, state: "closed" });
		const result = await client.editPR(10, { state: "closed" });
		assert.strictEqual(result.error, null);
		assert.strictEqual(mockFetch.lastUrl, "https://api.github.com/repos/avoidwork/madz/pulls/10");
		assert.strictEqual(mockFetch.lastOptions.method, "PATCH");
		const body = JSON.parse(mockFetch.lastOptions.body);
		assert.strictEqual(body.state, "closed");
	});

	it("listPRs sends correct request with params", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		mockSuccessResponse([]);
		const result = await client.listPRs({ state: "open", page: 1, perPage: 30 });
		assert.strictEqual(result.error, null);
		assert.ok(mockFetch.lastUrl.includes("state=open"));
		assert.ok(mockFetch.lastUrl.includes("page=1"));
		assert.ok(mockFetch.lastUrl.includes("per_page=30"));
	});

	it("mergePR sends correct request", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		mockSuccessResponse({ merged: true });
		const result = await client.mergePR(10, { merge_method: "squash" });
		assert.strictEqual(result.error, null);
		assert.strictEqual(
			mockFetch.lastUrl,
			"https://api.github.com/repos/avoidwork/madz/pulls/10/merge",
		);
		assert.strictEqual(mockFetch.lastOptions.method, "PUT");
		const body = JSON.parse(mockFetch.lastOptions.body);
		assert.strictEqual(body.merge_method, "squash");
	});
});

describe("gh-client - comments", () => {
	it("createComment sends correct request", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		mockSuccessResponse({ id: 1, body: "LGTM" });
		const result = await client.createComment(42, { body: "LGTM" });
		assert.strictEqual(result.error, null);
		assert.strictEqual(
			mockFetch.lastUrl,
			"https://api.github.com/repos/avoidwork/madz/issues/42/comments",
		);
		assert.strictEqual(mockFetch.lastOptions.method, "POST");
		const body = JSON.parse(mockFetch.lastOptions.body);
		assert.strictEqual(body.body, "LGTM");
	});
});

describe("gh-client - error handling", () => {
	it("returns error for 404 response", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		mockErrorResponse(404, { message: "Not Found" });
		const result = await client.viewIssue(999999);
		assert.strictEqual(result.data, null);
		assert.ok(result.error);
		assert.strictEqual(result.error.status, 404);
	});

	it("returns error for 401 response", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		mockErrorResponse(401, { message: "Bad credentials" });
		const result = await client.viewIssue(42);
		assert.strictEqual(result.data, null);
		assert.ok(result.error);
		assert.strictEqual(result.error.status, 401);
	});

	it("returns error for 403 response", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		mockErrorResponse(403, { message: "Forbidden" });
		const result = await client.viewIssue(42);
		assert.strictEqual(result.data, null);
		assert.ok(result.error);
		assert.strictEqual(result.error.status, 403);
	});

	it("returns error with retryAfter for 429 response", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		const headers = new Map([
			["content-type", "application/json"],
			["Retry-After", "60"],
		]);
		mockFetch({
			ok: false,
			status: 429,
			headers,
			text: async () => JSON.stringify({ message: "Rate Limited" }),
		});
		const result = await client.listIssues();
		assert.strictEqual(result.data, null);
		assert.ok(result.error);
		assert.strictEqual(result.error.status, 429);
		assert.strictEqual(result.error.retryAfter, 60);
	});

	it("returns error for non-JSON error response", async () => {
		const client = createGhClient({
			owner: "avoidwork",
			repo: "madz",
			token: "ghp_test123",
		});
		mockFetch({
			ok: false,
			status: 502,
			headers: new Map(),
			text: async () => "Bad Gateway",
		});
		const result = await client.viewIssue(42);
		assert.strictEqual(result.data, null);
		assert.ok(result.error);
	});
});
