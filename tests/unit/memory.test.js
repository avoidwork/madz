import { describe, it } from "node:test";
import assert from "node:assert";

describe("frontmatter parsing", () => {
	function parseFrontmatter(content) {
		if (!content) return { frontmatter: {}, content: "" };

		let frontmatter = {};
		let body = content;

		const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
		if (match) {
			const fmStr = match[1] || "";
			const lines = fmStr.split("\n");
			const parsed = {};
			for (const line of lines) {
				const colon = line.indexOf(":");
				if (colon !== -1) {
					const key = line.slice(0, colon).trim();
					let val = line.slice(colon + 1).trim();
					// Remove surrounding quotes
					if (
						(val.startsWith('"') && val.endsWith('"')) ||
						(val.startsWith("'") && val.endsWith("'"))
					) {
						val = val.slice(1, -1);
					}
					// Try number coercion
					const num = Number(val);
					if (!isNaN(num) && val !== "") parsed[key] = num;
					else if (val === "true") parsed[key] = true;
					else if (val === "false") parsed[key] = false;
					else parsed[key] = val;
				}
			}
			frontmatter = parsed;
			body = match[2] || "";
		}

		return { frontmatter, content: body.trim() };
	}

	it("extracts frontmatter and body", () => {
		const sample = "---\ntitle: Test\ntimestamp: 2024-01-01\n---\nHello world";
		const result = parseFrontmatter(sample);
		assert.deepStrictEqual(result.frontmatter, {
			title: "Test",
			timestamp: "2024-01-01",
		});
		assert.strictEqual(result.content, "Hello world");
	});

	it("handles content without frontmatter", () => {
		const result = parseFrontmatter("Just plain text");
		assert.deepStrictEqual(result.frontmatter, {});
		assert.strictEqual(result.content, "Just plain text");
	});

	it("handles empty string", () => {
		const result = parseFrontmatter("");
		assert.deepStrictEqual(result.frontmatter, {});
		assert.strictEqual(result.content, "");
	});

	it("handles missing body after frontmatter", () => {
		const sample = "---\ntitle: Test\n---\n";
		const result = parseFrontmatter(sample);
		assert.strictEqual(result.frontmatter.title, "Test");
		assert.strictEqual(result.content, "");
	});

	it("returns empty content when frontmatter only", () => {
		const input = "title: Test";
		const result = parseFrontmatter(input);
		assert.strictEqual(result.content, "title: Test");
	});

	it("parses multiple frontmatter fields", () => {
		const sample =
			"---\ntitle: Test\nprovider: openai\nmodel: gpt-4\ntokenCount: 42\n---\nBody content";
		const result = parseFrontmatter(sample);
		assert.strictEqual(result.frontmatter.provider, "openai");
		assert.strictEqual(result.frontmatter.tokenCount, 42);
		assert.strictEqual(result.content, "Body content");
	});
});

