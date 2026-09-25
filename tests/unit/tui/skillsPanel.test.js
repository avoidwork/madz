import { describe, it } from "node:test";
import assert from "node:assert";
import React from "react";
import { renderToString } from "ink";
import {
	SkillsPanel,
	truncateDescription,
	DESCRIPTION_MAX_LENGTH,
} from "../../../src/tui/skillsPanel.js";

describe("truncateDescription", () => {
	it("returns the description unchanged when under the threshold", () => {
		const desc = "a".repeat(DESCRIPTION_MAX_LENGTH - 1);
		assert.strictEqual(truncateDescription(desc), desc);
	});

	it("returns the description unchanged when exactly at the threshold", () => {
		const desc = "a".repeat(DESCRIPTION_MAX_LENGTH);
		assert.strictEqual(truncateDescription(desc), desc);
	});

	it("truncates with an ellipsis when over the threshold", () => {
		const desc = "a".repeat(DESCRIPTION_MAX_LENGTH + 1);
		const result = truncateDescription(desc);
		assert.strictEqual(result.length, DESCRIPTION_MAX_LENGTH + 1);
		assert.ok(result.endsWith("…"));
		assert.strictEqual(
			result.slice(0, DESCRIPTION_MAX_LENGTH),
			desc.slice(0, DESCRIPTION_MAX_LENGTH),
		);
	});

	it("honors a custom max", () => {
		const result = truncateDescription("abcdefghij", 5);
		assert.strictEqual(result, "abcde…");
	});

	it("does not mutate the input", () => {
		const desc = "a".repeat(DESCRIPTION_MAX_LENGTH + 10);
		const before = desc;
		truncateDescription(desc);
		assert.strictEqual(desc, before);
	});
});

describe("SkillsPanel", () => {
	it("renders a short description without truncation", () => {
		const result = renderToString(
			React.createElement(SkillsPanel, {
				skills: [{ name: "example", description: "A short description." }],
				activeView: "skills",
			}),
		);
		assert.ok(result.includes("A short description."));
		assert.ok(!result.includes("…"));
	});

	it("renders a long description truncated with an ellipsis", () => {
		const longDesc = "x".repeat(DESCRIPTION_MAX_LENGTH + 50);
		const result = renderToString(
			React.createElement(SkillsPanel, {
				skills: [{ name: "example", description: longDesc }],
				activeView: "skills",
			}),
		);
		assert.ok(result.includes("…"));
		// The full description must not be present verbatim.
		assert.ok(!result.includes(longDesc));
	});

	it("does not mutate the underlying description", () => {
		const longDesc = "x".repeat(DESCRIPTION_MAX_LENGTH + 50);
		const skill = { name: "example", description: longDesc };
		renderToString(
			React.createElement(SkillsPanel, {
				skills: [skill],
				activeView: "skills",
			}),
		);
		assert.strictEqual(skill.description, longDesc);
	});

	it("renders the skill name alongside the description", () => {
		const result = renderToString(
			React.createElement(SkillsPanel, {
				skills: [{ name: "example-skill", description: "A short description." }],
				activeView: "skills",
			}),
		);
		// The rendered output must contain the skill name, not just the description.
		assert.ok(result.includes("example-skill"));
		assert.ok(result.includes("A short description."));
	});

	it("renders the skill name for each catalog entry", () => {
		const result = renderToString(
			React.createElement(SkillsPanel, {
				skills: [
					{ name: "alpha-skill", description: "Alpha description." },
					{ name: "beta-skill", description: "Beta description." },
				],
				activeView: "skills",
			}),
		);
		assert.ok(result.includes("alpha-skill"));
		assert.ok(result.includes("beta-skill"));
	});
});
