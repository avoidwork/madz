import { describe, it } from "node:test";
import assert from "node:assert";
import { resolvePath, assertPathAllowed } from "../../src/sandbox/pathResolver.js";
import { filterUrl, isSchemeAllowed } from "../../src/sandbox/urlFilter.js";
import { injectEnv, filterEnv } from "../../src/sandbox/envInjector.js";
import { enforceCapabilities } from "../../src/sandbox/capability.js";

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
	});
});

describe("sandbox - env injector", () => {
	describe("injectEnv", () => {
		it("selects only whitelisted vars", () => {
			process.env.PATH = "/usr/bin";
			process.env.HOME = "/home/user";
			process.env.SECRET = "hidden";

			const result = injectEnv(["PATH", "HOME"]);
			assert.strictEqual(result.PATH, "/usr/bin");
			assert.strictEqual(result.HOME, "/home/user");
			assert.strictEqual(result.SECRET, undefined);
		});

		it("works with empty whitelist", () => {
			const result = injectEnv([]);
			assert.strictEqual(Object.keys(result).length, 0);
		});

		it("skips non-existent vars", () => {
			const result = injectEnv(["NONEXISTENT_VAR_XYZ"]);
			assert.strictEqual(Object.keys(result).length, 0);
		});
	});

	describe("filterEnv", () => {
		it("filters env object by whitelist", () => {
			const env = { PATH: "/bin", HOME: "/root", TOKEN: "secret" };
			const result = filterEnv(env, ["PATH"]);
			assert.deepStrictEqual(result, { PATH: "/bin" });
		});

		it("handles null env", () => {
			assert.deepStrictEqual(filterEnv(null, ["PATH"]), {});
		});

		it("handles undefined env", () => {
			assert.deepStrictEqual(filterEnv(undefined, ["PATH"]), {});
		});
	});
});

describe("sandbox - capability enforcement", () => {
	describe("enforceCapabilities", () => {
		it("returns empty rules with no permissions", () => {
			const result = enforceCapabilities([]);
			assert.strictEqual(result.resources.length, 0);
			assert.strictEqual(result.rules.length, 0);
		});

		it("maps filesystem:read to read rule", () => {
			const result = enforceCapabilities(["filesystem:read"]);
			assert.deepStrictEqual(result.rules, [{ resource: "filesystem", action: "read" }]);
		});

		it("maps filesystem:write to read + write rules", () => {
			const result = enforceCapabilities(["filesystem:write"]);
			assert.strictEqual(result.resources.length, 2);
			assert.ok(result.resources.includes("filesystem:read"));
			assert.ok(result.resources.includes("filesystem:write"));
		});

		it("maps network:outbound to network rule", () => {
			const result = enforceCapabilities(["network:outbound"]);
			assert.ok(result.resources.includes("network:outbound"));
		});

		it("maps process:spawn to process rule", () => {
			const result = enforceCapabilities(["process:spawn"]);
			assert.ok(result.resources.includes("process:spawn"));
		});

		it("combines multiple permissions", () => {
			const result = enforceCapabilities(["network:outbound", "filesystem:read"]);
			assert.strictEqual(result.rules.length, 2);
		});
	});
});
