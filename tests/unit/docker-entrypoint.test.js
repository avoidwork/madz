import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("docker-entrypoint.sh", () => {
	it("should start crond with proper flags for container operation", () => {
		const entrypointPath = join(process.cwd(), "docker-entrypoint.sh");
		const content = readFileSync(entrypointPath, "utf-8");

		// crond should be started with flags: -p (permit user crontabs), -P (inherit PATH), -s (syslog)
		assert.ok(
			content.includes("crond -p -P -s &"),
			"entrypoint should start crond with -p -P -s flags for container operation",
		);

		// crond should NOT be started with "-f" (foreground mode)
		assert.ok(
			!content.includes("crond -f"),
			"entrypoint should not use -f flag (foreground mode) for crond",
		);
	});
});
