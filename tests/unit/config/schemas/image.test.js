import { describe, it } from "node:test";
import assert from "node:assert";
import {
	ImageSchema,
	DEFAULT_IMAGE_MAX_SIZE,
	MIN_IMAGE_MAX_SIZE,
	MAX_IMAGE_MAX_SIZE,
} from "../../../../src/config/schemas/image.js";

describe("ImageSchema maxSize clamp", () => {
	it("defaults to the documented base64 budget", () => {
		const result = ImageSchema.parse({});
		assert.strictEqual(result.maxSize, DEFAULT_IMAGE_MAX_SIZE);
	});

	it("accepts a value inside the bounds", () => {
		const result = ImageSchema.parse({ maxSize: 200000 });
		assert.strictEqual(result.maxSize, 200000);
	});

	it("accepts the bound values themselves", () => {
		assert.strictEqual(
			ImageSchema.parse({ maxSize: MIN_IMAGE_MAX_SIZE }).maxSize,
			MIN_IMAGE_MAX_SIZE,
		);
		assert.strictEqual(
			ImageSchema.parse({ maxSize: MAX_IMAGE_MAX_SIZE }).maxSize,
			MAX_IMAGE_MAX_SIZE,
		);
	});

	it("rejects zero so eviction can never be disabled", () => {
		assert.strictEqual(ImageSchema.safeParse({ maxSize: 0 }).success, false);
	});

	it("rejects negative values", () => {
		assert.strictEqual(ImageSchema.safeParse({ maxSize: -1 }).success, false);
	});

	it("rejects non-integers", () => {
		assert.strictEqual(ImageSchema.safeParse({ maxSize: 1000.5 }).success, false);
	});

	it("rejects a value above the context-window DoS ceiling", () => {
		assert.strictEqual(ImageSchema.safeParse({ maxSize: MAX_IMAGE_MAX_SIZE + 1 }).success, false);
	});

	it("rejects a value below the floor", () => {
		assert.strictEqual(ImageSchema.safeParse({ maxSize: MIN_IMAGE_MAX_SIZE - 1 }).success, false);
	});

	it("keeps IMAGE_MAX_SIZE discoverable as an env-var override", async () => {
		// A `.transform()`/`.pipe()` wrapper would make the field invisible to the
		// loader's schema-driven env reverse map, silently killing the override.
		const { buildReverseMap } = await import("../../../../src/config/loader.js");
		const map = buildReverseMap(ImageSchema);
		assert.strictEqual(map.get("MAX_SIZE"), "maxSize");
	});
});
