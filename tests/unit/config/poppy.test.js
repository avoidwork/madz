import { describe, it } from "node:test";
import assert from "node:assert";
import { PoppyConfigSchema } from "../../../src/config/schemas/poppy.js";
import { ConfigSchema } from "../../../src/config/config.js";
import {
	KNOWN_SECTIONS,
	buildReverseMap,
	_resolveEnvRecursively,
} from "../../../src/config/loader.js";

const VALID_POPPY = {
	clientId: "https://agent.example.com",
	clientName: "Madz",
	jwksUri: "https://agent.example.com/.well-known/jwks.json",
	redirectUris: ["https://agent.example.com/callback"],
};

describe("poppy config schema", () => {
	it("accepts a valid poppy config", () => {
		const result = PoppyConfigSchema.safeParse(VALID_POPPY);
		assert.strictEqual(result.success, true);
	});

	it("accepts an empty poppy config (all fields optional)", () => {
		const result = PoppyConfigSchema.safeParse({});
		assert.strictEqual(result.success, true);
	});

	it("rejects an invalid clientId URL", () => {
		const result = PoppyConfigSchema.safeParse({ ...VALID_POPPY, clientId: "not-a-url" });
		assert.strictEqual(result.success, false);
	});

	it("rejects an invalid jwksUri URL", () => {
		const result = PoppyConfigSchema.safeParse({ ...VALID_POPPY, jwksUri: "not-a-url" });
		assert.strictEqual(result.success, false);
	});

	it("rejects an empty redirectUris array", () => {
		const result = PoppyConfigSchema.safeParse({ ...VALID_POPPY, redirectUris: [] });
		assert.strictEqual(result.success, false);
	});

	it("rejects an invalid logoUri URL", () => {
		const result = PoppyConfigSchema.safeParse({ ...VALID_POPPY, logoUri: "not-a-url" });
		assert.strictEqual(result.success, false);
	});
});

describe("poppy config in ConfigSchema", () => {
	it("includes the poppy section", () => {
		const shape = ConfigSchema._def.shape;
		assert.ok(shape.poppy, "ConfigSchema should include a poppy section");
	});

	it("parses an empty config with poppy defaulting to {}", () => {
		const config = ConfigSchema.parse({});
		assert.deepStrictEqual(config.poppy, {});
	});

	it("parses a valid poppy section", () => {
		const config = ConfigSchema.parse({ poppy: VALID_POPPY });
		assert.strictEqual(config.poppy.clientId, VALID_POPPY.clientId);
	});
});

describe("poppy loader env mapping", () => {
	it("includes poppy in KNOWN_SECTIONS", () => {
		assert.ok(KNOWN_SECTIONS.includes("poppy"), "KNOWN_SECTIONS should include poppy");
	});

	it("maps poppy.* paths to POPPY_* env names", () => {
		const map = buildReverseMap(ConfigSchema);
		assert.strictEqual(map.get("POPPY_CLIENT_ID"), "poppy.clientId");
		assert.strictEqual(map.get("POPPY_CLIENT_NAME"), "poppy.clientName");
		assert.strictEqual(map.get("POPPY_JWKS_URI"), "poppy.jwksUri");
		assert.strictEqual(map.get("POPPY_REDIRECT_URIS"), "poppy.redirectUris");
		assert.strictEqual(map.get("POPPY_LOGO_URI"), "poppy.logoUri");
	});

	it("resolves POPPY_* env vars to config values", () => {
		const original = process.env.POPPY_CLIENT_ID;
		process.env.POPPY_CLIENT_ID = "https://agent.example.com";
		try {
			const node = { poppy: { clientId: "" } };
			const resolved = _resolveEnvRecursively(node, []);
			assert.strictEqual(resolved.poppy.clientId, "https://agent.example.com");
		} finally {
			if (original === undefined) {
				delete process.env.POPPY_CLIENT_ID;
			} else {
				process.env.POPPY_CLIENT_ID = original;
			}
		}
	});
});
