import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("docker-entrypoint.sh", () => {
	it("should start cron daemon for container operation", () => {
		const entrypointPath = join(process.cwd(), "docker-entrypoint.sh");
		const content = readFileSync(entrypointPath, "utf-8");

		// cron should be started in foreground mode (-f) and backgrounded with &
		// Debian's cron package uses the 'cron' binary (not 'crond' from cronie)
		assert.ok(
			content.includes("cron -f &"),
			"entrypoint should start cron daemon with -f flag and background it",
		);
	});
});
