/**
 * Tests for clickable markdown links: link spans, hit-testing and the safe opener.
 * @see {@link src/tui/linkHit.js}
 * @see {@link src/tui/openUrl.js}
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { parseMarkdownWithLinks } from "../../../src/tui/markdownText.js";
import {
	hitLink,
	wrapRendered,
	locateLinks,
	setLinkTarget,
	findLinkAt,
} from "../../../src/tui/linkHit.js";
import { stripAnsi } from "../../../src/tui/selectionLayout.js";
import { openUrl, parseSafeUrl, buildOpenCommand } from "../../../src/tui/openUrl.js";

/** Build a fake Ink node with a computed layout (no parent). */
function node(left, top, width, height) {
	return {
		parentNode: null,
		yogaNode: { getComputedLayout: () => ({ left, top, width, height }) },
	};
}

/** Layout rect as getBoundingClientRect reports it (1-indexed origin). */
function rect(left, top, width, height) {
	return { left, top, right: left + width, bottom: top + height, width, height };
}

describe("parseMarkdownWithLinks", () => {
	it("records link spans with visible text and href", () => {
		const { text, links } = parseMarkdownWithLinks("see [docs](https://example.com/a) now");
		assert.strictEqual(links.length, 1);
		assert.strictEqual(links[0].href, "https://example.com/a");
		assert.ok(links[0].text.includes("docs"));
		assert.ok(text.length > 0);
	});

	it("records bare autolinks", () => {
		const { links } = parseMarkdownWithLinks("<https://example.org/x>");
		assert.strictEqual(links.length, 1);
		assert.strictEqual(links[0].href, "https://example.org/x");
	});

	it("returns the same metadata from the cache", () => {
		const md = "cache [me](https://example.com/cache-test)";
		const first = parseMarkdownWithLinks(md);
		const second = parseMarkdownWithLinks(md);
		assert.strictEqual(first, second);
		assert.strictEqual(second.links[0].href, "https://example.com/cache-test");
	});

	it("returns no links for plain text", () => {
		assert.deepStrictEqual(parseMarkdownWithLinks("just text").links, []);
	});
});

describe("wrapRendered / locateLinks", () => {
	it("wraps at spaces and hard-cuts long words", () => {
		const lines = wrapRendered("aaa bbb ccc", 7);
		assert.deepStrictEqual(
			lines.map((l) => l.text),
			["aaa bbb", "ccc"],
		);
		assert.deepStrictEqual(
			wrapRendered("abcdefghij", 4).map((l) => l.text),
			["abcd", "efgh", "ij"],
		);
	});

	it("honors newlines and records start offsets", () => {
		const lines = wrapRendered("ab\ncd", 10);
		assert.deepStrictEqual(lines, [
			{ text: "ab", start: 0 },
			{ text: "cd", start: 3 },
		]);
	});

	it("locates links in order, skipping missing ones", () => {
		const ranges = locateLinks("one two one", [
			{ text: "one", href: "a" },
			{ text: "one", href: "b" },
			{ text: "zzz", href: "c" },
		]);
		assert.deepStrictEqual(ranges, [
			{ start: 0, end: 3, href: "a" },
			{ start: 8, end: 11, href: "b" },
		]);
	});
});

describe("hitLink", () => {
	const md = "go [here](https://example.com/h) ok";
	const { text, links } = parseMarkdownWithLinks(md);
	const plain = stripAnsi(text);
	const start = plain.indexOf(links[0].text);
	assert.ok(start >= 0);
	const bubble = rect(3, 10, 80, 1);

	it("hits a link using rendered (not raw) columns", () => {
		const x = bubble.left + start + 1;
		assert.strictEqual(hitLink({ x, y: 10 }, md, bubble), "https://example.com/h");
	});

	it("misses clicks outside the link text", () => {
		assert.strictEqual(hitLink({ x: bubble.left, y: 10 }, md, bubble), null);
		assert.strictEqual(
			hitLink({ x: bubble.left + start + links[0].text.length, y: 10 }, md, bubble),
			null,
		);
	});

	it("applies the scroll offset", () => {
		const x = bubble.left + start;
		assert.strictEqual(hitLink({ x, y: 7 }, md, bubble, { offset: 3 }), "https://example.com/h");
		assert.strictEqual(hitLink({ x, y: 10 }, md, bubble, { offset: 3 }), null);
	});

	it("ignores clicks outside the viewport", () => {
		const x = bubble.left + start;
		const viewport = rect(1, 1, 100, 5);
		assert.strictEqual(hitLink({ x, y: 10 }, md, bubble, { viewport }), null);
	});

	it("resolves a link that wraps onto a second line", () => {
		const wrapMd = "aaaa bbbb [wrapped link text](https://example.com/w)";
		const box = rect(1, 4, 12, 4);
		const { text: t } = parseMarkdownWithLinks(wrapMd);
		const rendered = stripAnsi(t);
		const lines = wrapRendered(rendered, box.width);
		const idx = lines.findIndex((l) => l.text.includes("wrapped") || l.text.includes("link"));
		assert.ok(idx > 0, "link should be on a wrapped line");
		const col = lines[idx].text.search(/\S/);
		assert.strictEqual(
			hitLink({ x: box.left + col, y: box.top + idx }, wrapMd, box),
			"https://example.com/w",
		);
	});

	it("returns null for bad input", () => {
		assert.strictEqual(hitLink(null, md, bubble), null);
		assert.strictEqual(hitLink({ x: 1, y: 1 }, md, undefined), null);
		assert.strictEqual(hitLink({ x: 5, y: 10 }, "no links here", bubble), null);
	});
});

