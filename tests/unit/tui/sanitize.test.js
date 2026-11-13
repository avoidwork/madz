import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeForTerminal, sanitizeLine } from "../../../src/tui/sanitize.js";
import { parseSafeUrl } from "../../../src/tui/openUrl.js";
import { buttonToSelection } from "../../../src/tui/useMouseScroll.js";
import { parseMarkdownWithLinks } from "../../../src/tui/markdownText.js";
import { createSubagentStore, updateSubagentStore } from "../../../src/tui/subagentStore.js";

describe("sanitizeForTerminal", () => {
	it("strips ESC, BEL, DEL and C1 controls", () => {
		assert.equal(sanitizeForTerminal("a\x1b[31mb\x07c\x7fd\x9be"), "a[31mbcde");
	});

	it("keeps tabs and newlines", () => {
		assert.equal(sanitizeForTerminal("a\tb\nc"), "a\tb\nc");
	});

	it("removes carriage returns", () => {
		assert.equal(sanitizeForTerminal("a\rb"), "ab");
	});

	it("returns empty string for null and undefined", () => {
		assert.equal(sanitizeForTerminal(null), "");
		assert.equal(sanitizeForTerminal(undefined), "");
	});
});

describe("sanitizeLine", () => {
	it("collapses tabs and newlines to a space", () => {
		assert.equal(sanitizeLine("a\n\tb\x1b"), "a b");
	});
});

describe("parseSafeUrl credentials", () => {
	it("rejects URLs with embedded credentials", () => {
		assert.equal(parseSafeUrl("https://trusted.com@evil.com/"), null);
		assert.equal(parseSafeUrl("https://user:pass@example.com/"), null);
	});

	it("still accepts plain https URLs", () => {
		assert.ok(parseSafeUrl("https://example.com/"));
	});
});

describe("buttonToSelection motion and modifier bits", () => {
	it("recognises held-button drag (32) and modified presses", () => {
		assert.equal(buttonToSelection(32), true);
		assert.equal(buttonToSelection(4), true);
		assert.equal(buttonToSelection(36), true);
	});

	it("still rejects other buttons and wheel", () => {
		assert.equal(buttonToSelection(33), false);
		assert.equal(buttonToSelection(64), false);
	});
});

describe("markdown safety", () => {
	it("does not double-unescape entities", () => {
		const { text } = parseMarkdownWithLinks("&amp;lt;");
		assert.ok(!text.includes("<"));
	});

	it("does not record a link for a disallowed scheme", () => {
		const { links } = parseMarkdownWithLinks("[x](javascript:alert(1))");
		assert.equal(links.length, 0);
	});

	it("does not record a link for credentialed URLs", () => {
		const { links } = parseMarkdownWithLinks("[x](https://a.com@evil.com/)");
		assert.equal(links.length, 0);
	});

	it("strips escape sequences from content", () => {
		const { text } = parseMarkdownWithLinks("hello \x1b]0;pwned\x07 world");
		assert.ok(!text.includes("\x1b]0;"));
	});
});

describe("subagentStore tool pairing and cap", () => {
	const ns = ["task:1"];

	it("pairs tool_end with the matching running tool by name", () => {
		let s = createSubagentStore();
		s = updateSubagentStore(s, { type: "subagent_tool_start", namespace: ns, name: "a" });
		s = updateSubagentStore(s, { type: "subagent_tool_start", namespace: ns, name: "b" });
		s = updateSubagentStore(s, {
			type: "subagent_tool_end",
			namespace: ns,
			name: "a",
			data: { output: "A" },
		});
		const calls = Object.values(s)[0].toolCalls;
		assert.equal(calls[0].status, "done");
		assert.equal(calls[0].output, "A");
		assert.equal(calls[1].status, "running");
	});

	it("caps retained tool calls", () => {
		let s = createSubagentStore();
		for (let i = 0; i < 250; i++) {
			s = updateSubagentStore(s, { type: "subagent_tool_start", namespace: ns, name: `t${i}` });
		}
		assert.equal(Object.values(s)[0].toolCalls.length, 200);
	});
});
