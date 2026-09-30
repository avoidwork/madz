import { describe, it } from "node:test";
import assert from "node:assert";
import { sendImage, sendImageImpl } from "../../../../src/tools/image/sendImage.js";

describe("sendImage tool", () => {
	it("has correct tool metadata", () => {
		assert.strictEqual(sendImage.name, "sendImage");
		assert.ok(typeof sendImage.description === "string");
		assert.ok(sendImage.description.length > 0);
	});

	it("builds a multimodal content array from valid data", () => {
		const result = sendImageImpl({
			data: "iVBORw0KGgo=",
			mimeType: "image/png",
			text: "analyze this",
		});

		assert.strictEqual(result.length, 2);
		assert.deepStrictEqual(result[0], { type: "text", text: "analyze this" });
		assert.deepStrictEqual(result[1], {
			type: "image_url",
			image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
		});
	});

	it("preserves a known MIME type in the data URI", () => {
		const result = sendImageImpl({
			data: "AAAA",
			mimeType: "image/jpeg",
			text: "x",
		});
		assert.strictEqual(result[1].image_url.url, "data:image/jpeg;base64,AAAA");
	});

	it("defaults an unknown MIME type to image/png", () => {
		const result = sendImageImpl({
			data: "AAAA",
			mimeType: "image/weird",
			text: "x",
		});
		assert.strictEqual(result[1].image_url.url, "data:image/png;base64,AAAA");
	});

	it("defaults an absent MIME type to image/png", () => {
		const result = sendImageImpl({ data: "AAAA", text: "x" });
		assert.strictEqual(result[1].image_url.url, "data:image/png;base64,AAAA");
	});

	it("rejects missing data via schema validation", async () => {
		await assert.rejects(async () => sendImage.invoke({ text: "x" }), /data/i);
	});

	it("rejects empty data via schema validation", async () => {
		await assert.rejects(async () => sendImage.invoke({ data: "", text: "x" }), /data/i);
	});

	it("rejects missing text via schema validation", async () => {
		await assert.rejects(async () => sendImage.invoke({ data: "AAAA" }), /text/i);
	});
});
