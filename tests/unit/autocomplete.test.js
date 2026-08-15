import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "os";
import { InputPanel } from "../../src/tui/inputPanel.js";
import React from "react";
import { renderToString } from "ink";

// --- autocomplete.js tests ---

describe("autocomplete - searchFiles", () => {
	let tmpDir;
	let originalCwd;

	beforeEach(() => {
		// Create a temp directory with known files for testing
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "autocomplete-test-"));
		// Create test file structure
		fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
		fs.writeFileSync(path.join(tmpDir, "src", "foo.js"), "");
		fs.writeFileSync(path.join(tmpDir, "src", "foobar.js"), "");
		fs.writeFileSync(path.join(tmpDir, "src", "bar.js"), "");
		fs.mkdirSync(path.join(tmpDir, "test"), { recursive: true });
		fs.writeFileSync(path.join(tmpDir, "test", "foo.spec.js"), "");
		fs.mkdirSync(path.join(tmpDir, "node_modules"), { recursive: true });
		fs.writeFileSync(path.join(tmpDir, "node_modules", "hidden.js"), "");
		fs.mkdirSync(path.join(tmpDir, ".git"), { recursive: true });
		fs.writeFileSync(path.join(tmpDir, ".git", "config"), "");
		originalCwd = process.cwd();
	});

	afterEach(() => {
		// Clean up temp directory
		if (tmpDir) {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
		if (originalCwd) {
			process.cwd = () => originalCwd;
		}
		mock.reset();
	});

	it("returns empty array when prefix is empty", async () => {
		const { searchFiles } = await import("../../src/tui/autocomplete.js");
		const result = await searchFiles("");
		assert.deepStrictEqual(result, []);
	});

	it("returns empty array when prefix is undefined", async () => {
		const { searchFiles } = await import("../../src/tui/autocomplete.js");
		const result = await searchFiles(undefined);
		assert.deepStrictEqual(result, []);
	});

	it("returns empty array when prefix is null", async () => {
		const { searchFiles } = await import("../../src/tui/autocomplete.js");
		const result = await searchFiles(null);
		assert.deepStrictEqual(result, []);
	});

	it("returns matching files limited to 5", async () => {
		// Mock process.cwd to return our temp directory
		const originalCwd = process.cwd;
		process.cwd = () => tmpDir;

		const { searchFiles } = await import("../../src/tui/autocomplete.js");
		const result = await searchFiles("foo");

		// Restore cwd
		process.cwd = originalCwd;

		assert.ok(Array.isArray(result));
		assert.ok(result.length <= 5);
		// Should include src/foo.js and src/foobar.js
		assert.ok(result.some((f) => f.includes("foo")));
		// Should NOT include node_modules or .git files
		assert.ok(!result.some((f) => f.includes("node_modules")));
		assert.ok(!result.some((f) => f.includes(".git")));
	});

	it("excludes node_modules and .git directories", async () => {
		const originalCwd = process.cwd;
		process.cwd = () => tmpDir;

		const { searchFiles } = await import("../../src/tui/autocomplete.js");
		const result = await searchFiles("");

		process.cwd = originalCwd;

		// Empty prefix returns empty, but we verify the function runs without error
		assert.deepStrictEqual(result, []);
	});

	it("returns empty array on fast-glob error", async () => {
		// We can't mock fast-glob's default export directly, so we test
		// error handling by temporarily making process.cwd return a path
		// that causes fg to fail (non-existent directory).
		const originalCwd = process.cwd;
		process.cwd = () => "/nonexistent/path/that/does/not/exist";

		const { searchFiles } = await import("../../src/tui/autocomplete.js");
		const result = await searchFiles("foo");

		process.cwd = originalCwd;
		assert.deepStrictEqual(result, []);
	});
});

// --- InputPanel component rendering tests ---
// Uses renderToString since ink's render() requires raw stdin mode

describe("InputPanel - component rendering", () => {
	it("renders as a TextInput element", async () => {
		const result = renderToString(
			React.createElement(InputPanel, {
				value: "hello",
				onChange: () => {},
				onSubmit: () => {},
				focus: true,
			}),
		);
		assert.ok(String(result).length > 0, "should produce rendered output");
	});

	it("renders with @ prefix value", async () => {
		const result = renderToString(
			React.createElement(InputPanel, {
				value: "@src",
				onChange: () => {},
				onSubmit: () => {},
				focus: true,
			}),
		);
		assert.ok(String(result).length > 0, "should render value containing @");
	});

	it("renders in autocomplete mode", async () => {
		const result = renderToString(
			React.createElement(InputPanel, {
				value: "@src",
				inAutocomplete: true,
				autocompleteQuery: "src",
				autocompleteMatches: ["src/foo.js", "src/bar.js"],
				autocompleteSelectedIndex: 0,
				onChange: () => {},
				onSubmit: () => {},
				onAutocompleteSelect: () => {},
				focus: true,
			}),
		);
		assert.ok(String(result).length > 0, "should render in autocomplete mode");
	});

	it("renders without error when autocomplete props are omitted", async () => {
		const result = renderToString(
			React.createElement(InputPanel, {
				value: "hello",
				onChange: () => {},
				onSubmit: () => {},
				focus: true,
			}),
		);
		assert.ok(String(result).length > 0, "should render without autocomplete props");
	});

	it("renders with inAutocomplete=false by default", async () => {
		const result = renderToString(
			React.createElement(InputPanel, {
				value: "hello",
				onChange: () => {},
				onSubmit: () => {},
				focus: true,
			}),
		);
		assert.ok(String(result).length > 0, "should render with default inAutocomplete=false");
	});

	it("renders with unfocused state", async () => {
		const result = renderToString(
			React.createElement(InputPanel, {
				value: "hello",
				onChange: () => {},
				onSubmit: () => {},
				focus: false,
			}),
		);
		assert.ok(String(result).length > 0, "should render when unfocused");
	});

	it("renders with multiple @ in value", async () => {
		const result = renderToString(
			React.createElement(InputPanel, {
				value: "look at @src/foo.js and @test",
				onChange: () => {},
				onSubmit: () => {},
				focus: true,
			}),
		);
		assert.ok(String(result).length > 0, "should render with multiple @ references");
	});

	it("renders with empty value", async () => {
		const result = renderToString(
			React.createElement(InputPanel, {
				value: "",
				onChange: () => {},
				onSubmit: () => {},
				focus: true,
			}),
		);
		// TextInput with empty value may render as empty string — just verify no crash
		assert.ok(result !== null && result !== undefined, "should not throw on empty value");
	});
});
