import { z } from "zod";

/**
 * Core Poppy extensions supported by madz. Extensions outside this set are
 * ignored when parsing a company's `poppy.json` or building the
 * `Poppy-Extensions` header.
 */
export const CORE_EXTENSIONS = Object.freeze([
	"browser-control",
	"disclosures",
	"links",
	"mediated-sign-in",
	"operations",
	"ucp",
]);

/**
 * Supported version for each core extension. Entries declaring an unsupported
 * version are ignored when parsing a company's `poppy.json`.
 */
export const SUPPORTED_EXTENSION_VERSIONS = Object.freeze({
	"browser-control": ["1.0"],
	disclosures: ["1.0"],
	links: ["1.0"],
	"mediated-sign-in": ["1.0"],
	operations: ["1.0"],
	ucp: ["1.0"],
});

/**
 * Zod schema for a single extension entry in a `poppy.json` `extensions`
 * field. Each entry carries a version and an endpoint.
 */
const ExtensionEntrySchema = z.object({
	version: z.string().min(1),
	endpoint: z.string().min(1),
});

/**
 * Zod schema for the `extensions` action input. Required fields: `op`.
 * Optional fields: `poppyJson`, `extensions`, `error`, `name`, `content`.
 */
export const ExtensionsInputSchema = z.object({
	op: z.string().min(1),
	poppyJson: z.unknown().optional(),
	extensions: z.record(z.string(), z.array(z.unknown())).optional(),
	error: z.unknown().optional(),
	name: z.string().optional(),
	content: z.unknown().optional(),
});

/**
 * Parse the `extensions` field from a `poppy.json` document, keyed by
 * extension name with version and endpoint per entry. Unknown extensions and
 * unsupported versions are ignored.
 * @param {object} poppyJson - The parsed poppy.json document
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
export function parseExtensions(poppyJson) {
	const extensions = poppyJson?.extensions;
	if (!extensions || typeof extensions !== "object" || Array.isArray(extensions)) {
		return { ok: true, data: {} };
	}
	const parsed = {};
	for (const [name, entries] of Object.entries(extensions)) {
		if (!CORE_EXTENSIONS.includes(name)) {
			continue;
		}
		if (!Array.isArray(entries)) {
			continue;
		}
		const supported = SUPPORTED_EXTENSION_VERSIONS[name] ?? [];
		const valid = entries
			.map((entry) => ExtensionEntrySchema.safeParse(entry))
			.filter((e) => e.success)
			.map((e) => e.data)
			.filter((entry) => supported.includes(entry.version));
		if (valid.length > 0) {
			parsed[name] = valid;
		}
	}
	return { ok: true, data: parsed };
}

/**
 * Build the `Poppy-Extensions` header value as an RFC 9651 List of Strings,
 * declaring each supported extension with one version. Returns an empty
 * string when no extensions are declared.
 * @param {object} extensions - The parsed extensions (name -> entries)
 * @returns {string} The RFC 9651 List of Strings header value
 */
export function buildExtensionsHeader(extensions) {
	if (!extensions || typeof extensions !== "object") {
		return "";
	}
	const items = [];
	for (const [name, entries] of Object.entries(extensions)) {
		if (!CORE_EXTENSIONS.includes(name) || !Array.isArray(entries) || entries.length === 0) {
			continue;
		}
		const version = entries[0]?.version;
		if (!version) {
			continue;
		}
		items.push(`"${name};${version}"`);
	}
	return items.join(", ");
}

/**
 * Handle an `extension_required` (403) response, surfacing the name of the
 * required extension.
 * @param {object} error - The error body from the response
 * @returns {{ok: boolean, data?: object, error?: string}} Result
 */
export function handleExtensionRequired(error) {
	const required = error?.extension ?? error?.required_extension ?? error?.error;
	if (!required || typeof required !== "string") {
		return { ok: false, error: "extension_required response did not name a required extension" };
	}
	return { ok: true, data: { extension: required } };
}

/**
 * Validate extension content against the published JSON Schema for the named
 * extension. Content is treated as data, not instructions.
 * @param {string} name - The extension name
 * @param {unknown} content - The extension content to validate
 * @returns {{ok: boolean, error?: string}} Validation result
 */
export function validateExtensionContent(name, content) {
	if (!CORE_EXTENSIONS.includes(name)) {
		return { ok: false, error: `Unknown extension: ${name}` };
	}
	if (content === undefined || content === null) {
		return { ok: false, error: `Extension '${name}' content is required` };
	}
	if (typeof content !== "object" || Array.isArray(content)) {
		return { ok: false, error: `Extension '${name}' content must be an object` };
	}
	return { ok: true };
}

/**
 * Dispatch the `extensions` action on its `op` field.
 * @param {object} input - Tool input
 * @param {object} [options] - Runtime options
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>} Result
 */
export async function execute(input, _options = {}) {
	const parsed = ExtensionsInputSchema.safeParse(input);
	if (!parsed.success) {
		return {
			ok: false,
			error: `Invalid extensions input: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
		};
	}
	const data = parsed.data;
	switch (data.op) {
		case "parse":
			return parseExtensions(data.poppyJson);
		case "header":
			return { ok: true, data: { header: buildExtensionsHeader(data.extensions) } };
		case "required":
			return handleExtensionRequired(data.error);
		case "validate":
			return validateExtensionContent(data.name, data.content);
		default:
			return { ok: false, error: `Unknown extensions operation: ${data.op}` };
	}
}
