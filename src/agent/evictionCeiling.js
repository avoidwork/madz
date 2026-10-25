import { createFilesystemMiddleware } from "deepagents";

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
 * The middleware no longer *supplies* the eight filesystem tools — madz owns
 * file I/O via its own `file` tool (src/tools/file/index.js). It only provides
 * the eviction ceiling and state handling. The `model` parameter is retained
 * for API compatibility with callers (subagents pass their model) but is no
 * longer used to derive a tool set.
 *
 * @param {Object} options - Middleware options
 * @param {Object} options.backend - Backend shared with the agent (state-backed)
 * @param {Object[]} [options.permissions=[]] - Filesystem permission rules
 * @param {Object|string} [options.model] - Chat model instance or "provider:model" spec (retained for API compatibility)
 * @returns {Object} The middleware, named `"FilesystemMiddleware"`
 */
export function createEvictionAwareFilesystemMiddleware({
	backend,
	permissions = [],
	model: _model,
}) {
	const toolTokenLimitBeforeEvict = deriveToolTokenLimitBeforeEvict();

	// madz owns its file I/O via the `file` tool registered as a first-class
	// tool (src/tools/file/index.js). The middleware supplies NO filesystem
	// tools — it only provides the eviction ceiling and state handling. The
	// library requires `read_file` in its `tools` option, so we pass the
	// minimum to satisfy validation, then clear the contributed tool set so
	// the library's eight tools are not exposed to the agent.
	const middleware = createFilesystemMiddleware({
		backend,
		permissions,
		tools: ["read_file"],
		toolTokenLimitBeforeEvict,
	});

	// The middleware MUST keep the name "FilesystemMiddleware" so deepagents'
	// same-name Map merge displaces the library default. The name is asserted
	// in tests rather than trusted.
	middleware.tools = [];

	return middleware;
}
