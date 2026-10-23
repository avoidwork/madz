/**
 * Tests for the replacement SkillsMiddleware.
 *
 * Guards two things:
 * 1. The middleware carries the exact name deepagents' `mergeMiddlewareStack`
 *    keys on — otherwise a second SkillsMiddleware stacks instead of
 *    displacing and the `read_file` instruction survives while looking fixed.
 * 2. The injected prompt directs the agent to the `skill` tool, not to
 *    `read_file` the SKILL.md path.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { createSkillsMiddleware } from "../../src/agent/skillsMiddleware.js";

/**
 * Build a fake model request whose `systemMessage` records the appended text.
 * @returns {{ request: object, captured: string[] }} The request and a capture array
 */
function makeRequest() {
	const captured = [];
	const request = {
		systemMessage: {
			concat: (text) => {
				captured.push(text);
				return { content: text };
			},
		},
	};
	return { request, captured };
}

describe("createSkillsMiddleware", () => {
	it("is named SkillsMiddleware so it displaces the library default", () => {
		const mw = createSkillsMiddleware({ registry: {}, sources: [] });
		assert.strictEqual(mw.name, "SkillsMiddleware");
	});

	it("injects a prompt that directs the agent to the skill tool", () => {
		const registry = {
			getCatalog: () => [{ name: "audit-code", description: "Audits code." }],
		};
		const mw = createSkillsMiddleware({ registry, sources: ["skills/"] });
		const { request, captured } = makeRequest();
		mw.wrapModelCall(request, (r) => r);
		const prompt = captured[0];
		assert.ok(prompt.includes("skill({ name:"), "prompt should show the skill tool call");
		assert.ok(prompt.includes("Use the `skill` tool"), "prompt should reference the skill tool");
	});

	it("does NOT instruct the agent to read_file the SKILL.md", () => {
		const registry = {
			getCatalog: () => [{ name: "audit-code", description: "Audits code." }],
		};
		const mw = createSkillsMiddleware({ registry, sources: ["skills/"] });
		const { request, captured } = makeRequest();
		mw.wrapModelCall(request, (r) => r);
		const prompt = captured[0];
		assert.ok(!prompt.includes("Use `read_file`"), "prompt must not tell the agent to read_file");
		assert.ok(
			!prompt.includes("Read the skill's full instructions"),
			"prompt must not have the library read_file step",
		);
	});

	it("lists skills from the registry catalog", () => {
		const registry = {
			getCatalog: () => [
				{ name: "audit-code", description: "Audits code." },
				{ name: "git-tag", description: "Tags releases." },
			],
		};
		const mw = createSkillsMiddleware({ registry, sources: ["skills/"] });
		const { request, captured } = makeRequest();
		mw.wrapModelCall(request, (r) => r);
		const prompt = captured[0];
		assert.ok(prompt.includes("- **audit-code**: Audits code."));
		assert.ok(prompt.includes("- **git-tag**: Tags releases."));
	});

	it("handles an empty registry and sources gracefully", () => {
		const mw = createSkillsMiddleware({ registry: {}, sources: [] });
		const { request, captured } = makeRequest();
		mw.wrapModelCall(request, (r) => r);
		const prompt = captured[0];
		assert.ok(prompt.includes("No skills available yet."));
	});

	it("passes the request through to the handler", () => {
		const mw = createSkillsMiddleware({ registry: {}, sources: [] });
		const { request } = makeRequest();
		let handled = false;
		mw.wrapModelCall(request, (r) => {
			handled = true;
			return r;
		});
		assert.ok(handled, "handler should be invoked");
	});
});
