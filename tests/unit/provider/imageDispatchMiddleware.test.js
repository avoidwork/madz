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
