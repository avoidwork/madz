import { describe, it } from "node:test";
import assert from "node:assert";
import {
	getActiveProviderConfig,
	getActiveProviderName,
	getActiveModelName,
} from "../../../src/provider/index.js";

describe("getActiveProviderConfig", () => {
	it("returns the first configured provider", () => {
		const config = {
			providers: {
				openai: { model: "gpt-4o" },
				anthropic: { model: "claude-3-5-sonnet" },
			},
		};
		assert.deepStrictEqual(getActiveProviderConfig(config), { model: "gpt-4o" });
	});

	it("falls back to openai when no provider is configured", () => {
		const config = { providers: {} };
		assert.deepStrictEqual(getActiveProviderConfig(config), {});
	});

	it("returns an empty object when config has no providers", () => {
		assert.deepStrictEqual(getActiveProviderConfig({}), {});
	});

	it("selects the first enabled provider when the first is disabled", () => {
		const config = {
			providers: {
				openai: { model: "gpt-4o", enabled: false },
				copilot: { model: "gpt-4o", type: "github-copilot", enabled: true },
			},
		};
		assert.deepStrictEqual(getActiveProviderConfig(config), {
			model: "gpt-4o",
			type: "github-copilot",
			enabled: true,
		});
	});

	it("falls back to the openai provider config when all providers are disabled", () => {
		const config = {
			providers: {
				openai: { model: "gpt-4o", enabled: false },
				copilot: { model: "gpt-4o", type: "github-copilot", enabled: false },
			},
		};
		assert.deepStrictEqual(getActiveProviderConfig(config), {
			model: "gpt-4o",
			enabled: false,
		});
	});

	it("treats a provider without an enabled field as enabled", () => {
		const config = {
			providers: {
				openai: { model: "gpt-4o" },
				copilot: { model: "gpt-4o", type: "github-copilot" },
			},
		};
		assert.deepStrictEqual(getActiveProviderConfig(config), { model: "gpt-4o" });
	});
});

describe("getActiveProviderName", () => {
	it("returns the first enabled provider name", () => {
		const config = {
			providers: {
				openai: { model: "gpt-4o", enabled: false },
				copilot: { model: "gpt-4o", enabled: true },
			},
		};
		assert.strictEqual(getActiveProviderName(config), "copilot");
	});

	it("returns copilot when it is enabled but not the first provider key", () => {
		// Regression: the init-time auth flow in index.js used the first config
		// key, ignoring the enabled flag. When copilot is enabled but listed
		// after openai (disabled), the active provider must be copilot so the
		// OAuth device flow triggers.
		const config = {
			providers: {
				openai: { model: "gpt-4o", enabled: false },
				copilot: { model: "gpt-4o", type: "github-copilot", enabled: true },
			},
		};
		assert.strictEqual(getActiveProviderName(config), "copilot");
	});

	it("falls back to openai when no provider is enabled", () => {
		const config = {
			providers: {
				openai: { model: "gpt-4o", enabled: false },
				copilot: { model: "gpt-4o", enabled: false },
			},
		};
		assert.strictEqual(getActiveProviderName(config), "openai");
	});

	it("returns openai when config has no providers", () => {
		assert.strictEqual(getActiveProviderName({}), "openai");
	});
});

describe("getActiveModelName", () => {
	it("returns the model of the first configured provider", () => {
		const config = {
			providers: {
				openai: { model: "gpt-4o" },
				anthropic: { model: "claude-3-5-sonnet" },
			},
		};
		assert.strictEqual(getActiveModelName(config), "gpt-4o");
	});

	it("returns an empty string when no model is configured", () => {
		assert.strictEqual(getActiveModelName({ providers: {} }), "");
	});

	it("returns an empty string when config is undefined", () => {
		assert.strictEqual(getActiveModelName(undefined), "");
	});
});
