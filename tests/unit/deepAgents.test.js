/**
 * Deep Agents tests.
 * Tests the createDeepAgentsOrchestrator function and its internal helpers.
 */

import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert";
import { renameSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("createDeepAgentsOrchestrator", () => {
	let savedApiKey;
	let savedEmailGmailClientId;
	let savedEmailGmailClientSecret;
	let savedEmailGmailRefreshToken;

	before(() => {
		savedApiKey = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "sk-test-dummy";

		savedEmailGmailClientId = process.env.EMAIL_GMAIL_CLIENT_ID;
		savedEmailGmailClientSecret = process.env.EMAIL_GMAIL_CLIENT_SECRET;
		savedEmailGmailRefreshToken = process.env.EMAIL_GMAIL_REFRESH_TOKEN;
	});

	after(() => {
		if (savedApiKey !== undefined) {
			process.env.OPENAI_API_KEY = savedApiKey;
		} else {
			delete process.env.OPENAI_API_KEY;
		}

		if (savedEmailGmailClientId !== undefined) {
			process.env.EMAIL_GMAIL_CLIENT_ID = savedEmailGmailClientId;
		} else {
			delete process.env.EMAIL_GMAIL_CLIENT_ID;
		}
		if (savedEmailGmailClientSecret !== undefined) {
			process.env.EMAIL_GMAIL_CLIENT_SECRET = savedEmailGmailClientSecret;
		} else {
			delete process.env.EMAIL_GMAIL_CLIENT_SECRET;
		}
		if (savedEmailGmailRefreshToken !== undefined) {
			process.env.EMAIL_GMAIL_REFRESH_TOKEN = savedEmailGmailRefreshToken;
		} else {
			delete process.env.EMAIL_GMAIL_REFRESH_TOKEN;
		}
	});

	it("should create an orchestrator instance", async () => {
		// Set valid email env vars so provider validation passes
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-client-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-client-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-refresh-token";

		const { createDeepAgentsOrchestrator } = await import("../../src/agent/deepAgents.js");
		const result = await createDeepAgentsOrchestrator();
		assert.ok(result, "Should return an orchestrator");
		assert.ok(typeof result === "object", "Orchestrator should be an object");
	});

	it("should accept an optional checkpointer", async () => {
		// Set valid email env vars so provider validation passes
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-client-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-client-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-refresh-token";

		const { createDeepAgentsOrchestrator } = await import("../../src/agent/deepAgents.js");
		const mockCheckpointer = {
			get: async () => null,
			set: async () => undefined,
		};
		const result = await createDeepAgentsOrchestrator(mockCheckpointer);
		assert.ok(result, "Should return an orchestrator with checkpointer");
	});

	it("should handle missing AGENTS.md gracefully", async () => {
		// Set valid email env vars so provider validation passes
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-client-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-client-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-refresh-token";

		const agentsPath = join(process.cwd(), "AGENTS.md");
		const backupPath = join(process.cwd(), "AGENTS.md.bak");

		if (existsSync(agentsPath)) {
			renameSync(agentsPath, backupPath);
		}

		try {
			const { createDeepAgentsOrchestrator } = await import("../../src/agent/deepAgents.js");
			const result = await createDeepAgentsOrchestrator();
			assert.ok(result, "Should still create orchestrator without AGENTS.md");
		} finally {
			if (existsSync(backupPath)) {
				renameSync(backupPath, agentsPath);
			}
		}
	});

	it("should handle email provider config validation failure gracefully", async () => {
		// Don't set email env vars so validateProviderConfig returns invalid
		delete process.env.EMAIL_GMAIL_CLIENT_ID;
		delete process.env.EMAIL_GMAIL_CLIENT_SECRET;
		delete process.env.EMAIL_GMAIL_REFRESH_TOKEN;

		const { createDeepAgentsOrchestrator } = await import("../../src/agent/deepAgents.js");
		const result = await createDeepAgentsOrchestrator();
		assert.ok(
			result,
			"Should create orchestrator even when email provider config validation fails",
		);
	});

	it("should handle email provider instance validation failure gracefully", async () => {
		// Set valid env vars so validateProviderConfig passes
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-client-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-client-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-refresh-token";

		// Mock GmailProvider.prototype.validateConfig to return invalid
		const gmailMod = await import("../../src/tools/email/providers/gmail.js");
		mock.method(gmailMod.GmailProvider.prototype, "validateConfig", () => ({
			valid: false,
			errors: ["Mock instance validation failure"],
		}));

		try {
			const { createDeepAgentsOrchestrator } = await import("../../src/agent/deepAgents.js");
			const result = await createDeepAgentsOrchestrator();
			assert.ok(
				result,
				"Should create orchestrator even when email provider instance validation fails",
			);
		} finally {
			mock.reset();
		}
	});

	it("should handle email provider creation failure gracefully", async () => {
		// Set valid env vars so validateProviderConfig passes
		process.env.EMAIL_GMAIL_CLIENT_ID = "test-client-id";
		process.env.EMAIL_GMAIL_CLIENT_SECRET = "test-client-secret";
		process.env.EMAIL_GMAIL_REFRESH_TOKEN = "test-refresh-token";

		// Mock GmailProvider.prototype.validateConfig to throw
		const gmailMod = await import("../../src/tools/email/providers/gmail.js");
		mock.method(gmailMod.GmailProvider.prototype, "validateConfig", () => {
			throw new Error("Mock validateConfig failure");
		});

		try {
			const { createDeepAgentsOrchestrator } = await import("../../src/agent/deepAgents.js");
			const result = await createDeepAgentsOrchestrator();
			assert.ok(
				result,
				"Should create orchestrator even when email provider validateConfig throws",
			);
		} finally {
			mock.reset();
		}
	});
});
