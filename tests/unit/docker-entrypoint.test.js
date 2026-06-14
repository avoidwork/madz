import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("docker-entrypoint.sh", () => {
	it("should start crond without the -f flag", () => {
		const entrypointPath = join(process.cwd(), "docker-entrypoint.sh");
		const content = readFileSync(entrypointPath, "utf-8");

		// crond should be started with "&" for backgrounding
		assert.ok(content.includes("crond &"), "entrypoint should start crond as a background process");

		// crond should NOT be started with "-f" (foreground mode)
		assert.ok(
			!content.includes("crond -f"),
			"entrypoint should not use -f flag (foreground mode) for crond",
		);
	});
});
