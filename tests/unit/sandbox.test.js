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
		it("allows http URLs", async () => {
			const result = await filterUrl("http://api.example.com/health", ["api.example.com"]);
			assert.strictEqual(result.allowed, true);
		});

		it("blocks file:// scheme", async () => {
			const result = await filterUrl("file:///etc/passwd");
			assert.strictEqual(result.allowed, false);
			assert.ok(result.reason.includes("Blocked scheme"));
		});

		it("blocks gopher:// scheme", async () => {
			const result = await filterUrl("gopher://example.com");
			assert.strictEqual(result.allowed, false);
		});

		it("blocks dict:// scheme", async () => {
			const result = await filterUrl("dict://example.com");
			assert.strictEqual(result.allowed, false);
		});

		it("rejects URLs not on allowlist", async () => {
			const result = await filterUrl("http://evil.com", ["api.example.com"]);
			assert.strictEqual(result.allowed, false);
		});

		it("accepts valid URL on allowlist", async () => {
			const result = await filterUrl("https://api.example.com/v1/data", ["api.example.com"]);
			assert.strictEqual(result.allowed, true);
		});

		it("handles invalid URLs", async () => {
			const result = await filterUrl("not-a-url");
			assert.strictEqual(result.allowed, false);
		});

		it("handles empty URL", async () => {
			const result = await filterUrl("");
			assert.strictEqual(result.allowed, false);
		});

		it("handles null URL", async () => {
			const result = await filterUrl(null);
			assert.strictEqual(result.allowed, false);
		});

		it("works without allowlist", async () => {
			const result = await filterUrl("http://any-domain.com/path");
			assert.strictEqual(result.allowed, true);
		});

		it("blocks a hostname that resolves to a private IP", async () => {
			const resolver = async () => ({ address: "169.254.169.254", family: 4 });
			const result = await filterUrl("http://metadata.internal/latest", [], resolver);
			assert.strictEqual(result.allowed, false);
			assert.ok(result.reason.includes("Blocked internal host"));
		});

		it("blocks a hostname that resolves to a loopback IP", async () => {
			const resolver = async () => ({ address: "127.0.0.1", family: 4 });
			const result = await filterUrl("http://internal.example.com", [], resolver);
			assert.strictEqual(result.allowed, false);
			assert.ok(result.reason.includes("Blocked internal host"));
		});

		it("allows a hostname that resolves to a public IP", async () => {
			const resolver = async () => ({ address: "93.184.216.34", family: 4 });
			const result = await filterUrl("http://example.com", [], resolver);
			assert.strictEqual(result.allowed, true);
		});

		it("rejects a prefix-match bypass on the allowlist", async () => {
			const result = await filterUrl("https://example.com.evil.com", ["https://example.com"]);
			assert.strictEqual(result.allowed, false);
			assert.ok(result.reason.includes("Host not on allowlist"));
		});

		it("matches allowlist on exact hostname, not URL prefix", async () => {
			const result = await filterUrl("https://example.com/path", ["https://example.com"]);
			assert.strictEqual(result.allowed, true);
		});

		it("rejects a subdomain not explicitly allowlisted", async () => {
			const result = await filterUrl("https://sub.example.com", ["example.com"]);
			assert.strictEqual(result.allowed, false);
			assert.ok(result.reason.includes("Host not on allowlist"));
		});

		it("matches allowlist on hostname and port", async () => {
			const result = await filterUrl("https://example.com:8080/path", ["example.com:8080"]);
			assert.strictEqual(result.allowed, true);
		});

		it("rejects a port mismatch on the allowlist", async () => {
			const result = await filterUrl("https://example.com/path", ["example.com:8080"]);
			assert.strictEqual(result.allowed, false);
			assert.ok(result.reason.includes("Host not on allowlist"));
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
