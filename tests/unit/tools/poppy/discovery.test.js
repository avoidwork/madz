import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
	PoppyDocumentSchema,
	isPrivateAddress,
	validateUrl,
	validateDocument,
	selectVersion,
	normalizeDocument,
	fetchPoppy,
	discoverPoppy,
	discoverAction,
} from "../../../../src/tools/poppy/discovery.js";
import { poppy } from "../../../../src/tools/poppy/index.js";

const VALID_DOC = {
	protocol_version: "1.0",
	organization: { name: "Example", domain: "example.com" },
	apis: [{ type: "openapi", url: "https://api.example.com/openapi.json", description: "Orders" }],
};

/** Build a valid document whose organization.domain matches the given domain. */
function makeDoc(domain) {
	return {
		protocol_version: "1.0",
		organization: { name: "Example", domain },
		apis: [{ type: "openapi", url: `https://api.${domain}/openapi.json`, description: "Orders" }],
	};
}

describe("poppy - schema validation", () => {
	it("accepts a valid document", () => {
		const result = PoppyDocumentSchema.safeParse(VALID_DOC);
		assert.strictEqual(result.success, true);
	});

	it("rejects a missing protocol_version", () => {
		const result = PoppyDocumentSchema.safeParse({
			organization: { name: "x", domain: "x.com" },
			apis: [],
		});
		assert.strictEqual(result.success, false);
	});

	it("rejects a malformed protocol_version", () => {
		const result = PoppyDocumentSchema.safeParse({ ...VALID_DOC, protocol_version: "1" });
		assert.strictEqual(result.success, false);
	});

	it("rejects a missing organization", () => {
		const result = PoppyDocumentSchema.safeParse({ protocol_version: "1.0", apis: [] });
		assert.strictEqual(result.success, false);
	});

	it("accepts a document with only web channel", () => {
		const result = PoppyDocumentSchema.safeParse({
			protocol_version: "1.0",
			organization: { name: "x", domain: "x.com" },
			web: {},
		});
		assert.strictEqual(result.success, true);
	});
});

describe("poppy - isPrivateAddress", () => {
	it("detects loopback IPv4", () => {
		assert.strictEqual(isPrivateAddress("127.0.0.1"), true);
	});
	it("detects private IPv4", () => {
		assert.strictEqual(isPrivateAddress("10.0.0.1"), true);
		assert.strictEqual(isPrivateAddress("192.168.1.1"), true);
		assert.strictEqual(isPrivateAddress("172.16.0.1"), true);
	});
	it("detects link-local IPv4", () => {
		assert.strictEqual(isPrivateAddress("169.254.1.1"), true);
	});
	it("detects localhost", () => {
		assert.strictEqual(isPrivateAddress("localhost"), true);
	});
	it("detects loopback IPv6", () => {
		assert.strictEqual(isPrivateAddress("::1"), true);
	});
	it("allows public addresses", () => {
		assert.strictEqual(isPrivateAddress("example.com"), false);
		assert.strictEqual(isPrivateAddress("8.8.8.8"), false);
	});
});

describe("poppy - validateUrl", () => {
	it("accepts an HTTPS public URL", () => {
		assert.strictEqual(validateUrl("https://api.example.com/x").ok, true);
	});
	it("rejects a non-HTTPS URL", () => {
		assert.strictEqual(validateUrl("http://example.com/x").ok, false);
	});
	it("rejects a private address", () => {
		assert.strictEqual(validateUrl("https://127.0.0.1/x").ok, false);
	});
	it("allows a private address when configured", () => {
		assert.strictEqual(validateUrl("https://127.0.0.1/x", true).ok, true);
	});
	it("rejects an invalid URL", () => {
		assert.strictEqual(validateUrl("not a url").ok, false);
	});
});

describe("poppy - validateDocument", () => {
	it("accepts a valid document with matching domain", () => {
		const result = validateDocument(VALID_DOC, "example.com");
		assert.strictEqual(result.ok, true);
	});
	it("rejects a domain mismatch", () => {
		const result = validateDocument(VALID_DOC, "other.com");
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /does not match/);
	});
	it("matches domain case-insensitively", () => {
		const result = validateDocument(VALID_DOC, "EXAMPLE.COM");
		assert.strictEqual(result.ok, true);
	});
	it("rejects a document with no channel", () => {
		const result = validateDocument(
			{ protocol_version: "1.0", organization: { name: "x", domain: "example.com" } },
			"example.com",
		);
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /at least one of/);
	});
	it("rejects a document with a non-HTTPS URL", () => {
		const doc = {
			...VALID_DOC,
			apis: [{ type: "openapi", url: "http://api.example.com/x", description: "x" }],
		};
		const result = validateDocument(doc, "example.com");
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /HTTPS/);
	});
});

describe("poppy - selectVersion", () => {
	it("selects the newest compatible version", () => {
		assert.strictEqual(selectVersion("1.0", { 0.4: "u", 0.3: "u" }, "1.0"), "1.0");
	});
	it("selects a supported version when protocol is incompatible", () => {
		assert.strictEqual(selectVersion("2.0", { "1.0": "u" }, "1.0"), "1.0");
	});
	it("returns null when no version is compatible", () => {
		assert.strictEqual(selectVersion("2.0", {}, "1.0"), null);
	});
	it("selects newest among multiple supported versions", () => {
		assert.strictEqual(selectVersion("2.0", { "1.0": "u", 0.9: "u" }, "1.0"), "1.0");
	});
});