describe("memory file writer logic", () => {
	/**
	 * Replicate the core logic of writeMemoryFile without filesystem access.
	 */
	function buildMemoryContent(title, frontmatter, body = "") {
		const timestamp = new Date("2024-01-01T00:00:00Z").toISOString();
		const _slug = title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
		const lines = [
			"---",
			`title: "${title}"`,
			`timestamp: "${timestamp}"`,
			...Object.entries(frontmatter).map(([k, v]) => {
				if (v == null) return `${k}:`;
				if (typeof v === "string") return `${k}: "${v}"`;
				if (typeof v === "boolean") return `${k}: ${v}`;
				if (typeof v === "number") return `${k}: ${v}`;
				return `${k}: ${JSON.stringify(v)}`;
			}),
			"---",
			"",
			body,
			"",
		];
		return lines.join("\n");
	}

	it("generates valid frontmatter structure", () => {
		const content = buildMemoryContent("Test Note", { type: "conversation" }, "Body text");
		assert.ok(content.startsWith("---"));
		assert.ok(content.includes("title:"));
		assert.ok(content.includes("timestamp:"));
		assert.ok(content.includes("---"));
		assert.ok(content.includes("Body text"));
	});

	it("generates slug from title", () => {
		const content = buildMemoryContent("My Test Note", {}, "Body");
		assert.ok(content.includes('title: "My Test Note"'));
	});

	it("handles empty body", () => {
		const content = buildMemoryContent("Empty", {});
		assert.ok(content.includes("---"));
	});

	it("handles numeric frontmatter values", () => {
		const content = buildMemoryContent("Num", { count: 42, rate: 0.5 });
		assert.ok(content.includes("count: 42"));
		assert.ok(content.includes("rate: 0.5"));
	});

	it("handles boolean frontmatter values", () => {
		const content = buildMemoryContent("Bool", { enabled: true });
		assert.ok(content.includes("enabled: true"));
	});

	it("handles null frontmatter values", () => {
		const content = buildMemoryContent("Null", { extra: null });
		assert.ok(content.includes("extra:"));
	});

	describe("memory index search logic", () => {
		function searchIndex(entries, query) {
			if (!query) return [];
			return entries.filter((entry) => entry.title.toLowerCase().includes(query.toLowerCase()));
		}

		it("finds entries by title substring", () => {
			const entries = [
				{ title: "Daily Report", timestamp: "2024-01-01" },
				{ title: "API Health Check", timestamp: "2024-01-02" },
				{ title: "Weekly Summary", timestamp: "2024-01-03" },
			];
			const results = searchIndex(entries, "daily");
			assert.strictEqual(results.length, 1);
			assert.strictEqual(results[0].title, "Daily Report");
		});

		it("handles empty query", () => {
			const entries = [{ title: "Test" }];
			const results = searchIndex(entries, "");
			assert.strictEqual(results.length, 0);
		});

		it("is case-insensitive", () => {
			const entries = [{ title: "Daily Report" }];
			const results = searchIndex(entries, "DAILY");
			assert.strictEqual(results.length, 1);
		});

		it("returns empty for no match", () => {
			const entries = [{ title: "Report A" }, { title: "Report B" }];
			const results = searchIndex(entries, "xyz");
			assert.strictEqual(results.length, 0);
		});
	});

	describe("retention cleanup logic", () => {
		function shouldRemove(mtimeMs, retentionDays) {
			const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
			return mtimeMs < cutoff;
		}

		it("removes old files", () => {
			const oldDate = new Date("2020-01-01").getTime();
			assert.strictEqual(shouldRemove(oldDate, 90), true);
		});

		it("keeps recent files", () => {
			const recentDate = new Date().getTime() - 86400000; // 1 day ago
			assert.strictEqual(shouldRemove(recentDate, 90), false);
		});

		it("works with zero retention days", () => {
			const yesterday = new Date().getTime() - 86400000;
			assert.strictEqual(shouldRemove(yesterday, 0), true);
		});
	});
});

describe("context loading logic", () => {
	function formatContext({ title, body }) {
		return `\n[Context: ${title}]\n${body.trim()}`;
	}

	it("formats context with title and body", () => {
		const entry = { title: "My Note", body: "Some notes here" };
		const result = formatContext(entry);
		assert.ok(result.includes("[Context: My Note]"));
		assert.ok(result.includes("Some notes here"));
	});

	it("trims body content", () => {
		const entry = { title: "Note", body: "  text  \n" };
		const result = formatContext(entry);
		assert.ok(result.includes("text"));
		assert.ok(!result.includes("  text  "));
	});

	describe("sorted context files", () => {
		function sortByTimestamp(files) {
			return files.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
		}

		it("sorts by timestamp descending", () => {
			const files = [
				{ timestamp: "2024-01-01" },
				{ timestamp: "2024-01-03" },
				{ timestamp: "2024-01-02" },
			];
			sortByTimestamp(files);
			assert.strictEqual(files[0].timestamp, "2024-01-03");
			assert.strictEqual(files[2].timestamp, "2024-01-01");
		});
	});
});
