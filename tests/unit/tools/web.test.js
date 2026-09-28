import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
	detectSearchBackend,
	searchWebImpl,
	renderWebImpl,
	screenshotWebImpl,
	resizeScreenshot,
} from "../../../src/tools/web/index.js";

describe("detectSearchBackend", () => {
	it("returns duckduckgo when no config is provided", () => {
		assert.strictEqual(detectSearchBackend({}), "duckduckgo");
	});

	it("returns duckduckgo when no search config is provided", () => {
		assert.strictEqual(detectSearchBackend({ search: {} }), "duckduckgo");
	});

	it("returns custom when custom.url is set", () => {
		assert.strictEqual(
			detectSearchBackend({ search: { custom: { url: "https://example.com/search" } } }),
			"custom",
		);
	});

	it("returns bing when bing.apiKey is set", () => {
		assert.strictEqual(detectSearchBackend({ search: { bing: { apiKey: "test-key" } } }), "bing");
	});

	it("returns searxng when searxng.url is set", () => {
		assert.strictEqual(
			detectSearchBackend({ search: { searxng: { url: "https://searxng.example.com" } } }),
			"searxng",
		);
	});

	it("returns bing when engine is explicitly set to bing", () => {
		assert.strictEqual(detectSearchBackend({ search: { engine: "bing" } }), "bing");
	});

	it("returns duckduckgo when engine is explicitly set to duckduckgo", () => {
		assert.strictEqual(detectSearchBackend({ search: { engine: "duckduckgo" } }), "duckduckgo");
	});

	it("honors explicit engine over configured credentials", () => {
		assert.strictEqual(
			detectSearchBackend({
				search: { engine: "duckduckgo", bing: { apiKey: "test-key" } },
			}),
			"duckduckgo",
		);
	});

	it("honors explicit engine over custom.url", () => {
		assert.strictEqual(
			detectSearchBackend({
				search: { engine: "custom", custom: { url: "https://example.com/search" } },
			}),
			"custom",
		);
	});

	it("falls back to inference chain when engine is set to an unsupported value", () => {
		assert.strictEqual(detectSearchBackend({ search: { engine: "exa" } }), "duckduckgo");
	});

	it("falls back to inference chain when engine is set to an unsupported value but bing is configured", () => {
		assert.strictEqual(
			detectSearchBackend({ search: { engine: "exa", bing: { apiKey: "test-key" } } }),
			"bing",
		);
	});
});

describe("searchWebImpl", () => {
	it("returns an error for an empty query", async () => {
		const result = await searchWebImpl({ query: "" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /Query is required/);
	});

	it("returns an error when the query is not a string", async () => {
		const result = await searchWebImpl({ query: 123 });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /Query is required/);
	});

	it("passes duckduckgo config params to the search URL", async () => {
		let capturedUrl;
		const fetchMock = mock.method(globalThis, "fetch", async (url) => {
			capturedUrl = url;
			return {
				ok: true,
				status: 200,
				text: async () =>
					'<a rel="nofollow" class="result__a" href="https://example.com">Example</a><a class="result__snippet" href="https://example.com">A description</a>',
			};
		});
		try {
			const result = await searchWebImpl(
				{ query: "test", limit: 5 },
				{
					search: {
						engine: "duckduckgo",
						duckduckgo: {
							region: "ca-en",
							safeSearch: "2",
							time: "w",
							baseUrl: "https://html.duckduckgo.com/html/",
						},
					},
				},
			);
			const parsed = JSON.parse(result);
			assert.strictEqual(parsed.ok, true);
			assert.strictEqual(parsed.backend, "duckduckgo");
			assert.strictEqual(capturedUrl.searchParams.get("kl"), "ca-en");
			assert.strictEqual(capturedUrl.searchParams.get("safe"), "2");
			assert.strictEqual(capturedUrl.searchParams.get("df"), "w");
		} finally {
			fetchMock.mock.restore();
		}
	});
});

describe("renderWebImpl", () => {
	it("returns an error when the URL is missing", async () => {
		const result = await renderWebImpl({});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /URL is required/);
	});

	it("returns an error when the URL is not a string", async () => {
		const result = await renderWebImpl({ url: 123 });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /URL is required/);
	});

	it("rejects a URL with a blocked scheme", async () => {
		const result = await renderWebImpl({ url: "file:///etc/passwd" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /URL rejected/);
	});

	it("rejects an internal host", async () => {
		const result = await renderWebImpl({ url: "http://127.0.0.1/" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /URL rejected/);
	});

	it("returns extracted text on a successful render", async () => {
		const launchBrowser = async () => ({ close: async () => {} });
		const openPage = async () => ({
			goto: async () => {},
			evaluate: async () => "Rendered text from JS",
			close: async () => {},
		});
		const result = await renderWebImpl({ url: "https://example.com" }, { launchBrowser, openPage });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.url, "https://example.com");
		assert.strictEqual(parsed.content, "Rendered text from JS");
		assert.strictEqual(parsed.contentLength, 21);
	});

	it("returns an error when the render fails", async () => {
		const launchBrowser = async () => ({ close: async () => {} });
		const openPage = async () => ({
			goto: async () => {
				throw new Error("Navigation timeout");
			},
			close: async () => {},
		});
		const result = await renderWebImpl({ url: "https://example.com" }, { launchBrowser, openPage });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /Render failed/);
	});

	it("rejects a URL with a blocked scheme", async () => {
		const result = await renderWebImpl({ url: "file:///etc/passwd" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /URL rejected/);
	});

	it("rejects a URL with an internal host", async () => {
		const result = await renderWebImpl({ url: "http://127.0.0.1/" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /URL rejected/);
	});

	it("returns an error when the URL is missing", async () => {
		const result = await renderWebImpl({});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /URL is required/);
	});
});

