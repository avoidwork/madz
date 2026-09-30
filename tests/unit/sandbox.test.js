import { describe, it } from "node:test";
import assert from "node:assert";
import { join } from "node:path";
import { resolvePath, assertPathAllowed } from "../../src/sandbox/pathResolver.js";
import { filterUrl, isSchemeAllowed } from "../../src/sandbox/urlFilter.js";

describe("sandbox - path resolution", () => {
	describe("resolvePath", () => {
		it("allows path within scope", () => {
			const result = resolvePath("memory/test.md", ["memory/"]);
			assert.strictEqual(result.allowed, true);
		});

		it("rejects path outside scope", () => {
			const result = resolvePath("/etc/passwd", ["memory/"]);
			assert.strictEqual(result.allowed, false);
		});

		it("allows exact match", () => {
			const result = resolvePath("memory/", ["memory/"]);
			assert.strictEqual(result.allowed, true);
		});

		it("allows nested path within scope", () => {
			const result = resolvePath("memory/subdir/file.md", ["memory/"]);
			assert.strictEqual(result.allowed, true);
		});

		it("rejects path with parent traversal", () => {
			const result = resolvePath("memory/../../../etc/passwd", ["memory/"]);
			assert.strictEqual(result.allowed, false);
		});

		it("allows when multiple scopes match", () => {
			const result = resolvePath("skills/fs-read/script.sh", ["memory/", "skills/"]);
			assert.strictEqual(result.allowed, true);
		});

		it("rejects with no allowed paths", () => {
			const result = resolvePath("/any/path", []);
			assert.strictEqual(result.allowed, false);
		});

		it("handles absolute paths in scope", () => {
			const result = resolvePath("/home/user/memory/", ["/home/user/memory/"]);
			assert.strictEqual(result.allowed, true);
		});

		it("excludes path matching negation rule", () => {
			const result = resolvePath("node_modules/pkg/index.js", ["./", "!node_modules/"]);
			assert.strictEqual(result.allowed, false);
		});

		it("excludes nested path under negated directory", () => {
			const result = resolvePath("node_modules/@scope/package/src/file.js", [
				"./",
				"!node_modules/",
			]);
			assert.strictEqual(result.allowed, false);
		});

		it("allows path that matches positive rule but not negation", () => {
			const result = resolvePath("src/utils/helper.js", ["./", "!node_modules/"]);
			assert.strictEqual(result.allowed, true);
		});

		it("allows path outside negated scope even with broad positive", () => {
			const result = resolvePath("memory/data.json", ["./", "!node_modules/"]);
			assert.strictEqual(result.allowed, true);
		});

		it("handles multiple negation rules", () => {
			const result = resolvePath("tmp/cache.dat", ["./", "!node_modules/", "!tmp/"]);
			assert.strictEqual(result.allowed, false);
		});

		it("allows when no positive rule matches despite negation", () => {
			const result = resolvePath("/etc/passwd", ["./", "!node_modules/"]);
			assert.strictEqual(result.allowed, false);
		});

		it("ignores negation-only config (no positives)", () => {
			const result = resolvePath("memory/file.txt", ["!node_modules/"]);
			assert.strictEqual(result.allowed, false);
		});

		it("handles negation with matching absolute paths", () => {
			const cwd = process.cwd();
			const result = resolvePath(join(cwd, "node_modules/x.js"), [
				join(cwd, "/"),
				"!node_modules/",
			]);
			assert.strictEqual(result.allowed, false);
		});

		it("handles empty negation path string", () => {
			const result = resolvePath("memory/file.txt", ["./", ""]);
			assert.strictEqual(result.allowed, true);
		});
	});

	describe("assertPathAllowed", () => {
		it("returns resolved path when allowed", () => {
			const result = assertPathAllowed("memory/test.md", ["memory/"]);
			assert.ok(result.includes("memory"));
		});

		it("throws AccessDeniedError when outside scope", () => {
			assert.throws(
				() => assertPathAllowed("/etc/passwd", ["memory/"]),
				(err) => err.name === "AccessDeniedError",
			);
		});
	});
});

describe("sandbox - URL filtering", () => {
	describe("filterUrl", () => {
		it("allows http URLs", () => {
			const result = filterUrl("http://api.example.com/health", ["api.example.com"]);
			assert.strictEqual(result.allowed, true);
		});

		it("blocks file:// scheme", () => {
			const result = filterUrl("file:///etc/passwd");
			assert.strictEqual(result.allowed, false);
			assert.ok(result.reason.includes("Blocked scheme"));
		});

		it("blocks gopher:// scheme", () => {
			const result = filterUrl("gopher://example.com");
			assert.strictEqual(result.allowed, false);
		});

		it("blocks dict:// scheme", () => {
			const result = filterUrl("dict://example.com");
			assert.strictEqual(result.allowed, false);
		});

		it("rejects URLs not on allowlist", () => {
			const result = filterUrl("http://evil.com", ["api.example.com"]);
			assert.strictEqual(result.allowed, false);
		});

		it("accepts valid URL on allowlist", () => {
			const result = filterUrl("https://api.example.com/v1/data", ["api.example.com"]);
			assert.strictEqual(result.allowed, true);
		});

		it("handles invalid URLs", () => {
			const result = filterUrl("not-a-url");
			assert.strictEqual(result.allowed, false);
		});

		it("handles empty URL", () => {
			const result = filterUrl("");
			assert.strictEqual(result.allowed, false);
		});

		it("handles null URL", () => {
			const result = filterUrl(null);
			assert.strictEqual(result.allowed, false);
		});

		it("works without allowlist", () => {
			const result = filterUrl("http://any-domain.com/path");
			assert.strictEqual(result.allowed, true);
		});
	});

	describe("isSchemeAllowed", () => {
		it("allows http", () => assert.strictEqual(isSchemeAllowed("http://example.com"), true));
		it("allows https", () => assert.strictEqual(isSchemeAllowed("https://example.com"), true));
		it("blocks file://", () => assert.strictEqual(isSchemeAllowed("file:///etc/passwd"), false));
		it("returns false for invalid URL format (catch block)", () => {
			const result = isSchemeAllowed("://missing-scheme");
			assert.strictEqual(result, false);
		});
	});
});
