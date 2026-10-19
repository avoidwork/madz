import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { ToolMessage } from "@langchain/core/messages";
import sharp from "sharp";
import { readImage } from "../../src/tools/image/readImage.js";
import { createImageDispatchMiddleware } from "../../src/provider/imageDispatchMiddleware.js";
import {
	createEvictionAwareFilesystemMiddleware,
	deriveToolTokenLimitBeforeEvict,
} from "../../src/agent/evictionCeiling.js";
import { logger } from "../../src/shared/logger.js";

const MAX_SIZE = 100000;
const CEILING_CHARS = deriveToolTokenLimitBeforeEvict() * 4;

/**
 * Deterministic pseudo-random bytes: incompressible, so PNG output scales
 * predictably with pixel count and the base64 length can be targeted.
 * @param {number} length - Byte count
 * @returns {Buffer} The bytes
 */
function noise(length) {
	const buffer = Buffer.alloc(length);
	for (let i = 0; i < length; i += 1) {
		// Mix the index through 32-bit multiplications: an LCG masked to 8 bits has
		// period 256, which PNG deflate would compress away.
		let x = Math.imul(i + 1, 0x9e3779b9);
		x ^= x >>> 15;
		x = Math.imul(x, 0x85ebca6b);
		x ^= x >>> 13;
		x = Math.imul(x, 0xc2b2ae35);
		x ^= x >>> 16;
		buffer[i] = x & 0xff;
	}
	return buffer;
}

/**
 * Encode an incompressible PNG whose base64 length is at or just under
 * `target`. Shrinks until it fits, so the result can never overshoot the
 * ceiling the caller is testing against.
 * @param {string} dir - Directory to write the PNG into
 * @param {number} target - Target base64 character count
 * @returns {Promise<{ path: string, base64Length: number }>} File path and length
 */
async function writePngNear(dir, target) {
	// Uncompressed RGB PNG: `side * (side * 3 + 1)` raw bytes plus a small
	// header/footer, expanded ~4/3 by base64. Solve for `side`.
	let side = Math.max(8, Math.floor(Math.sqrt(target * 0.75)));
	let buffer = null;
	let base64Length = 0;

	for (let attempt = 0; attempt < 24; attempt += 1) {
		const raw = noise(side * side * 3);
		buffer = await sharp(raw, { raw: { width: side, height: side, channels: 3 } })
			.png({ compressionLevel: 0 })
			.toBuffer();
		base64Length = buffer.toString("base64").length;

		if (base64Length > target) {
			side = Math.max(8, side - Math.max(1, Math.ceil((base64Length - target) / (side * 6))));
			continue;
		}
		// Within 1% of the target is close enough to pin the coupling.
		if (base64Length >= target * 0.99) break;
		side += Math.max(1, Math.ceil((target - base64Length) / (side * 6)));
	}

	assert.ok(buffer, "could not synthesise a PNG");
	assert.ok(
		base64Length <= target,
		`sized PNG overshot: ${base64Length} > ${target} (side ${side})`,
	);
	const path = join(dir, `shot-${side}-${Math.round(base64Length)}.png`);
	writeFileSync(path, buffer);
	return { path, base64Length };
}

/**
 * Build a `readImage`-shaped ToolMessage of an exact stringified length.
 * @param {number} totalLength - Desired stringified content length
 * @param {string} toolCallId - Tool call id
 * @returns {ToolMessage} The tool message
 */
function makeReadImageMessage(totalLength, toolCallId = "call_1") {
	const envelope = JSON.stringify({ ok: true, mimeType: "image/png", data: "" });
	const content = JSON.stringify({
		ok: true,
		mimeType: "image/png",
		data: "A".repeat(Math.max(0, totalLength - envelope.length)),
	});
	return new ToolMessage({
		content,
		name: "readImage",
		tool_call_id: toolCallId,
		id: `${toolCallId}-msg`,
	});
}

/**
 * Drive a middleware's `wrapToolCall` around one tool result.
 * @param {Object} middleware - The filesystem middleware
 * @param {ToolMessage} message - The tool result
 * @returns {Promise<{ evicted: boolean, content: string }>} Eviction outcome
 */
async function runWrapToolCall(middleware, message) {
	const state = { files: {} };
	const request = {
		toolCall: { name: message.name, id: message.tool_call_id },
		runtime: { state },
		state,
	};
	const result = await middleware.wrapToolCall(request, async () => message);
	const out = result?.update?.messages?.[0] ?? result;
	return { evicted: Boolean(result?.update?.files), content: String(out.content) };
}

const chatCompletion = (content) =>
	new Response(
		JSON.stringify({
			id: "x",
			object: "chat.completion",
			created: 0,
			model: "gpt-4o",
			choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
			usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
		}),
		{ status: 200, headers: { "content-type": "application/json" } },
	);

