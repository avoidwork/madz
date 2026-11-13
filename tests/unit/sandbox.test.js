import { describe, it } from "node:test";
import assert from "node:assert";
import { join } from "node:path";
import { resolvePath, assertPathAllowed } from "../../src/sandbox/pathResolver.js";
import { filterUrl, isSchemeAllowed, hostMatchesPattern } from "../../src/sandbox/urlFilter.js";

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

		it("ignores non-string and empty rules instead of throwing", () => {
			assert.strictEqual(resolvePath("memory/a.md", [null]).allowed, false);
			assert.strictEqual(resolvePath("memory/a.md", [undefined, 5, "", "!"]).allowed, false);
			assert.strictEqual(resolvePath("memory/a.md", [null, "memory/"]).allowed, true);
		});

		it("root rule matches paths under /", () => {
			assert.strictEqual(resolvePath("/etc/hostname", ["/"]).allowed, true);
			assert.strictEqual(resolvePath("/", ["/"]).allowed, true);
			assert.strictEqual(resolvePath("/etc/hostname", ["/", "!/etc"]).allowed, false);
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

		it("only allows http and https schemes", () => {
			for (const url of [
				"ftp://example.com/x",
				"ws://example.com/",
				"wss://example.com/",
				"data:text/plain,hi",
				"javascript:alert(1)",
			]) {
				const result = filterUrl(url);
				assert.strictEqual(result.allowed, false, url);
				assert.ok(result.reason.startsWith("Blocked scheme: "), url);
			}
		});

		it("bare host entry allows http and https on default ports only", () => {
			const list = ["good.com"];
			assert.strictEqual(filterUrl("http://good.com/", list).allowed, true);
			assert.strictEqual(filterUrl("https://good.com/", list).allowed, true);
			assert.strictEqual(filterUrl("https://good.com:443/", list).allowed, true);
			assert.strictEqual(filterUrl("http://good.com:8080/", list).allowed, false);
			assert.strictEqual(filterUrl("https://good.com:8443/", list).allowed, false);
			// 443 is not the default for http
			assert.strictEqual(filterUrl("http://good.com:443/", list).allowed, false);
		});

		it("host:port entry keeps working and URL-form entry pins the scheme", () => {
			assert.strictEqual(filterUrl("http://localhost:11434/x", ["localhost:11434"]).allowed, true);
			assert.strictEqual(filterUrl("http://localhost:80/", ["localhost:11434"]).allowed, false);
			assert.strictEqual(filterUrl("http://good.com/", ["https://good.com"]).allowed, false);
			assert.strictEqual(filterUrl("https://good.com/", ["https://good.com"]).allowed, true);
		});

		it("wildcard matches subdomains at any depth but not the apex", () => {
			const list = ["*.good.com"];
			assert.strictEqual(filterUrl("https://a.good.com/", list).allowed, true);
			assert.strictEqual(filterUrl("https://a.b.good.com/", list).allowed, true);
			assert.strictEqual(filterUrl("https://good.com/", list).allowed, false);
			assert.strictEqual(filterUrl("https://evilgood.com/", list).allowed, false);
		});

		it("single-label and empty wildcards match nothing", () => {
			assert.strictEqual(hostMatchesPattern("example.com", "*.com"), false);
			assert.strictEqual(hostMatchesPattern("com", "*.com"), false);
			assert.strictEqual(hostMatchesPattern("example.com", "*."), false);
			assert.strictEqual(filterUrl("https://example.com/", ["*.com"]).allowed, false);
		});

		it("wildcards never match IP literals", () => {
			assert.strictEqual(hostMatchesPattern("1.2.3.4", "*.2.3.4"), false);
			assert.strictEqual(filterUrl("http://10.1.2.3/", ["*.1.2.3"]).allowed, false);
			assert.strictEqual(hostMatchesPattern("[::1]", "*.ip6.arpa"), false);
		});
	});

	describe("isSchemeAllowed", () => {
		it("allows http", () => assert.strictEqual(isSchemeAllowed("http://example.com"), true));
		it("allows https", () => assert.strictEqual(isSchemeAllowed("https://example.com"), true));
		it("blocks file://", () => assert.strictEqual(isSchemeAllowed("file:///etc/passwd"), false));
		it("blocks other non-http schemes", () => {
			for (const u of ["ftp://x.com", "ws://x.com", "data:text/plain,a", "javascript:1"]) {
				assert.strictEqual(isSchemeAllowed(u), false, u);
			}
		});
		it("returns false for invalid URL format (catch block)", () => {
			const result = isSchemeAllowed("://missing-scheme");
			assert.strictEqual(result, false);
		});
	});
});