describe("screenshotWebImpl", () => {
	it("returns an error when the URL is missing", async () => {
		const result = await screenshotWebImpl({});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /URL is required/);
	});

	it("rejects a URL with a blocked scheme", async () => {
		const result = await screenshotWebImpl({ url: "gopher://example.com" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /URL rejected/);
	});

	it("returns a base64 PNG on a successful capture", async () => {
		const launchBrowser = async () => ({ close: async () => {} });
		const openPage = async () => ({
			goto: async () => {},
			screenshot: async () => "aGVsbG8=",
			close: async () => {},
		});
		const resizeScreenshot = async (data) => data;
		const result = await screenshotWebImpl(
			{ url: "https://example.com" },
			{ launchBrowser, openPage, resizeScreenshot },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(parsed.mimeType, "image/png");
		assert.strictEqual(parsed.data, "aGVsbG8=");
	});

	it("resizes the screenshot when maxWidth is provided", async () => {
		const launchBrowser = async () => ({ close: async () => {} });
		const openPage = async () => ({
			goto: async () => {},
			screenshot: async () => "aGVsbG8=",
			close: async () => {},
		});
		let capturedWidth;
		const resizeScreenshot = async (data, maxWidth) => {
			capturedWidth = maxWidth;
			return data;
		};
		const result = await screenshotWebImpl(
			{ url: "https://example.com", maxWidth: 800 },
			{ launchBrowser, openPage, resizeScreenshot },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, true);
		assert.strictEqual(capturedWidth, 800);
	});

	it("returns an error when the capture fails", async () => {
		const launchBrowser = async () => ({ close: async () => {} });
		const openPage = async () => ({
			goto: async () => {},
			screenshot: async () => {
				throw new Error("Screenshot failed");
			},
			close: async () => {},
		});
		const result = await screenshotWebImpl(
			{ url: "https://example.com" },
			{ launchBrowser, openPage },
		);
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /Screenshot failed/);
	});

	it("rejects a URL with a blocked scheme", async () => {
		const result = await screenshotWebImpl({ url: "file:///etc/passwd" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /URL rejected/);
	});

	it("rejects a URL with an internal host", async () => {
		const result = await screenshotWebImpl({ url: "http://127.0.0.1/" });
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /URL rejected/);
	});

	it("returns an error when the URL is missing", async () => {
		const result = await screenshotWebImpl({});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.ok, false);
		assert.match(parsed.error, /URL is required/);
	});
});

describe("resizeScreenshot", () => {
	it("resizes a wide image to the max width", async () => {
		const { default: sharp } = await import("sharp");
		const buf = await sharp({
			create: { width: 2000, height: 1000, channels: 3, background: { r: 100, g: 150, b: 200 } },
		})
			.png()
			.toBuffer();
		const b64 = buf.toString("base64");
		const resized = await resizeScreenshot(b64, 1024);
		const meta = await sharp(Buffer.from(resized, "base64")).metadata();
		assert.strictEqual(meta.width, 1024);
	});

	it("leaves an image unchanged when it is within the max width", async () => {
		const { default: sharp } = await import("sharp");
		const buf = await sharp({
			create: { width: 800, height: 600, channels: 3, background: { r: 50, g: 50, b: 50 } },
		})
			.png()
			.toBuffer();
		const b64 = buf.toString("base64");
		const resized = await resizeScreenshot(b64, 1024);
		assert.strictEqual(resized, b64);
	});

	it("re-encodes to fit a byte budget when the resized image exceeds maxSize", async () => {
		const { default: sharp } = await import("sharp");
		// A large, high-detail image that will not fit under a tight byte budget
		// at the default width.
		const buf = await sharp({
			create: { width: 2000, height: 1500, channels: 3, background: { r: 200, g: 120, b: 40 } },
		})
			.png()
			.toBuffer();
		const b64 = buf.toString("base64");
		const resized = await resizeScreenshot(b64, 1024, 20 * 1024);
		const out = Buffer.from(resized, "base64");
		assert.ok(out.length <= 20 * 1024, `expected <= 20kb, got ${out.length} bytes`);
		const meta = await sharp(out).metadata();
		assert.ok(meta.width <= 1024);
	});

	it("returns the resized image when it already fits the byte budget", async () => {
		const { default: sharp } = await import("sharp");
		const buf = await sharp({
			create: { width: 800, height: 600, channels: 3, background: { r: 50, g: 50, b: 50 } },
		})
			.png()
			.toBuffer();
		const b64 = buf.toString("base64");
		const resized = await resizeScreenshot(b64, 1024, 1024 * 1024);
		const out = Buffer.from(resized, "base64");
		assert.ok(out.length <= 1024 * 1024);
	});
});
