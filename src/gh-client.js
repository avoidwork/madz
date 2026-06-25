import { fetchWithTimeout } from "./tools/common.js";

const DEFAULT_BASE_URL = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 10000;
const GITHUB_API_HEADERS = {
	Accept: "application/vnd.github+json",
	"X-GitHub-Api-Version": "2022-11-28",
};

/**
 * GitHub REST API client.
 * @hideconstructor
 */
export class GhClient {
	/**
	 * @param {object} config - Client configuration
	 * @param {string} config.owner - GitHub repository owner
	 * @param {string} config.repo - GitHub repository name
	 * @param {string} config.token - GitHub personal access token
	 * @param {string} [config.baseUrl] - API base URL
	 */
	constructor({ owner, repo, token, baseUrl = DEFAULT_BASE_URL }) {
		if (!token) {
			throw new TypeError(
				`GITHUB_TOKEN is required. Set the GITHUB_TOKEN environment variable or pass token in config.`,
			);
		}
		this.#owner = owner;
		this.#repo = repo;
		this.#token = token;
		this.#baseUrl = baseUrl;
		this.#timeoutMs = DEFAULT_TIMEOUT_MS;
	}

	#owner;
	#repo;
	#token;
	#baseUrl;
	#timeoutMs;

	/**
	 * Make an authenticated API request.
	 * @param {string} method - HTTP method
	 * @param {string} path - API path (without base URL)
	 * @param {object} [body] - Request body (will be JSON-stringified)
	 * @returns {Promise<{ data: object|null, error: object|null }>}
	 */
	async _request(method, path, body) {
		const url = `${this.#baseUrl}/repos/${this.#owner}/${this.#repo}${path}`;
		const headers = {
			...GITHUB_API_HEADERS,
			Authorization: `Bearer ${this.#token}`,
		};

		const options = {
			method,
			headers,
		};

		if (body && Object.keys(body).length > 0) {
			headers["Content-Type"] = "application/json";
			options.body = JSON.stringify(body);
		}

		const result = await fetchWithTimeout(url, this.#timeoutMs, [], options);

		if (!result.ok) {
			let errorData = null;
			let errorMessage = result.error;

			try {
				const parsed = JSON.parse(result.body || "{}");
				errorMessage = parsed.message || result.error;
				errorData = { status: 0, message: errorMessage };
			} catch {
				errorMessage = result.body || result.error;
				errorData = { status: 0, message: errorMessage };
			}

			const statusMatch = result.error.match(/HTTP (\d+)/);
			if (statusMatch) {
				errorData.status = parseInt(statusMatch[1], 10);
			}

			if (errorData.status === 429) {
				const retryAfter = result.headers?.get("Retry-After");
				if (retryAfter) {
					errorData.retryAfter = parseInt(retryAfter, 10);
				}
			}

			if (result.error && result.error.includes("timed out")) {
				errorData.status = 0;
				errorData.message = `Request timed out after ${this.#timeoutMs}ms`;
			}

			return { data: null, error: errorData };
		}

		try {
			const data = JSON.parse(result.body);
			return { data, error: null };
		} catch {
			return { data: null, error: { status: 0, message: "Failed to parse response" } };
		}
	}

	// --- Issue Methods ---

	/**
	 * Create an issue.
	 * @param {object} params - Issue parameters
	 * @param {string} params.title - Issue title
	 * @param {string} params.body - Issue body (markdown)
	 * @param {string[]} [params.labels] - Array of label names
	 * @returns {Promise<{ data: object|null, error: object|null }>}
	 */
	async createIssue({ title, body, labels }) {
		return this._request("POST", "/issues", { title, body, labels: labels || [] });
	}

	/**
	 * View an issue by number.
	 * @param {number} number - Issue number
	 * @returns {Promise<{ data: object|null, error: object|null }>}
	 */
	async viewIssue(number) {
		return this._request("GET", `/issues/${number}`);
	}

	/**
	 * Edit an issue.
	 * @param {number} number - Issue number
	 * @param {object} params - Fields to update
	 * @param {string} [params.title] - New title
	 * @param {string} [params.body] - New body
	 * @param {string[]} [params.labels] - New label array
	 * @param {string} [params.state] - "open" or "closed"
	 * @returns {Promise<{ data: object|null, error: object|null }>}
	 */
	async editIssue(number, { title, body, labels, state }) {
		const updates = {};
		if (title !== undefined) updates.title = title;
		if (body !== undefined) updates.body = body;
		if (labels !== undefined) updates.labels = labels;
		if (state !== undefined) updates.state = state;
		return this._request("PATCH", `/issues/${number}`, updates);
	}

	/**
	 * List issues in the repository.
	 * @param {object} [params] - List parameters
	 * @param {string} [params.state] - "open", "closed", or "all"
	 * @param {string[]} [params.labels] - Filter by labels
	 * @param {number} [params.page=1] - Page number
	 * @param {number} [params.perPage=30] - Items per page (max 100)
	 * @returns {Promise<{ data: object|null, error: object|null }>}
	 */
	async listIssues({ state, labels, page = 1, perPage = 30 } = {}) {
		const parts = [];
		if (state) parts.push(`state=${state}`);
		if (labels) parts.push(`labels=${labels.join(",")}`);
		parts.push(`page=${page}`);
		parts.push(`per_page=${perPage}`);
		const query = parts.join("&");
		return this._request("GET", `/issues?${query}`);
	}

	// --- PR Methods ---

	/**
	 * Create a pull request.
	 * @param {object} params - PR parameters
	 * @param {string} params.title - PR title
	 * @param {string} params.body - PR body (markdown)
	 * @param {string} params.head - Head branch name
	 * @param {string} params.base - Base branch name
	 * @returns {Promise<{ data: object|null, error: object|null }>}
	 */
	async createPR({ title, body, head, base }) {
		return this._request("POST", "/pulls", { title, body, head, base });
	}

	/**
	 * View a pull request by number.
	 * @param {number} number - PR number
	 * @returns {Promise<{ data: object|null, error: object|null }>}
	 */
	async viewPR(number) {
		return this._request("GET", `/pulls/${number}`);
	}

	/**
	 * Edit a pull request.
	 * @param {number} number - PR number
	 * @param {object} params - Fields to update
	 * @param {string} [params.title] - New title
	 * @param {string} [params.body] - New body
	 * @param {string} [params.state] - "open" or "closed"
	 * @param {boolean} [params.draft] - Draft state
	 * @returns {Promise<{ data: object|null, error: object|null }>}
	 */
	async editPR(number, { title, body, state, draft }) {
		const updates = {};
		if (title !== undefined) updates.title = title;
		if (body !== undefined) updates.body = body;
		if (state !== undefined) updates.state = state;
		if (draft !== undefined) updates.draft = draft;
		return this._request("PATCH", `/pulls/${number}`, updates);
	}

	/**
	 * List pull requests in the repository.
	 * @param {object} [params] - List parameters
	 * @param {string} [params.state] - "open", "closed", or "all"
	 * @param {number} [params.page=1] - Page number
	 * @param {number} [params.perPage=30] - Items per page (max 100)
	 * @returns {Promise<{ data: object|null, error: object|null }>}
	 */
	async listPRs({ state, page = 1, perPage = 30 } = {}) {
		const parts = [];
		if (state) parts.push(`state=${state}`);
		parts.push(`page=${page}`);
		parts.push(`per_page=${perPage}`);
		const query = parts.join("&");
		return this._request("GET", `/pulls?${query}`);
	}

	/**
	 * Merge a pull request.
	 * @param {number} number - PR number
	 * @param {object} [params] - Merge parameters
	 * @param {string} [params.commit_title] - Merge commit title
	 * @param {string} [params.merge_method] - "merge", "squash", or "rebase"
	 * @returns {Promise<{ data: object|null, error: object|null }>}
	 */
	async mergePR(number, { commit_title, merge_method = "merge" } = {}) {
		const body = {};
		if (commit_title) body.commit_title = commit_title;
		body.merge_method = merge_method;
		return this._request("PUT", `/pulls/${number}/merge`, body);
	}

	// --- Comment Methods ---

	/**
	 * Create a comment on an issue or PR.
	 * @param {number} number - Issue or PR number
	 * @param {object} params - Comment parameters
	 * @param {string} params.body - Comment body (markdown)
	 * @returns {Promise<{ data: object|null, error: object|null }>}
	 */
	async createComment(number, { body }) {
		return this._request("POST", `/issues/${number}/comments`, { body });
	}
}

/**
 * Create a GitHub API client instance.
 * @param {object} config - Client configuration
 * @param {string} config.owner - GitHub repository owner
 * @param {string} config.repo - GitHub repository name
 * @param {string} config.token - GitHub personal access token (GITHUB_TOKEN env var)
 * @param {string} [config.baseUrl] - API base URL (default: https://api.github.com)
 * @returns {GhClient} A configured client instance
 * @throws {TypeError} If token is missing
 */
export function createGhClient(config) {
	return new GhClient(config);
}