const toolCallCompletion = (path) =>
	new Response(
		JSON.stringify({
			id: "x",
			object: "chat.completion",
			created: 0,
			model: "gpt-4o",
			choices: [
				{
					index: 0,
					message: {
						role: "assistant",
						content: null,
						tool_calls: [
							{
								id: "call_big",
								type: "function",
								function: { name: "readImage", arguments: JSON.stringify({ path }) },
							},
						],
					},
					finish_reason: "tool_calls",
				},
			],
			usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
		}),
		{ status: 200, headers: { "content-type": "application/json" } },
	);

const makeModel = () =>
	new ChatOpenAI({
		model: "gpt-4o",
		apiKey: "sk-test",
		configuration: { baseURL: "http://127.0.0.1:9/v1" },
		maxRetries: 0,
	});

/**
 * End-to-end acceptance criterion for issue #1429: a real `readImage` whose
 * base64 payload sits just under `image.maxSize` must survive the filesystem
 * middleware's eviction check and still reach the model as a vision block.
 *
 * Before the fix, deepagents' 20,000-token default evicted the ToolMessage at
 * 80,000 chars; `buildImageBlock` then JSON.parsed the eviction prose, threw,
 * logged "[imageDispatch] failed to parse readImage tool result; skipping", and
 * returned null — so the model saw text only. This drives a REAL createAgent
 * with the REAL readImage tool, the REAL replacement middleware, and the REAL
 * ImageDispatch middleware against a mocked fetch.
 */
describe("integration - readImage survives eviction and reaches the model as vision", () => {
	let testDir;
	let originalFetch;
	let fetchCalls;
	let lastRequestBody;
	let warnLines;

	before(() => {
		testDir = join(tmpdir(), `eviction-e2e-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	after(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		fetchCalls = 0;
		lastRequestBody = null;
		warnLines = [];
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("keeps a near-maxSize readImage result intact and injects its vision block", async () => {
		// Budget for the JSON envelope that wraps the base64 payload.
		const { path, base64Length } = await writePngNear(testDir, MAX_SIZE - 128);
		assert.ok(
			base64Length > 20000 * 4,
			`payload (${base64Length}) must exceed the old 80,000-char default`,
		);
		assert.ok(base64Length < CEILING_CHARS, "payload must sit under the derived ceiling");

		globalThis.fetch = async (_url, init) => {
			fetchCalls += 1;
			lastRequestBody = JSON.parse(init?.body ?? "{}");
			return fetchCalls === 1 ? toolCallCompletion(path) : chatCompletion("a screenshot");
		};

		// Capture the warn that was the observable fingerprint of the bug.
		const originalWarn = logger.warn;
		logger.warn = (...args) => {
			warnLines.push(args.map((a) => (typeof a === "string" ? a : "")).join(" "));
		};

		try {
			const agent = createAgent({
				model: makeModel(),
				tools: [readImage],
				middleware: [createEvictionAwareFilesystemMiddleware({}), createImageDispatchMiddleware()],
			});

			const result = await agent.invoke({
				messages: [{ role: "user", content: "analyze this screenshot" }],
			});

			// 1. The persisted ToolMessage is still an intact image block.
			const toolMessage = result.messages.find(
				(m) => (m._getType?.() ?? m.type) === "tool" && m.name === "readImage",
			);
			assert.ok(toolMessage, "expected a readImage ToolMessage in the transcript");
			assert.ok(Array.isArray(toolMessage.content), "tool result must not be eviction prose");
			const url = toolMessage.content[0].image_url.url;
			const data = url.slice(url.indexOf(",") + 1);
			assert.ok(data.length > 0, "base64 payload must be intact");
			assert.strictEqual(data.length, base64Length);

			// 2. ImageDispatch built the vision block end to end.
			const messages = lastRequestBody?.messages ?? [];
			const hasImageBlock = messages.some((msg) =>
				Array.isArray(msg.content)
					? msg.content.some(
							(block) =>
								block.type === "image_url" &&
								block.image_url?.url?.startsWith("data:image/png;base64,"),
						)
					: false,
			);
			assert.ok(hasImageBlock, "expected the model request to carry the image content block");

			// 3. The bug's fingerprint never fired.
			assert.deepStrictEqual(
				warnLines.filter((line) => line.includes("failed to parse readImage")),
				[],
			);
		} finally {
			logger.warn = originalWarn;
		}
	});

	it("evicts a payload above the ceiling instead of blowing the context window", async () => {
		const middleware = createEvictionAwareFilesystemMiddleware({
			config: { image: { maxSize: MAX_SIZE } },
		});
		const { evicted, content } = await runWrapToolCall(
			middleware,
			makeReadImageMessage(CEILING_CHARS + 1, "call_over"),
		);

		assert.strictEqual(evicted, true);
		assert.ok(content.includes("large_tool_results"));
		// The eviction prose is what `buildImageBlock` used to choke on.
		assert.throws(() => JSON.parse(content), "evicted content must not be parseable JSON");
	});
});
