import { describe, it } from "node:test";
import assert from "node:assert";
import { HumanMessage, ToolMessage, AIMessage } from "@langchain/core/messages";
import { createImageDispatchMiddleware } from "../../../src/provider/imageDispatchMiddleware.js";

/**
 * Build a minimal wrapModelCall request with the given messages.
 * @param {Array} messages - LangChain messages
 * @returns {Object} request
 */
function makeRequest(messages) {
	return { messages, systemMessage: null, model: {} };
}

describe("createImageDispatchMiddleware factory", () => {
	it("names the middleware ImageDispatch and exposes wrapModelCall", () => {
		const mw = createImageDispatchMiddleware();
		assert.strictEqual(mw.name, "ImageDispatch");
		assert.strictEqual(typeof mw.wrapModelCall, "function");
	});
});

describe("imageDispatchMiddleware wrapModelCall", () => {
	it("injects a multimodal HumanMessage when a readImage ToolMessage is present", async () => {
		const mw = createImageDispatchMiddleware();
		const request = makeRequest([
			new HumanMessage({ content: "analyze this screenshot" }),
			new AIMessage({
				content: "reading",
				tool_calls: [{ name: "readImage", args: { path: "/tmp/x.png" }, id: "call_1" }],
			}),
			new ToolMessage({
				content: JSON.stringify({ ok: true, mimeType: "image/png", data: "iVBORw0KGgo=" }),
				name: "readImage",
				tool_call_id: "call_1",
			}),
		]);

		let captured;
		await mw.wrapModelCall(request, async (req) => {
			captured = req;
			return { content: "ok" };
		});

		assert.strictEqual(captured.messages.length, 4);
		const last = captured.messages[captured.messages.length - 1];
		assert.strictEqual(last._getType(), "human");
		assert.strictEqual(last.content.length, 2);
		assert.deepStrictEqual(last.content[0], { type: "text", text: "analyze this screenshot" });
		assert.deepStrictEqual(last.content[1], {
			type: "image_url",
			image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
		});
	});

	it("strips the base64 payload from the readImage ToolMessage content", async () => {
		const mw = createImageDispatchMiddleware();
		const request = makeRequest([
			new HumanMessage({ content: "analyze this screenshot" }),
			new AIMessage({
				content: "reading",
				tool_calls: [{ name: "readImage", args: { path: "/tmp/x.png" }, id: "call_1" }],
			}),
			new ToolMessage({
				content: JSON.stringify({ ok: true, mimeType: "image/png", data: "iVBORw0KGgo=" }),
				name: "readImage",
				tool_call_id: "call_1",
			}),
		]);

		let captured;
		await mw.wrapModelCall(request, async (req) => {
			captured = req;
			return { content: "ok" };
		});

		const toolMsg = captured.messages.find((m) => m._getType() === "tool");
		assert.strictEqual(toolMsg.content, "Image read successfully.");
	});

	it("pairs the image with the triggering prompt, not the most recent one", async () => {
		const mw = createImageDispatchMiddleware();
		// The readImage call was triggered by "analyze this screenshot", but a
		// later unrelated HumanMessage precedes the tool result in the message
		// list. The image must pair with the triggering prompt.
		const request = makeRequest([
			new HumanMessage({ content: "analyze this screenshot" }),
			new AIMessage({
				content: "reading",
				tool_calls: [{ name: "readImage", args: { path: "/tmp/x.png" }, id: "call_1" }],
			}),
			new ToolMessage({
				content: JSON.stringify({ ok: true, mimeType: "image/png", data: "iVBORw0KGgo=" }),
				name: "readImage",
				tool_call_id: "call_1",
			}),
			new HumanMessage({ content: "summarize this code" }),
		]);

		let captured;
		await mw.wrapModelCall(request, async (req) => {
			captured = req;
			return { content: "ok" };
		});

		const last = captured.messages[captured.messages.length - 1];
		assert.strictEqual(last._getType(), "human");
		assert.deepStrictEqual(last.content[0], { type: "text", text: "analyze this screenshot" });
	});

	it("injects the image only once and does not re-attach it to a later unrelated prompt", async () => {
		const mw = createImageDispatchMiddleware();
		const readImageToolMessage = new ToolMessage({
			content: JSON.stringify({ ok: true, mimeType: "image/png", data: "iVBORw0KGgo=" }),
			name: "readImage",
			tool_call_id: "call_1",
		});

		// Turn 1: the readImage call is processed — image is injected.
		const turn1 = makeRequest([
			new HumanMessage({ content: "analyze this screenshot" }),
			new AIMessage({
				content: "reading",
				tool_calls: [{ name: "readImage", args: { path: "/tmp/x.png" }, id: "call_1" }],
			}),
			readImageToolMessage,
		]);

		let captured1;
		await mw.wrapModelCall(turn1, async (req) => {
			captured1 = req;
			return { content: "ok" };
		});

		const last1 = captured1.messages[captured1.messages.length - 1];
		assert.strictEqual(last1._getType(), "human");
		assert.strictEqual(last1.content.length, 2);
		assert.strictEqual(last1.content[1].type, "image_url");

		// Turn 2: an unrelated prompt. The readImage ToolMessage is still in
		// state, but it was already dispatched — no image should be injected.
		const turn2 = makeRequest([
			new HumanMessage({ content: "summarize this code" }),
			readImageToolMessage,
		]);

		let captured2;
		await mw.wrapModelCall(turn2, async (req) => {
			captured2 = req;
			return { content: "ok" };
		});

		assert.strictEqual(captured2.messages.length, 2);
		// No new multimodal HumanMessage was injected — the image is not
		// re-attached to the unrelated prompt.
		const hasImageBlock = captured2.messages.some(
			(m) => Array.isArray(m.content) && m.content.some((b) => b?.type === "image_url"),
		);
		assert.strictEqual(hasImageBlock, false);
		const human2 = captured2.messages.find((m) => m._getType() === "human");
		assert.strictEqual(human2.content, "summarize this code");
	});

	it("defaults unknown MIME type to image/png", async () => {
		const mw = createImageDispatchMiddleware();
		const request = makeRequest([
			new HumanMessage({ content: "analyze" }),
			new ToolMessage({
				content: JSON.stringify({ ok: true, mimeType: "image/weird", data: "AAAA" }),
				name: "readImage",
				tool_call_id: "call_1",
			}),
		]);

		let captured;
		await mw.wrapModelCall(request, async (req) => {
			captured = req;
			return {};
		});

		const last = captured.messages[captured.messages.length - 1];
		assert.strictEqual(last.content[1].image_url.url, "data:image/png;base64,AAAA");
	});

	it("skips an ok:false readImage result", async () => {
		const mw = createImageDispatchMiddleware();
		const request = makeRequest([
			new HumanMessage({ content: "analyze" }),
			new ToolMessage({
				content: JSON.stringify({ ok: false, error: "not found" }),
				name: "readImage",
				tool_call_id: "call_1",
			}),
		]);

		let captured;
		await mw.wrapModelCall(request, async (req) => {
			captured = req;
			return {};
		});

		assert.strictEqual(captured.messages.length, 2);
	});

	it("skips a readImage result with missing or empty data", async () => {
		const mw = createImageDispatchMiddleware();
		const request = makeRequest([
			new HumanMessage({ content: "analyze" }),
			new ToolMessage({
				content: JSON.stringify({ ok: true, mimeType: "image/png", data: "" }),
				name: "readImage",
				tool_call_id: "call_1",
			}),
		]);

		let captured;
		await mw.wrapModelCall(request, async (req) => {
			captured = req;
			return {};
		});

		assert.strictEqual(captured.messages.length, 2);
	});

	it("skips a malformed readImage result JSON", async () => {
		const mw = createImageDispatchMiddleware();
		const request = makeRequest([
			new HumanMessage({ content: "analyze" }),
			new ToolMessage({ content: "not-json", name: "readImage", tool_call_id: "call_1" }),
		]);

		let captured;
		await mw.wrapModelCall(request, async (req) => {
			captured = req;
			return {};
		});

		assert.strictEqual(captured.messages.length, 2);
	});

	it("injects one HumanMessage with multiple image blocks for multiple readImage results", async () => {
		const mw = createImageDispatchMiddleware();
		const request = makeRequest([
			new HumanMessage({ content: "analyze these" }),
			new AIMessage({
				content: "reading",
				tool_calls: [
					{ name: "readImage", args: {}, id: "call_1" },
					{ name: "readImage", args: {}, id: "call_2" },
				],
			}),
			new ToolMessage({
				content: JSON.stringify({ ok: true, mimeType: "image/png", data: "AAA=" }),
				name: "readImage",
				tool_call_id: "call_1",
			}),
			new ToolMessage({
				content: JSON.stringify({ ok: true, mimeType: "image/jpeg", data: "BBB=" }),
				name: "readImage",
				tool_call_id: "call_2",
			}),
		]);

		let captured;
		await mw.wrapModelCall(request, async (req) => {
			captured = req;
			return {};
		});

		const last = captured.messages[captured.messages.length - 1];
		assert.strictEqual(last.content.length, 3);
		const imageUrls = last.content
			.filter((block) => block.type === "image_url")
			.map((block) => block.image_url.url);
		assert.deepStrictEqual(imageUrls, [
			"data:image/png;base64,AAA=",
			"data:image/jpeg;base64,BBB=",
		]);
	});

	it("is a no-op when no readImage ToolMessage is present", async () => {
		const mw = createImageDispatchMiddleware();
		const request = makeRequest([new HumanMessage({ content: "hello" })]);

		let captured;
		await mw.wrapModelCall(request, async (req) => {
			captured = req;
			return {};
		});

		assert.strictEqual(captured.messages.length, 1);
	});

	it("does not react to non-readImage tool messages", async () => {
		const mw = createImageDispatchMiddleware();
		const request = makeRequest([
			new HumanMessage({ content: "hello" }),
			new ToolMessage({
				content: JSON.stringify({ ok: true, data: "AAAA" }),
				name: "someOtherTool",
				tool_call_id: "call_1",
			}),
		]);

		let captured;
		await mw.wrapModelCall(request, async (req) => {
			captured = req;
			return {};
		});

		assert.strictEqual(captured.messages.length, 2);
	});
});