describe("findLinkAt / setLinkTarget", () => {
	it("finds the link in a registered block and unregisters it", () => {
		const md = "[x](https://example.com/t)";
		// ink-mouse positions are 1-indexed: layout left 0/top 4 -> cell (1, 5).
		setLinkTarget("t1", {
			node: node(0, 4, 40, 1),
			content: md,
			getScrollInfo: () => ({ offset: 0 }),
		});
		assert.strictEqual(findLinkAt({ x: 1, y: 5 }), "https://example.com/t");
		assert.strictEqual(findLinkAt({ x: 1, y: 6 }), null);
		setLinkTarget("t1", null);
		assert.strictEqual(findLinkAt({ x: 1, y: 5 }), null);
	});
});

describe("parseSafeUrl", () => {
	it("allows http, https and mailto", () => {
		assert.ok(parseSafeUrl("http://example.com"));
		assert.ok(parseSafeUrl("https://example.com/a?b=1"));
		assert.ok(parseSafeUrl("mailto:a@example.com"));
	});

	it("rejects javascript:, file:, data: and garbage", () => {
		for (const bad of [
			"javascript:alert(1)",
			"file:///etc/passwd",
			"data:text/html,hi",
			"ftp://x",
			"not a url",
			"",
			null,
		]) {
			assert.strictEqual(parseSafeUrl(bad), null, String(bad));
		}
	});
});

describe("openUrl", () => {
	it("spawns with an args array and never a shell", () => {
		const calls = [];
		const spawnFn = (cmd, args, opts) => {
			calls.push({ cmd, args, opts });
			return { on() {}, unref() {} };
		};
		assert.strictEqual(
			openUrl("https://example.com/?a=1&b=2", { spawnFn, platform: "linux" }),
			true,
		);
		assert.strictEqual(calls[0].cmd, "xdg-open");
		assert.ok(Array.isArray(calls[0].args));
		assert.strictEqual(calls[0].args[0], "https://example.com/?a=1&b=2");
		assert.notStrictEqual(calls[0].opts.shell, true);
	});

	it("does not spawn for rejected protocols", () => {
		let spawned = 0;
		const spawnFn = () => {
			spawned++;
			return { on() {}, unref() {} };
		};
		for (const bad of ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,x"]) {
			assert.strictEqual(openUrl(bad, { spawnFn }), false);
		}
		assert.strictEqual(spawned, 0);
	});

	it("reports a synchronous spawn failure without throwing", () => {
		const spawnFn = () => {
			throw new Error("boom");
		};
		assert.strictEqual(openUrl("https://example.com", { spawnFn }), false);
	});

	it("handles async spawn errors through the error listener", () => {
		let onError;
		const spawnFn = () => ({
			on: (evt, cb) => {
				if (evt === "error") onError = cb;
			},
			unref() {},
		});
		assert.strictEqual(openUrl("https://example.com", { spawnFn }), true);
		assert.doesNotThrow(() => onError(new Error("ENOENT")));
	});

	it("picks the platform opener", () => {
		assert.strictEqual(buildOpenCommand("u", "darwin").cmd, "open");
		assert.strictEqual(buildOpenCommand("u", "win32").cmd, "rundll32");
		assert.strictEqual(buildOpenCommand("u", "linux").cmd, "xdg-open");
	});
});
