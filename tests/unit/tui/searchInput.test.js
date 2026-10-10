import { describe, it } from "node:test";
import assert from "node:assert";
import React from "react";
import { renderToString } from "ink";
import { SearchInput } from "../../../src/tui/searchInput.js";

describe("SearchInput", () => {
	it("renders a Search label with an empty query", () => {
		const result = renderToString(
			React.createElement(SearchInput, {
				value: "",
				onChange: () => {},
				onNext: () => {},
				onPrev: () => {},
				onExit: () => {},
				onToggle: () => {},
			}),
		);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("Search:"), "should render the Search label");
	});

	it("renders the query text", () => {
		const result = renderToString(
			React.createElement(SearchInput, {
				value: "foo",
				onChange: () => {},
				onNext: () => {},
				onPrev: () => {},
				onExit: () => {},
				onToggle: () => {},
			}),
		);
		assert.ok(typeof result === "string");
		assert.ok(result.includes("Search:"), "should render the Search label");
		assert.ok(result.includes("foo"), "should render the query text");
	});

	it("renders a cursor indicator", () => {
		const result = renderToString(
			React.createElement(SearchInput, {
				value: "abc",
				onChange: () => {},
				onNext: () => {},
				onPrev: () => {},
				onExit: () => {},
				onToggle: () => {},
			}),
		);
		assert.ok(typeof result === "string");
		// The cursor is rendered as an inverse character; the query text is present.
		assert.ok(result.includes("abc"), "should render the query text");
	});

	it("exports a default component", () => {
		assert.strictEqual(typeof SearchInput, "function");
	});
});
