import { describe, it } from "node:test";
import assert from "node:assert";
import React from "react";
import { renderToString } from "ink";
import { SkillsPanel } from "../../../src/tui/skillsPanel.js";

describe("SkillsPanel", () => {
	it("renders the skill name", () => {
		const result = renderToString(
			React.createElement(SkillsPanel, {
				skills: [{ name: "example-skill", description: "A short description." }],
				activeView: "skills",
			}),
		);
		assert.ok(result.includes("example-skill"));
	});

	it("does not render the description", () => {
		const result = renderToString(
			React.createElement(SkillsPanel, {
				skills: [{ name: "example", description: "A short description." }],
				activeView: "skills",
			}),
		);
		assert.ok(!result.includes("A short description."));
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

	it("does not render any description text", () => {
		const result = renderToString(
			React.createElement(SkillsPanel, {
				skills: [
					{ name: "alpha-skill", description: "Alpha description." },
					{ name: "beta-skill", description: "Beta description." },
				],
				activeView: "skills",
			}),
		);
		assert.ok(!result.includes("Alpha description."));
		assert.ok(!result.includes("Beta description."));
	});
});
