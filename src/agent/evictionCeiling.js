import { createFilesystemMiddleware, getHarnessProfile, EMPTY_HARNESS_PROFILE } from "deepagents";

/**
 * Character allowance for the JSON envelope that wraps the base64 payload in a
 * `readImage` ToolMessage: `{"ok":true,"mimeType":"image/png","data":"…"}`.
 * The fixed keys are ~40 characters; 128 leaves generous headroom for a long
 * MIME type without letting the envelope itself push the message over the
 * ceiling.
 */
export const ENVELOPE_HEADROOM = 128;

/**
 * Chars per "token" used by deepagents' eviction comparison. The library
 * evicts when `textContent.length > toolTokenLimitBeforeEvict * 4`, so the
 * option is a token count and the ceiling in characters is `4x` that.
 */
export const CHARS_PER_TOKEN = 4;

/**
 * Fixed base64 character budget for the eviction ceiling. `readImage` no
 * longer enforces a size limit (the model handles whatever it is sent), so the
 * ceiling must sit above any realistic image or deepagents' 20,000-token
 * default (80,000 chars) would evict it and replace it with prose.
 */
export const IMAGE_EVICTION_BUDGET_CHARS = 2000000;

/**
 * Map a model instance's class name to the provider prefix used to build a
 * harness-profile lookup key. Mirrors deepagents' internal `getModelProvider`,
 * which is not exported.
 */
const MODEL_PROVIDER_BY_NAME = Object.freeze({
	ChatAnthropic: "anthropic",
	ChatOpenAI: "openai",
	ChatGoogleGenerativeAI: "google",
});

/**
 * Resolve the harness profile for a model, mirroring deepagents' internal
 * `resolveHarnessProfile` (not exported) so our filesystem middleware derives
 * its tool set exactly as the library's would.
 *
 * A string spec drives the lookup directly; a model instance is resolved from
 * provider/identifier hints. Note that `@langchain/openai` exposes the model
 * name as `.model`, which the library does not read, so a `ChatOpenAI`
 * instance resolves to `EMPTY_HARNESS_PROFILE` today — the same profile the
 * library itself sees at its own `createFilesystemMiddleware` call site.
 *
 * @param {Object|string} model - Chat model instance or "provider:model" spec
 * @returns {Object} The resolved harness profile (never undefined)
 */
function resolveHarnessProfileForModel(model) {
	if (typeof model === "string") return getHarnessProfile(model) ?? EMPTY_HARNESS_PROFILE;

	const name = typeof model?.getName === "function" ? model.getName() : undefined;
	const providerHint = name ? MODEL_PROVIDER_BY_NAME[name] : undefined;
	const identifierHint =
		(name === "ConfigurableModel" ? model?._defaultConfig?.model : undefined) ??
		model?.model_name ??
		model?.modelName;

	if (providerHint && identifierHint && !identifierHint.includes(":")) {
		const profile = getHarnessProfile(`${providerHint}:${identifierHint}`);
		if (profile) return profile;
	}
	if (identifierHint && identifierHint.includes(":")) {
		const profile = getHarnessProfile(identifierHint);
		if (profile) return profile;
	}
	if (providerHint) {
		const profile = getHarnessProfile(providerHint);
		if (profile) return profile;
	}

	return EMPTY_HARNESS_PROFILE;
}

/**
 * The eight tool names `FilesystemMiddleware` contributes, read from a
 * library-built instance rather than hardcoded so an upstream rename or
 * addition cannot silently desynchronise our replacement.
 */
let filesystemToolNames = null;

/**
 * Get the canonical filesystem tool names from the library.
 * @returns {string[]} Tool names in the library's declared order
 */
function getFileSystemToolNames() {
	if (filesystemToolNames) return filesystemToolNames;
	filesystemToolNames = createFilesystemMiddleware({}).tools.map((tool) => tool.name);
	return filesystemToolNames;
}

/**
 * Derive the `tools` option for the filesystem middleware from the model's
 * harness profile, mirroring deepagents' internal
 * `computeProfileFilesystemTools`: `undefined` when the profile excludes
 * nothing (the library's "all tools" signal), otherwise the enabled names with
 * `read_file` forced in, because the middleware requires it.
 *
 * @param {Object|string} model - Chat model instance or "provider:model" spec
 * @returns {string[]|undefined} Enabled tool names, or undefined for all tools
 */
export function resolveProfileFilesystemTools(model) {
	const profile = resolveHarnessProfileForModel(model);
	const allNames = getFileSystemToolNames();
	const enabled = allNames.filter((name) => !profile.excludedTools?.has(name));
	if (enabled.length === allNames.length) return undefined;
	return enabled.includes("read_file") ? enabled : ["read_file", ...enabled];
}

/**
 * Derive deepagents' `toolTokenLimitBeforeEvict`: the fixed image budget plus
 * envelope headroom, divided by `CHARS_PER_TOKEN` (deepagents evicts when the
 * stringified content exceeds `limit * 4` characters).
 *
 * @returns {number} The token limit to pass as `toolTokenLimitBeforeEvict`
 */
export function deriveToolTokenLimitBeforeEvict() {
	return Math.ceil((IMAGE_EVICTION_BUDGET_CHARS + ENVELOPE_HEADROOM) / CHARS_PER_TOKEN);
}

/**
 * Build madz's replacement for deepagents' `FilesystemMiddleware`, configured
 * with a fixed eviction ceiling large enough for image payloads.
 *
 * The returned middleware MUST keep the name `"FilesystemMiddleware"`:
 * deepagents merges custom middleware over its defaults with a Map keyed by
 * `name`, so a same-name entry displaces the library instance. A drifted name
 * would stack a second copy — the bug would survive while looking fixed. The
 * name is asserted in tests rather than trusted.
 *
 * The full library option set is reproduced (`backend`, `permissions`, `tools`)
 * because this middleware also *supplies* the eight filesystem tools; an
 * incomplete option set silently regresses tool availability.
 *
 * @param {Object} options - Middleware options
 * @param {Object} options.backend - Backend shared with the agent (state-backed)
 * @param {Object[]} [options.permissions=[]] - Filesystem permission rules
 * @param {Object|string} options.model - Chat model instance or "provider:model" spec
 * @returns {Object} The middleware, named `"FilesystemMiddleware"`
 */
export function createEvictionAwareFilesystemMiddleware({ backend, permissions = [], model }) {
	const toolTokenLimitBeforeEvict = deriveToolTokenLimitBeforeEvict();

	return createFilesystemMiddleware({
		backend,
		permissions,
		tools: resolveProfileFilesystemTools(model),
		toolTokenLimitBeforeEvict,
	});
}
