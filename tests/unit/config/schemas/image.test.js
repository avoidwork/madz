import { describe, it } from "node:test";
import assert from "node:assert";
import { ImageSchema, DEFAULT_IMAGE_MAX_DIMENSION } from "../../../../src/config/schemas/image.js";

describe("ImageSchema", () => {
	it("applies width and dimension defaults", () => {
		const result = ImageSchema.parse({});
		assert.strictEqual(result.maxWidth, 1920);
		assert.strictEqual(result.maxDimension, DEFAULT_IMAGE_MAX_DIMENSION);
	});

	it("no longer defines maxSize", () => {
		assert.strictEqual("maxSize" in ImageSchema.parse({}), false);
	});
});
