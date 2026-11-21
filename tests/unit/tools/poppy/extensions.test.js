import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	CORE_EXTENSIONS,
	ExtensionsInputSchema,
	parseExtensions,
	buildExtensionsHeader,
	handleExtensionRequired,
	validateExtensionContent,
	execute,
} from "../../../../src/tools/poppy/extensions.js";

const POPPY_JSON = {
	protocol_version: "1.0",
	organization: { name: "Example", domain: "example.com" },
	extensions: {
		"browser-control": [{ version: "1.0", endpoint: "https://example.com/browser" }],
		disclosures: [{ version: "1.0", endpoint: "https://example.com/disclosures" }],
		links: [{ version: "1.0", endpoint: "https://example.com/links" }],
		"mediated-sign-in": [{ version: "1.0", endpoint: "https://example.com/msi" }],
		operations: [{ version: "1.0", endpoint: "https://example.com/ops" }],
		ucp: [{ version: "1.0", endpoint: "https://example.com/ucp" }],
	},
};

describe("poppy extensions - schema validation", () => {
	it("accepts valid extensions input", () => {
		const result = ExtensionsInputSchema.safeParse({ op: "parse", poppyJson: POPPY_JSON });
		assert.strictEqual(result.success, true);
	});

	it("rejects extensions input missing op", () => {
		const result = ExtensionsInputSchema.safeParse({ poppyJson: POPPY_JSON });
		assert.strictEqual(result.success, false);
	});
});

describe("poppy extensions - parseExtensions", () => {
	it("parses valid extensions keyed by name", () => {
		const result = parseExtensions(POPPY_JSON);
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data["browser-control"][0].version, "1.0");
		assert.strictEqual(result.data["browser-control"][0].endpoint, "https://example.com/browser");
		assert.strictEqual(Object.keys(result.data).length, 6);
	});

	it("ignores unknown extensions", () => {
		const result = parseExtensions({
			extensions: { "unknown-ext": [{ version: "1.0", endpoint: "https://example.com/x" }] },
		});
		assert.strictEqual(result.ok, true);
		assert.deepEqual(result.data, {});
	});

	it("ignores unsupported versions", () => {
		const result = parseExtensions({
			extensions: { links: [{ version: "9.9", endpoint: "https://example.com/links" }] },
		});
		assert.strictEqual(result.ok, true);
		assert.deepEqual(result.data, {});
	});

	it("returns empty object when no extensions field", () => {
		const result = parseExtensions({ protocol_version: "1.0" });
		assert.strictEqual(result.ok, true);
		assert.deepEqual(result.data, {});
	});
});

describe("poppy extensions - buildExtensionsHeader", () => {
	it("builds an RFC 9651 List of Strings with one version per extension", () => {
		const header = buildExtensionsHeader({
			links: [{ version: "1.0", endpoint: "https://example.com/links" }],
			ucp: [{ version: "1.0", endpoint: "https://example.com/ucp" }],
		});
		assert.strictEqual(header, '"links;1.0", "ucp;1.0"');
	});

	it("returns empty string when no extensions declared", () => {
		const header = buildExtensionsHeader({});
		assert.strictEqual(header, "");
	});

	it("ignores unknown extensions in the header", () => {
		const header = buildExtensionsHeader({
			"unknown-ext": [{ version: "1.0", endpoint: "https://example.com/x" }],
		});
		assert.strictEqual(header, "");
	});

	it("ignores entries without a version", () => {
		const header = buildExtensionsHeader({ links: [{ endpoint: "https://example.com/links" }] });
		assert.strictEqual(header, "");
	});
});

describe("poppy extensions - handleExtensionRequired", () => {
	it("surfaces the required extension name", () => {
		const result = handleExtensionRequired({ extension: "links" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.extension, "links");
	});

	it("surfaces the required extension from required_extension field", () => {
		const result = handleExtensionRequired({ required_extension: "ucp" });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.extension, "ucp");
	});

	it("reports an error when no extension is named", () => {
		const result = handleExtensionRequired({});
		assert.strictEqual(result.ok, false);
	});
});

describe("poppy extensions - validateExtensionContent", () => {
	it("accepts valid content for a core extension", () => {
		const result = validateExtensionContent("links", { url: "https://example.com" });
		assert.strictEqual(result.ok, true);
	});

	it("rejects unknown extensions", () => {
		const result = validateExtensionContent("unknown-ext", { url: "https://example.com" });
		assert.strictEqual(result.ok, false);
	});

	it("rejects missing content", () => {
		const result = validateExtensionContent("links", undefined);
		assert.strictEqual(result.ok, false);
	});

	it("rejects non-object content", () => {
		const result = validateExtensionContent("links", "not-an-object");
		assert.strictEqual(result.ok, false);
	});
});

describe("poppy extensions - execute", () => {
	it("dispatches parse op", async () => {
		const result = await execute({ op: "parse", poppyJson: POPPY_JSON });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data["browser-control"][0].version, "1.0");
	});

	it("dispatches header op", async () => {
		const result = await execute({
			op: "header",
			extensions: { links: [{ version: "1.0", endpoint: "https://example.com/links" }] },
		});
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.header, '"links;1.0"');
	});

	it("dispatches required op", async () => {
		const result = await execute({ op: "required", error: { extension: "ucp" } });
		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.data.extension, "ucp");
	});

	it("dispatches validate op", async () => {
		const result = await execute({
			op: "validate",
			name: "links",
			content: { url: "https://example.com" },
		});
		assert.strictEqual(result.ok, true);
	});

	it("returns an error for an unknown op", async () => {
		const result = await execute({ op: "unknown" });
		assert.strictEqual(result.ok, false);
	});
});

describe("poppy extensions - core extension set", () => {
	it("defines the six core extensions", () => {
		assert.deepEqual(CORE_EXTENSIONS, [
			"browser-control",
			"disclosures",
			"links",
			"mediated-sign-in",
			"operations",
			"ucp",
		]);
	});
});
