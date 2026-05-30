import { describe, it } from "node:test";
import assert from "node:assert";
import { helloWorldImpl, hello_world, createHelloWorldTool } from "../../src/tools/hello.js";
import { buildToolConfig, TOOL_PERMISSIONS } from "../../src/tools/index.js";

describe("hello_world tool", () => {
	it("returns hello_world! as JSON", async () => {
		const result = await helloWorldImpl({}, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.result, "hello_world!");
	});

	it("returns consistent result regardless of input", async () => {
		const result = await helloWorldImpl({ name: "everyone" }, {});
		const parsed = JSON.parse(result);
		assert.strictEqual(parsed.result, "hello_world!");
	});

	it("has correct tool name and description", async () => {
		assert.strictEqual(hello_world.name, "hello_world");
		assert.ok(hello_world.description.includes("hello_world"));
	});

	it("can be instantiated via factory", async () => {
		const tool = createHelloWorldTool();
		assert.strictEqual(tool.name, "hello_world");
		assert.ok(typeof tool.call !== "undefined" || typeof tool.invoke !== "undefined");
	});

	it("has empty permission requirements", async () => {
		assert.deepStrictEqual(TOOL_PERMISSIONS.hello_world, []);
	});

	it("is included in buildToolConfig with empty permissions", async () => {
		const tools = await buildToolConfig({
			permissions: [], // no permissions enabled
			allowedPaths: [],
			maxReadSize: "1mb",
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("hello_world"));
	});

	it("is included in buildToolConfig with all permissions", async () => {
		const tools = await buildToolConfig({
			permissions: ["filesystem:read", "filesystem:write", "network:outbound"],
			allowedPaths: [],
			maxReadSize: "1mb",
		});
		const toolNames = tools.map((t) => t.name);
		assert.ok(toolNames.includes("hello_world"));
	});
});
