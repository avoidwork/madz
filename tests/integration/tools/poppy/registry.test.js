import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildToolConfig } from "../../../../src/tools/index.js";

/**
 * Integration tests for Poppy tool registration.
 *
 * These verify that `buildToolConfig()` registers the `poppy` tool when the
 * `network:outbound` permission is enabled, that the tool instance is present
 * and invocable, and that it is absent when the permission is disabled.
 */

describe("poppy - integration tool registration", () => {
	it("registers an invocable poppy tool when network:outbound is enabled", async () => {
		const tools = await buildToolConfig({
			permissions: ["filesystem:read", "network:outbound"],
			maxReadSize: 1024 * 1024,
			config: { memory: { toolsDir: "/tmp/poppy-keys" } },
		});
		const poppyTool = tools.find((t) => t.name === "poppy");
		assert.ok(poppyTool, "poppy tool should be registered with network:outbound");
		assert.equal(typeof poppyTool.invoke, "function", "poppy tool should be invocable");
	});

	it("does not register poppy when network:outbound is disabled", async () => {
		const tools = await buildToolConfig({
			permissions: ["filesystem:read"],
			maxReadSize: 1024 * 1024,
		});
		const poppyTool = tools.find((t) => t.name === "poppy");
		assert.equal(
			poppyTool,
			undefined,
			"poppy tool should NOT be registered without network:outbound",
		);
	});
});