describe("poppy - normalizeDocument", () => {
	it("returns a normalized representation", () => {
		const normalized = normalizeDocument(VALID_DOC, "example.com");
		assert.strictEqual(normalized.protocolVersion, "1.0");
		assert.strictEqual(normalized.organization.name, "Example");
		assert.strictEqual(normalized.channels.apis.length, 1);
		assert.strictEqual(normalized.servingHost, "example.com");
	});
});

describe("poppy - fetchPoppy", () => {
	it("fetches and parses a valid document", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			status: 200,
			ok: true,
			headers: new Map(),
			text: async () => JSON.stringify(VALID_DOC),
		}));
		const result = await fetchPoppy("example.com");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.servingHost, "example.com");
		fetchMock.mock.restore();
	});

	it("rejects a non-HTTPS redirect", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			status: 302,
			ok: false,
			headers: new Map([["location", "http://example.com/.well-known/poppy.json"]]),
			text: async () => "",
		}));
		const result = await fetchPoppy("example.com");
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /non-HTTPS/);
		fetchMock.mock.restore();
	});

	it("rejects a redirect to a non-well-known path", async () => {
		let calls = 0;
		const fetchMock = mock.method(globalThis, "fetch", async () => {
			calls++;
			if (calls === 1) {
				return {
					status: 302,
					ok: false,
					headers: new Map([["location", "https://redirect.example.com/other.json"]]),
					text: async () => "",
				};
			}
			return {
				status: 200,
				ok: true,
				headers: new Map(),
				text: async () => JSON.stringify(VALID_DOC),
			};
		});
		const result = await fetchPoppy("redirect.example.com");
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /path/);
		fetchMock.mock.restore();
	});

	it("rejects a final URL with a query string", async () => {
		let calls = 0;
		const fetchMock = mock.method(globalThis, "fetch", async () => {
			calls++;
			if (calls === 1) {
				return {
					status: 302,
					ok: false,
					headers: new Map([["location", "https://example.com/.well-known/poppy.json?token=abc"]]),
					text: async () => "",
				};
			}
			return {
				status: 200,
				ok: true,
				headers: new Map(),
				text: async () => JSON.stringify(VALID_DOC),
			};
		});
		const result = await fetchPoppy("example.com");
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /query/);
		fetchMock.mock.restore();
	});

	it("rejects malformed JSON", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			status: 200,
			ok: true,
			headers: new Map(),
			text: async () => "not json",
		}));
		const result = await fetchPoppy("example.com");
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /not valid JSON/);
		fetchMock.mock.restore();
	});

	it("rejects a private domain", async () => {
		const result = await fetchPoppy("127.0.0.1");
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /loopback/);
	});
});

describe("poppy - discoverPoppy", () => {
	it("returns a normalized document from the network", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			status: 200,
			ok: true,
			headers: new Map(),
			text: async () => JSON.stringify(makeDoc("network.example.com")),
		}));
		const result = await discoverPoppy("network.example.com");
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.source, "network");
		assert.strictEqual(result.data.protocolVersion, "1.0");
		fetchMock.mock.restore();
	});

	it("returns a cached document on subsequent calls", async () => {
		let calls = 0;
		const fetchMock = mock.method(globalThis, "fetch", async () => {
			calls++;
			return {
				status: 200,
				ok: true,
				headers: new Map(),
				text: async () => JSON.stringify(makeDoc("cache.example.com")),
			};
		});
		await discoverPoppy("cache.example.com");
		const second = await discoverPoppy("cache.example.com");
		assert.strictEqual(second.source, "cache");
		assert.strictEqual(calls, 1);
		fetchMock.mock.restore();
	});

	it("returns an error when no compatible version exists", async () => {
		const fetchMock = mock.method(globalThis, "fetch", async () => ({
			status: 200,
			ok: true,
			headers: new Map(),
			text: async () =>
				JSON.stringify({ ...makeDoc("incompat.example.com"), protocol_version: "2.0" }),
		}));
		const result = await discoverPoppy("incompat.example.com");
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /No compatible/);
		fetchMock.mock.restore();
	});
});

describe("poppy - discoverAction", () => {
	it("requires a domain", async () => {
		const result = await discoverAction({});
		assert.strictEqual(result.ok, false);
		assert.match(result.error, /Domain is required/);
	});

	it("rejects an empty domain", async () => {
		const result = await discoverAction({ domain: "  " });
		assert.strictEqual(result.ok, false);
	});
});

describe("poppy - tool schema", () => {
	it("accepts a valid discover action", () => {
		const result = poppy.schema.safeParse({ action: "discover", domain: "example.com" });
		assert.strictEqual(result.success, true);
	});
	it("rejects a missing action", () => {
		const result = poppy.schema.safeParse({ domain: "example.com" });
		assert.strictEqual(result.success, false);
	});
	it("rejects a discover action without a domain", () => {
		const result = poppy.schema.safeParse({ action: "discover" });
		assert.strictEqual(result.success, false);
	});
	it("accepts a valid identity action", () => {
		const result = poppy.schema.safeParse({ action: "identity", op: "build_metadata" });
		assert.strictEqual(result.success, true);
	});
	it("rejects an identity action without an op", () => {
		const result = poppy.schema.safeParse({ action: "identity" });
		assert.strictEqual(result.success, false);
	});
	it("rejects a domain on the identity action", () => {
		const result = poppy.schema.safeParse({
			action: "identity",
			op: "build_metadata",
			domain: "example.com",
		});
		assert.strictEqual(result.success, false);
	});
});
